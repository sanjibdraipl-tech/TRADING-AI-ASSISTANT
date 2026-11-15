import { useCallback, useEffect, useRef, useState } from 'react';
import { AnalyzedStock, DataSourceMetadata } from '../types/trading';
import { VoiceChatMessage } from '../types/conversation';
import {
  DetectedLanguage,
  GeminiConnectionTestResult,
  GeminiDiagnosticDetails,
  VoiceDiagnosticsState,
  VoiceIntent,
  VoiceSession,
  VoiceSettingsConfig,
  VoiceStateStatus,
  VoiceStockJsonPayload,
} from '../types/voice';
import {
  buildMarketBreadthJson,
  buildVoiceStockJson,
  resolveSymbolFromSpeech,
} from '../services/marketDataService';
import { routeVoiceCommand } from '../services/voiceCommandRouter';
import { ttsService } from '../services/textToSpeechService';
import {
  startVoiceInputSession,
  VoiceSessionController,
} from '../services/voiceSessionService';
import {
  buildExplicitDemoReply,
  testGeminiConnection,
} from '../services/geminiService';
import { formatLanguageTag } from '../utils/languageDetector';
import { useGemini } from './useGemini';
import { useConversation } from './useConversation';

const VOICE_SETTINGS_KEY = 'smart_trader_voice_settings_v1';

export const DEFAULT_VOICE_SETTINGS: VoiceSettingsConfig = {
  language: 'auto',
  ttsEngine: 'browser',
  voiceURI: 'auto',
  speechRate: 1.0,
  autoSpeak: true,
  interruptAi: true,
  continuousConversation: false,
  saveHistory: true,
  modelName: 'gemini-4-hydrogen',
};

function loadVoiceSettings(defaultModel: string): VoiceSettingsConfig {
  try {
    const raw = localStorage.getItem(VOICE_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_VOICE_SETTINGS, modelName: defaultModel };
    const parsed = JSON.parse(raw);
    const savedModel = parsed?.modelName === 'gemini-3.8-flash' ? defaultModel : parsed?.modelName;
    return { ...DEFAULT_VOICE_SETTINGS, ...parsed, modelName: savedModel || defaultModel };
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS, modelName: defaultModel };
  }
}

export interface UseVoiceOptions {
  stocks: AnalyzedStock[];
  dataSourceMeta: DataSourceMetadata;
  defaultModelName: string;
  onNavigateTab: (tab: string) => void;
  onSelectStock: (symbol: string) => void;
  onToggleTheme: (mode: 'dark' | 'light') => void;
}

interface FailedGeminiContext {
  text: string;
  inputMode: 'voice' | 'text';
  intent: VoiceIntent;
  resolutionSymbol?: string;
  marketContext: VoiceStockJsonPayload | Record<string, unknown> | null;
  effectiveRate: 0.75 | 1.0 | 1.25 | 1.5;
  effectiveLangPref: VoiceSettingsConfig['language'];
}

export function useVoice(options: UseVoiceOptions) {
  const { stocks, dataSourceMeta, defaultModelName, onNavigateTab, onSelectStock, onToggleTheme } = options;

  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsConfig>(() =>
    loadVoiceSettings(defaultModelName)
  );
  const [status, setStatus] = useState<VoiceStateStatus>('idle');
  const [detectedLanguage, setDetectedLanguage] = useState<DetectedLanguage>('en');
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [lowConfidenceWarning, setLowConfidenceWarning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [geminiFailedError, setGeminiFailedError] = useState<string>('');
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(16).fill(0));
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [activeMarketPayload, setActiveMarketPayload] = useState<VoiceStockJsonPayload | null>(null);
  const [lastAnswerForPlay, setLastAnswerForPlay] = useState<{
    text: string;
    lang: DetectedLanguage;
  } | null>(null);
  const [ttsBlockedOrFailed, setTtsBlockedOrFailed] = useState<boolean>(false);
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [connectionTestResult, setConnectionTestResult] =
    useState<GeminiConnectionTestResult | null>(null);

  const [diagnostics, setDiagnostics] = useState<VoiceDiagnosticsState>({
    sttStatus: 'IDLE',
    geminiStatus: 'IDLE',
    ttsStatus: 'IDLE',
    selectedVoice: 'Detecting browser voices...',
    detectedLanguage: 'en-IN',
    lastError: 'None',
    audioPlaybackStatus: 'IDLE',
    ttsProvider: 'Browser SpeechSynthesis',
    geminiModel: defaultModelName || 'gemini-4-hydrogen',
    apiKeyConfigured: false,
    apiEnvSource: 'checking...',
    lastRequestTime: 'Never',
    responseTimeMs: null,
    lastHttpStatus: null,
    retryCount: 0,
    maxRetries: 1,
    timeoutMs: 30000,
    lastErrorType: 'NONE',
    lastEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-4-hydrogen:streamGenerateContent',
  });

  const sessionCtrlRef = useRef<VoiceSessionController | null>(null);
  const lastAiReplyRef = useRef<{ text: string; lang: DetectedLanguage } | null>(null);
  const lastFailedContextRef = useRef<FailedGeminiContext | null>(null);
  const [canRetryGemini, setCanRetryGemini] = useState<boolean>(false);
  const continuousRef = useRef(voiceSettings.continuousConversation);
  continuousRef.current = voiceSettings.continuousConversation;

  const {
    conversations,
    activeConversation,
    setActiveId,
    addMessage,
    editMessageText,
    deleteMessage,
    newConversation,
    renameConversation,
    deleteConversation,
    clearActiveMessages,
    exportActiveJson,
  } = useConversation(voiceSettings.saveHistory);

  const { streamingText, isStreaming, lastDiagnostic, askStreaming, abortStream } = useGemini();

  useEffect(() => {
    try {
      localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(voiceSettings));
    } catch {
      // ignore storage errors
    }
  }, [voiceSettings]);

  // Fetch initial server-side Gemini proxy config (never exposes any key)
  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((d) => {
        setDiagnostics((prev) => ({
          ...prev,
          apiKeyConfigured: Boolean(d?.keyConfigured),
          apiEnvSource: d?.envSource || (d?.keyConfigured ? 'server env' : 'missing'),
          geminiModel: voiceSettings.modelName || d?.modelName || prev.geminiModel,
          timeoutMs: d?.timeoutMs || 30000,
          maxRetries: typeof d?.retryCount === 'number' ? d.retryCount : 1,
        }));
      })
      .catch(() => {
        setDiagnostics((prev) => ({
          ...prev,
          apiKeyConfigured: false,
          apiEnvSource: 'server status unreachable',
        }));
      });
  }, [voiceSettings.modelName]);

  // Dynamically load browser SpeechSynthesis voices
  useEffect(() => {
    const refreshVoices = () => {
      const voices = ttsService.getAvailableVoices();
      setAvailableVoices(voices);
      const best = ttsService.pickBestBrowserVoice(detectedLanguage, voiceSettings.voiceURI);
      setDiagnostics((prev) => ({
        ...prev,
        selectedVoice: best
          ? `${best.name} (${best.lang})`
          : voices.length === 0
          ? 'No browser voices detected yet'
          : 'Browser Default',
      }));
    };
    refreshVoices();
    const timer = window.setTimeout(refreshVoices, 400);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
      return () => {
        window.clearTimeout(timer);
        window.speechSynthesis.removeEventListener?.('voiceschanged', refreshVoices);
      };
    }
    return () => window.clearTimeout(timer);
  }, [detectedLanguage, voiceSettings.voiceURI]);

  useEffect(() => {
    return () => {
      sessionCtrlRef.current?.stopAll();
      abortStream();
      ttsService.stopSpeaking();
    };
  }, [abortStream]);

  const speakResponseText = useCallback(
    (
      text: string,
      lang: DetectedLanguage,
      rateOverride?: number,
      allowContinuousAfter?: boolean
    ) => {
      setTtsBlockedOrFailed(false);
      setLastAnswerForPlay({ text, lang });

      ttsService.speak(text, lang, {
        engine: voiceSettings.ttsEngine,
        voiceURI: voiceSettings.voiceURI,
        rate: rateOverride ?? voiceSettings.speechRate,
        onStart: (voiceInfo, locale) => {
          setStatus('speaking');
          setTtsBlockedOrFailed(false);
          setDiagnostics((prev) => ({
            ...prev,
            ttsStatus: 'SPEAKING',
            audioPlaybackStatus: 'PLAYING',
            selectedVoice: voiceInfo,
            detectedLanguage: `${formatLanguageTag(lang)} [${locale}]`,
          }));
        },
        onEnd: () => {
          setStatus('idle');
          setDiagnostics((prev) => ({
            ...prev,
            ttsStatus: 'WORKING',
            audioPlaybackStatus: 'COMPLETED',
          }));
          if (allowContinuousAfter && continuousRef.current) {
            setTimeout(() => {
              startMicRef.current?.();
            }, 300);
          }
        },
        onStatusChange: (st) => {
          setDiagnostics((prev) => ({
            ...prev,
            ttsStatus: st.ttsStatus === 'ERROR' ? 'FAILED' : st.ttsStatus === 'IDLE' ? 'WORKING' : st.ttsStatus,
            audioPlaybackStatus: st.playbackStatus,
            selectedVoice: st.selectedVoice,
            ttsProvider: st.provider,
            lastError: st.lastError || prev.lastError,
          }));
        },
        onError: (reason, isBlocked) => {
          setTtsBlockedOrFailed(true);
          setErrorMessage(reason);
          setStatus('error');
          setDiagnostics((prev) => ({
            ...prev,
            ttsStatus: isBlocked ? 'BLOCKED' : 'FAILED',
            audioPlaybackStatus: isBlocked ? 'BLOCKED' : 'ERROR',
            lastError: reason,
          }));
        },
      });
    },
    [voiceSettings.speechRate, voiceSettings.ttsEngine, voiceSettings.voiceURI]
  );

  const interruptAI = useCallback(
    (nextStatus: VoiceStateStatus = 'interrupted') => {
      abortStream();
      ttsService.stopSpeaking();
      setStatus(nextStatus);
      setDiagnostics((prev) => ({
        ...prev,
        ttsStatus: prev.ttsStatus === 'SPEAKING' || prev.ttsStatus === 'PAUSED' ? 'IDLE' : prev.ttsStatus,
        audioPlaybackStatus: 'IDLE',
      }));
    },
    [abortStream]
  );

  const pauseSpeaking = useCallback(() => {
    ttsService.pauseSpeaking();
    setStatus('paused');
  }, []);

  const resumeSpeaking = useCallback(() => {
    ttsService.resumeSpeaking();
    setStatus('speaking');
  }, []);

  const stopListening = useCallback(() => {
    if (sessionCtrlRef.current) {
      sessionCtrlRef.current.stopAll();
      sessionCtrlRef.current = null;
    }
    setAudioLevels(new Array(16).fill(0));
  }, []);

  const playLastAnswer = useCallback(() => {
    ttsService.unlockAudio();
    const target = lastAnswerForPlay || lastAiReplyRef.current;
    if (!target) return;
    speakResponseText(target.text, target.lang);
  }, [lastAnswerForPlay, speakResponseText]);

  const dispatchGeminiForContext = useCallback(
    async (ctx: FailedGeminiContext) => {
      lastFailedContextRef.current = ctx;
      setCanRetryGemini(false);
      setGeminiFailedError('');
      setErrorMessage('');

      // Stop any prior speech & cancel any prior streaming request cleanly
      ttsService.stopSpeaking();
      setStatus('thinking');
      setDiagnostics((prev) => ({
        ...prev,
        geminiStatus: 'THINKING',
        geminiModel: voiceSettings.modelName,
        lastRequestTime: new Date().toISOString(),
        lastError: 'None',
        lastErrorType: 'NONE',
      }));

      await askStreaming({
        message: ctx.text,
        languagePreference: ctx.effectiveLangPref,
        detectedLanguage: ctx.intent.language,
        history: activeConversation.messages,
        activeTopic: ctx.intent.intent,
        lastEntity: ctx.resolutionSymbol || activeConversation.lastEntity,
        marketContext: ctx.marketContext,
        detailRequested: ctx.intent.detailRequested,
        modelName: voiceSettings.modelName,
        onSentence: () => {
          // Wait for full Gemini response before speaking so script detection is exact
        },
        onComplete: (fullText, diag: GeminiDiagnosticDetails) => {
          if (!fullText || !fullText.trim()) {
            const emptyErr = 'Gemini unavailable — empty text returned. Please try again.';
            setGeminiFailedError(emptyErr);
            setErrorMessage(emptyErr);
            setCanRetryGemini(true);
            setStatus('error');
            setDiagnostics((prev) => ({
              ...prev,
              geminiStatus: 'ERROR',
              lastError: emptyErr,
              lastErrorType: 'RESPONSE_PARSE_ERROR',
              lastHttpStatus: diag.httpStatus,
              responseTimeMs: diag.responseTimeMs,
              retryCount: diag.retryCount,
              lastEndpoint: diag.endpoint,
            }));
            return;
          }

          lastFailedContextRef.current = null;
          setCanRetryGemini(false);
          setGeminiFailedError('');

          const responseLang =
            voiceSettings.language === 'auto'
              ? ttsService.detectResponseLanguage(fullText)
              : voiceSettings.language;

          setDetectedLanguage(responseLang);

          const aiMsg: VoiceChatMessage = {
            id: `vmsg-${Date.now()}-a`,
            role: 'assistant',
            text: fullText,
            timestamp: new Date().toISOString(),
            inputMode: ctx.inputMode,
            language: responseLang,
            intent: ctx.intent.intent,
            symbol: ctx.resolutionSymbol,
            isRealGemini: true,
            isDemoFallback: false,
            modelName: diag.modelName,
          };
          addMessage(aiMsg, ctx.intent.intent, ctx.resolutionSymbol || activeConversation.lastEntity);
          lastAiReplyRef.current = { text: fullText, lang: responseLang };
          setLastAnswerForPlay({ text: fullText, lang: responseLang });

          setDiagnostics((prev) => ({
            ...prev,
            geminiStatus: 'CONNECTED',
            geminiModel: diag.modelName,
            lastRequestTime: diag.requestStartTime,
            responseTimeMs: diag.responseTimeMs,
            lastHttpStatus: diag.httpStatus,
            retryCount: diag.retryCount,
            maxRetries: diag.maxRetries,
            timeoutMs: diag.timeoutDurationMs,
            lastErrorType: 'NONE',
            lastEndpoint: diag.endpoint,
            lastError: 'None',
            detectedLanguage: formatLanguageTag(responseLang),
          }));

          // Speak aloud automatically AFTER Gemini returns real text
          if (voiceSettings.autoSpeak) {
            speakResponseText(
              fullText,
              responseLang,
              ctx.effectiveRate,
              ctx.inputMode === 'voice'
            );
          } else {
            setStatus('idle');
          }
        },
        onError: (friendlyErr, diag: GeminiDiagnosticDetails) => {
          // NEVER hide Gemini failure behind simulated response!
          // Keep user's transcript, show clear error, allow Retry, and leave TTS status untouched.
          setGeminiFailedError(friendlyErr);
          setErrorMessage(friendlyErr);
          setCanRetryGemini(true);
          setStatus('error');
          setDiagnostics((prev) => ({
            ...prev,
            geminiStatus: diag.errorType === 'TIMEOUT' ? 'TIMEOUT' : 'ERROR',
            geminiModel: diag.modelName,
            lastRequestTime: diag.requestStartTime,
            responseTimeMs: diag.responseTimeMs,
            lastHttpStatus: diag.httpStatus,
            retryCount: diag.retryCount,
            maxRetries: diag.maxRetries,
            timeoutMs: diag.timeoutDurationMs,
            lastErrorType: diag.errorType,
            lastEndpoint: diag.endpoint,
            lastError: friendlyErr,
          }));
        },
      });
    },
    [
      activeConversation.lastEntity,
      activeConversation.messages,
      addMessage,
      askStreaming,
      speakResponseText,
      voiceSettings.autoSpeak,
      voiceSettings.language,
      voiceSettings.modelName,
    ]
  );

  const processUserUtterance = useCallback(
    async (rawInput: string, inputMode: 'voice' | 'text', confidence: number = 0.9) => {
      const text = rawInput.trim();
      if (!text) return;

      ttsService.unlockAudio();

      setErrorMessage('');
      setGeminiFailedError('');
      setTtsBlockedOrFailed(false);
      setLowConfidenceWarning(confidence < 0.65);

      const intent = routeVoiceCommand(
        text,
        voiceSettings.language,
        stocks,
        activeConversation.lastEntity
      );
      setDetectedLanguage(intent.language);
      setDiagnostics((prev) => ({
        ...prev,
        sttStatus: inputMode === 'voice' ? 'WORKING' : prev.sttStatus,
        detectedLanguage: formatLanguageTag(intent.language),
        ttsStatus: prev.ttsStatus === 'IDLE' ? 'UNLOCKED' : prev.ttsStatus,
      }));

      if (intent.action === 'STOP') {
        interruptAI('interrupted');
        return;
      }
      if (intent.action === 'PAUSE') {
        pauseSpeaking();
        return;
      }
      if (intent.action === 'RESUME') {
        resumeSpeaking();
        return;
      }
      if (intent.action === 'REPEAT' && lastAiReplyRef.current) {
        speakResponseText(lastAiReplyRef.current.text, lastAiReplyRef.current.lang);
        return;
      }

      // Add user transcript/message to conversation (stays preserved even if Gemini fails!)
      const userMsg: VoiceChatMessage = {
        id: `vmsg-${Date.now()}-u`,
        role: 'user',
        text,
        timestamp: new Date().toISOString(),
        inputMode,
        language: intent.language,
        intent: intent.intent,
        symbol: intent.symbol,
        confidence,
      };
      addMessage(userMsg, intent.intent, intent.symbol || activeConversation.lastEntity);

      if (intent.action === 'SLOWER') {
        setVoiceSettings((p) => ({ ...p, speechRate: 0.75 }));
      } else if (intent.action === 'SET_LANG_BN') {
        setVoiceSettings((p) => ({ ...p, language: 'bn' }));
      } else if (intent.action === 'SET_LANG_HI') {
        setVoiceSettings((p) => ({ ...p, language: 'hi' }));
      } else if (intent.action === 'SET_LANG_EN') {
        setVoiceSettings((p) => ({ ...p, language: 'en' }));
      } else if (intent.action === 'DARK_MODE') {
        onToggleTheme('dark');
      } else if (intent.action === 'LIGHT_MODE') {
        onToggleTheme('light');
      } else if (intent.action === 'NEW_CONVERSATION') {
        newConversation(intent.language);
      } else if (intent.action === 'CLEAR_CONVERSATION') {
        clearActiveMessages();
        return;
      } else if (intent.action === 'OPEN_WATCHLIST') {
        onNavigateTab('WATCHLIST');
      } else if (intent.action === 'OPEN_SETTINGS') {
        onNavigateTab('SETTINGS');
      } else if (intent.action === 'OPEN_JOURNAL') {
        onNavigateTab('TRADE JOURNAL');
      } else if (intent.action === 'OPEN_RISK_CALC') {
        onNavigateTab('RISK CALCULATOR');
      }

      let marketContext: VoiceStockJsonPayload | Record<string, unknown> | null = null;
      const resolution = resolveSymbolFromSpeech(text, stocks, activeConversation.lastEntity);

      if (resolution.isMarketOverview) {
        marketContext = buildMarketBreadthJson(stocks, dataSourceMeta);
      } else if (resolution.symbol) {
        const matchedStock = stocks.find((s) => s.raw.symbol === resolution.symbol);
        if (matchedStock) {
          const stockPayload = buildVoiceStockJson(matchedStock, dataSourceMeta);
          marketContext = stockPayload;
          setActiveMarketPayload(stockPayload);
          onSelectStock(matchedStock.raw.symbol);
        }
      }

      const effectiveRate = intent.action === 'SLOWER' ? 0.75 : voiceSettings.speechRate;
      const effectiveLangPref =
        intent.action === 'SET_LANG_BN'
          ? 'bn'
          : intent.action === 'SET_LANG_HI'
          ? 'hi'
          : intent.action === 'SET_LANG_EN'
          ? 'en'
          : voiceSettings.language;

      await dispatchGeminiForContext({
        text,
        inputMode,
        intent,
        resolutionSymbol: resolution.symbol,
        marketContext,
        effectiveRate,
        effectiveLangPref,
      });
    },
    [
      activeConversation.lastEntity,
      addMessage,
      clearActiveMessages,
      dataSourceMeta,
      dispatchGeminiForContext,
      interruptAI,
      newConversation,
      onNavigateTab,
      onSelectStock,
      onToggleTheme,
      pauseSpeaking,
      resumeSpeaking,
      speakResponseText,
      stocks,
      voiceSettings.language,
      voiceSettings.speechRate,
    ]
  );

  const retryLastGeminiRequest = useCallback(async () => {
    ttsService.unlockAudio();
    const ctx = lastFailedContextRef.current;
    if (!ctx) return;
    await dispatchGeminiForContext(ctx);
  }, [dispatchGeminiForContext]);

  const generateExplicitDemoFallback = useCallback(() => {
    ttsService.unlockAudio();
    const ctx = lastFailedContextRef.current;
    if (!ctx) return;

    const demoText = buildExplicitDemoReply(ctx.text, ctx.intent.language, ctx.marketContext);
    const aiMsg: VoiceChatMessage = {
      id: `vmsg-${Date.now()}-demo`,
      role: 'assistant',
      text: demoText,
      timestamp: new Date().toISOString(),
      inputMode: ctx.inputMode,
      language: ctx.intent.language,
      intent: ctx.intent.intent,
      symbol: ctx.resolutionSymbol,
      isRealGemini: false,
      isDemoFallback: true,
    };
    addMessage(aiMsg, ctx.intent.intent, ctx.resolutionSymbol || activeConversation.lastEntity);
    lastAiReplyRef.current = { text: demoText, lang: ctx.intent.language };
    setLastAnswerForPlay({ text: demoText, lang: ctx.intent.language });
    setErrorMessage('');
    setGeminiFailedError('');
    setCanRetryGemini(false);

    if (voiceSettings.autoSpeak) {
      speakResponseText(demoText, ctx.intent.language, ctx.effectiveRate, false);
    } else {
      setStatus('idle');
    }
  }, [activeConversation.lastEntity, addMessage, speakResponseText, voiceSettings.autoSpeak]);

  const runConnectionTest = useCallback(async () => {
    setIsTestingConnection(true);
    setDiagnostics((prev) => ({
      ...prev,
      geminiStatus: 'THINKING',
      geminiModel: voiceSettings.modelName,
      lastRequestTime: new Date().toISOString(),
    }));

    const result = await testGeminiConnection(voiceSettings.modelName);
    setConnectionTestResult(result);
    setIsTestingConnection(false);

    setDiagnostics((prev) => ({
      ...prev,
      geminiStatus: result.ok
        ? 'CONNECTED'
        : result.errorType === 'TIMEOUT'
        ? 'TIMEOUT'
        : 'ERROR',
      geminiModel: result.modelName,
      apiKeyConfigured:
        typeof result.apiConfigured === 'boolean' ? result.apiConfigured : prev.apiKeyConfigured,
      apiEnvSource: result.envSource || prev.apiEnvSource,
      lastRequestTime: result.requestStartTime,
      responseTimeMs: result.responseTimeMs,
      lastHttpStatus: result.httpStatus,
      retryCount: result.retryCount,
      maxRetries: result.maxRetries,
      timeoutMs: result.timeoutDurationMs,
      lastErrorType: result.errorType,
      lastEndpoint: result.endpoint,
      lastError: result.ok ? 'None' : `[${result.errorType}] ${result.errorMessage}`,
    }));

    return result;
  }, [voiceSettings.modelName]);

  const startListening = useCallback(async () => {
    ttsService.unlockAudio();

    setErrorMessage('');
    setInterimTranscript('');

    if (status === 'speaking' || status === 'thinking' || status === 'paused') {
      if (voiceSettings.interruptAi) {
        interruptAI('interrupted');
      } else {
        return;
      }
    }

    stopListening();

    try {
      setStatus('listening');
      setDiagnostics((prev) => ({
        ...prev,
        sttStatus: 'LISTENING',
        ttsStatus: prev.ttsStatus === 'IDLE' ? 'UNLOCKED' : prev.ttsStatus,
        lastError: 'None',
      }));
      let capturedFinal = false;

      const ctrl = await startVoiceInputSession(
        voiceSettings.language,
        {
          onInterim: (interim) => {
            setInterimTranscript(interim);
          },
          onFinal: (finalStr, conf) => {
            capturedFinal = true;
            setInterimTranscript('');
            setTranscript(finalStr);
            processUserUtterance(finalStr, 'voice', conf);
          },
          onError: (err) => {
            setErrorMessage(err);
            setStatus('error');
            setDiagnostics((prev) => ({
              ...prev,
              sttStatus: 'FAILED',
              lastError: err,
            }));
          },
          onEnd: () => {
            sessionCtrlRef.current = null;
            if (!capturedFinal) {
              setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
            }
          },
        },
        (levels) => setAudioLevels(levels)
      );

      sessionCtrlRef.current = ctrl;
    } catch (err: any) {
      const msg = err?.message || 'Microphone access is unavailable. You can continue using text chat.';
      setErrorMessage(msg);
      setStatus('error');
      setDiagnostics((prev) => ({
        ...prev,
        sttStatus: 'UNAVAILABLE',
        lastError: msg,
      }));
    }
  }, [
    interruptAI,
    processUserUtterance,
    status,
    stopListening,
    voiceSettings.interruptAi,
    voiceSettings.language,
  ]);

  const startMicRef = useRef<(() => Promise<void>) | null>(null);
  startMicRef.current = startListening;

  const toggleMic = useCallback(() => {
    if (status === 'listening') {
      sessionCtrlRef.current?.sttHandle.stop();
      setAudioLevels(new Array(16).fill(0));
    } else {
      startListening();
    }
  }, [startListening, status]);

  const runDirectTtsTest = useCallback(
    (sampleText: string, lang: DetectedLanguage) => {
      ttsService.unlockAudio();
      speakResponseText(sampleText, lang);
    },
    [speakResponseText]
  );

  const voiceSession: VoiceSession = {
    status,
    language: voiceSettings.language,
    detectedLanguage,
    transcript,
    interimTranscript,
    lowConfidenceWarning,
    error: errorMessage || undefined,
  };

  const dismissError = useCallback(() => {
    setErrorMessage('');
    setGeminiFailedError('');
    setTtsBlockedOrFailed(false);
    setStatus((prev) => (prev === 'error' ? 'idle' : prev));
  }, []);

  return {
    voiceSession,
    voiceSettings,
    setVoiceSettings,
    diagnostics,
    lastDiagnostic,
    geminiFailedError,
    canRetryGemini,
    isTestingConnection,
    connectionTestResult,
    runConnectionTest,
    retryLastGeminiRequest,
    generateExplicitDemoFallback,
    ttsBlockedOrFailed,
    hasPlayableAnswer: Boolean(lastAnswerForPlay || lastAiReplyRef.current),
    audioLevels,
    availableVoices,
    streamingText,
    isStreaming,
    activeMarketPayload,
    conversations,
    activeConversation,
    setActiveId,
    newConversation,
    renameConversation,
    deleteConversation,
    clearActiveMessages,
    exportActiveJson,
    editMessageText,
    deleteMessage,
    toggleMic,
    startListening,
    interruptAI,
    stopAiAndStream: interruptAI,
    pauseSpeaking,
    resumeSpeaking,
    playLastAnswer,
    runDirectTtsTest,
    speakText: (txt: string, lang: DetectedLanguage) => {
      ttsService.unlockAudio();
      speakResponseText(txt, lang);
    },
    dismissError,
    sendTextMessage: (text: string) => processUserUtterance(text, 'text', 1.0),
    simulateVoicePhrase: (phrase: string) => processUserUtterance(phrase, 'voice', 0.96),
  };
}

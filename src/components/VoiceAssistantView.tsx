import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit2,
  FlaskConical,
  History,
  Keyboard,
  MessageSquarePlus,
  Mic,
  Play,
  Search,
  Settings2,
  ShieldAlert,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnalyzedStock, AppSettings, DataSourceMetadata } from '../types/trading';
import { useVoice } from '../hooks/useVoice';
import { routeVoiceCommand } from '../services/voiceCommandRouter';
import { VoiceButton } from './VoiceButton';
import { VoiceWaveform } from './VoiceWaveform';
import { VoiceStatus } from './VoiceStatus';
import { LanguageSelector } from './LanguageSelector';
import { TranscriptPanel } from './TranscriptPanel';
import { QuickCommands } from './QuickCommands';
import { ChatWindow } from './ChatWindow';
import { DataIntegrityPanel } from './DataIntegrityPanel';
import { VoiceSettings } from './VoiceSettings';
import { VoiceDebugPanel } from './VoiceDebugPanel';

interface Props {
  stocks: AnalyzedStock[];
  dataSourceMeta: DataSourceMetadata;
  settings: AppSettings;
  aiStatus: {
    available: boolean;
    modelName: string;
    message: string;
    supportedModels?: string[];
  };
  onNavigateTab: (tab: string) => void;
  onSelectStock: (symbol: string) => void;
  onToggleTheme: (mode: 'dark' | 'light') => void;
}

interface Section40TestCase {
  id: number;
  phrase: string;
  expectedLang: 'bn' | 'en' | 'bn-en';
  expectedIntentOrAction: string;
  description: string;
}

const SECTION_40_TEST_CASES: Section40TestCase[] = [
  { id: 1, phrase: 'Hello, how are you?', expectedLang: 'en', expectedIntentOrAction: 'GENERAL_CHAT', description: 'English greeting' },
  { id: 2, phrase: 'আজ কেমন আছো?', expectedLang: 'bn', expectedIntentOrAction: 'GENERAL_CHAT', description: 'Bengali greeting' },
  { id: 3, phrase: 'আজ market কেমন?', expectedLang: 'bn-en', expectedIntentOrAction: 'MARKET_STATUS', description: 'Bengali-English mixed market check' },
  { id: 4, phrase: 'Please explain Nifty in Bengali.', expectedLang: 'bn', expectedIntentOrAction: 'MARKET_STATUS', description: 'Explicit Bengali language switch' },
  { id: 5, phrase: 'HDFC Bank-এর RSI কত?', expectedLang: 'bn-en', expectedIntentOrAction: 'STOCK_ANALYSIS:HDFCBANK', description: 'Stock symbol extraction in Mixed language' },
  { id: 6, phrase: 'EMA 20 আর EMA 50-এর difference explain করো.', expectedLang: 'bn-en', expectedIntentOrAction: 'GENERAL_CHAT', description: 'Technical concepts in Mixed Banglish' },
  { id: 7, phrase: 'English-এ আবার বলুন.', expectedLang: 'en', expectedIntentOrAction: 'SET_LANG_EN', description: 'Dynamic switch to English' },
  { id: 8, phrase: 'এটা একটু সহজ করে বলুন.', expectedLang: 'bn', expectedIntentOrAction: 'GENERAL_CHAT', description: 'Bengali simpler explanation request' },
  { id: 9, phrase: 'Stop.', expectedLang: 'en', expectedIntentOrAction: 'STOP', description: 'Immediate TTS/Stream Stop command' },
  { id: 10, phrase: 'আবার বলুন.', expectedLang: 'bn', expectedIntentOrAction: 'REPEAT', description: 'Bengali Repeat command' },
  { id: 11, phrase: 'What can you do?', expectedLang: 'en', expectedIntentOrAction: 'HELP', description: 'Capabilities / Help intent' },
  { id: 12, phrase: 'আমার watchlist দেখাও.', expectedLang: 'bn-en', expectedIntentOrAction: 'OPEN_WATCHLIST', description: 'Mixed language Watchlist navigation' },
];

export const VoiceAssistantView: React.FC<Props> = ({
  stocks,
  dataSourceMeta,
  settings,
  aiStatus,
  onNavigateTab,
  onSelectStock,
  onToggleTheme,
}) => {
  const {
    voiceSession,
    voiceSettings,
    setVoiceSettings,
    diagnostics,
    geminiFailedError,
    canRetryGemini,
    isTestingConnection,
    connectionTestResult,
    runConnectionTest,
    retryLastGeminiRequest,
    generateExplicitDemoFallback,
    ttsBlockedOrFailed,
    hasPlayableAnswer,
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
    interruptAI,
    pauseSpeaking,
    resumeSpeaking,
    playLastAnswer,
    runDirectTtsTest,
    speakText,
    dismissError,
    sendTextMessage,
    simulateVoicePhrase,
  } = useVoice({
    stocks,
    dataSourceMeta,
    defaultModelName: aiStatus.modelName || settings.aiModelName,
    onNavigateTab,
    onSelectStock,
    onToggleTheme,
  });

  const [inputModePreference, setInputModePreference] = useState<'text-voice' | 'mic-voice'>('text-voice');
  const [rightPanelTab, setRightPanelTab] = useState<'controls' | 'history' | 'qa'>('controls');
  const [historySearch, setHistorySearch] = useState('');
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [qaResults, setQaResults] = useState<
    { id: number; phrase: string; passed: boolean; details: string }[] | null
  >(null);

  const filteredConversations = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.text.toLowerCase().includes(q))
    );
  }, [conversations, historySearch]);

  const handleExportJson = () => {
    const content = exportActiveJson();
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeConversation.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runSection40Suite = () => {
    const results = SECTION_40_TEST_CASES.map((tc) => {
      const routed = routeVoiceCommand(tc.phrase, 'auto', stocks, activeConversation.lastEntity);
      const actualTag =
        routed.intent === 'MARKET_STATUS' && routed.action === 'SET_LANG_BN'
          ? 'MARKET_STATUS'
          : routed.action !== 'NONE'
          ? routed.action
          : routed.symbol && routed.intent === 'STOCK_ANALYSIS'
          ? `STOCK_ANALYSIS:${routed.symbol}`
          : routed.intent;

      const langOk = routed.language === tc.expectedLang;
      const intentOk = actualTag === tc.expectedIntentOrAction;
      return {
        id: tc.id,
        phrase: tc.phrase,
        passed: langOk && intentOk,
        details: `Lang: ${routed.language} (exp ${tc.expectedLang}) · Route: ${actualTag} (exp ${tc.expectedIntentOrAction})`,
      };
    });
    setQaResults(results);
  };

  const supportedModels =
    aiStatus.supportedModels && aiStatus.supportedModels.length > 0
      ? aiStatus.supportedModels
      : ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];

  const showTopErrorBanner = !aiStatus.available || Boolean(geminiFailedError);

  return (
    <div className="space-y-4">
      {/* Real Gemini Connectivity Banner (NEVER hides failures behind silent demo fallback) */}
      {showTopErrorBanner && (
        <div className="rounded-xl border border-red-400/60 bg-red-50 dark:bg-red-950/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-red-900 dark:text-red-200">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
            {!aiStatus.available ? (
              <span>
                <strong>GEMINI UNAVAILABLE:</strong>{' '}
                <code className="font-mono font-semibold">GEMINI_API_KEY</code> is not configured on the server. Add it in <strong>Settings &gt; Secrets</strong> or <code className="font-mono font-semibold">.env.local</code>.
              </span>
            ) : (
              <span className="break-words">
                <strong>GEMINI REQUEST FAILED:</strong> {geminiFailedError}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canRetryGemini && (
              <button
                type="button"
                onClick={retryLastGeminiRequest}
                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
              >
                Retry Gemini
              </button>
            )}
            <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-red-200/70 dark:bg-red-900/60">
              No Silent Fallback
            </span>
          </div>
        </div>
      )}

      {/* Main Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left / Center Voice Stage + Transcript Feed */}
        <div className="lg:col-span-8 space-y-4">
          {/* Interactive Voice & Text Stage */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Real-Time Multilingual Voice & Text Assistant (বাংলা / हिंदी / English / Mixed)
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Speak or type in বাংলা, हिंदी, English, or mixed speech — Gemini answers in text and speaks aloud automatically.
                </p>
              </div>
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    dismissError();
                    setInputModePreference('text-voice');
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded cursor-pointer transition-colors ${
                    inputModePreference === 'text-voice'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  Text + AI Voice (No Mic)
                </button>
                <button
                  type="button"
                  onClick={() => setInputModePreference('mic-voice')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded cursor-pointer transition-colors ${
                    inputModePreference === 'mic-voice'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  Mic (Optional)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <LanguageSelector
                value={voiceSettings.language}
                onChange={(lang) => setVoiceSettings((prev) => ({ ...prev, language: lang }))}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setVoiceSettings((prev) => ({ ...prev, autoSpeak: !prev.autoSpeak }))
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer transition-colors ${
                    voiceSettings.autoSpeak
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                  title="AI speaks every reply aloud automatically"
                >
                  {voiceSettings.autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  AI Voice Output: {voiceSettings.autoSpeak ? 'ON' : 'OFF'}
                </button>

                {inputModePreference === 'mic-voice' && (
                  <button
                    type="button"
                    onClick={() =>
                      setVoiceSettings((prev) => ({
                        ...prev,
                        continuousConversation: !prev.continuousConversation,
                        autoSpeak: true,
                      }))
                    }
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer transition-colors ${
                      voiceSettings.continuousConversation
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                    title="Automatically re-listen after AI finishes speaking when using a microphone"
                  >
                    Continuous Mic: {voiceSettings.continuousConversation ? 'ON' : 'OFF'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
              {inputModePreference === 'mic-voice' && (
                <VoiceButton status={voiceSession.status} onClick={toggleMic} />
              )}
              <div className="flex-1 w-full space-y-2.5">
                <VoiceStatus
                  status={voiceSession.status}
                  detectedLanguage={voiceSession.detectedLanguage}
                  hasPlayableAnswer={hasPlayableAnswer}
                  ttsBlockedOrFailed={ttsBlockedOrFailed}
                  canRetryGemini={canRetryGemini}
                  onInterrupt={() => interruptAI('interrupted')}
                  onPause={pauseSpeaking}
                  onResume={resumeSpeaking}
                  onPlayAnswer={playLastAnswer}
                  onRetryGemini={retryLastGeminiRequest}
                  onUseExplicitDemo={generateExplicitDemoFallback}
                  onRetryMic={inputModePreference === 'mic-voice' ? toggleMic : undefined}
                  onUseNoMicMode={() => {
                    dismissError();
                    setInputModePreference('text-voice');
                  }}
                  error={voiceSession.error}
                />
                <VoiceWaveform levels={audioLevels} status={voiceSession.status} />
              </div>
            </div>

            {inputModePreference === 'mic-voice' && (
              <TranscriptPanel
                interimTranscript={voiceSession.interimTranscript}
                finalTranscript={voiceSession.transcript}
                lowConfidenceWarning={voiceSession.lowConfidenceWarning}
              />
            )}
          </div>

          {/* Home Greeting & Quick Commands */}
          <QuickCommands onSelectCommand={(phrase) => sendTextMessage(phrase)} />

          {/* Conversation Transcript & Primary Text + Voice Composer */}
          <ChatWindow
            messages={activeConversation.messages}
            streamingText={streamingText}
            isStreaming={isStreaming}
            voiceStatus={voiceSession.status}
            autoSpeak={voiceSettings.autoSpeak}
            showMicButton={inputModePreference === 'mic-voice'}
            onToggleAutoSpeak={() =>
              setVoiceSettings((prev) => ({ ...prev, autoSpeak: !prev.autoSpeak }))
            }
            onSendText={(txt) => sendTextMessage(txt)}
            onToggleMic={toggleMic}
            onReplay={(txt, lang) => speakText(txt, lang)}
            onEditMessage={editMessageText}
            onDeleteMessage={deleteMessage}
          />
        </div>

        {/* Right Sidebar: Controls, History & Verification Suite */}
        <div className="lg:col-span-4 space-y-3">
          {/* Sidebar Mode Switcher */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setRightPanelTab('controls')}
              className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer ${
                rightPanelTab === 'controls'
                  ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" /> Settings
            </button>
            <button
              type="button"
              onClick={() => setRightPanelTab('history')}
              className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer ${
                rightPanelTab === 'history'
                  ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <History className="w-3.5 h-3.5" /> History ({conversations.length})
            </button>
            <button
              type="button"
              onClick={() => setRightPanelTab('qa')}
              className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer ${
                rightPanelTab === 'qa'
                  ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" /> 12 Tests
            </button>
          </div>

          {/* Live Gemini & Voice Diagnostics Panel always visible */}
          <VoiceDebugPanel
            diagnostics={diagnostics}
            availableVoices={availableVoices}
            isTestingConnection={isTestingConnection}
            connectionTestResult={connectionTestResult}
            onTestConnection={runConnectionTest}
            onTestTts={runDirectTtsTest}
          />

          {/* Data Integrity Panel always visible */}
          <DataIntegrityPanel
            dataSourceMeta={dataSourceMeta}
            activeMarketPayload={activeMarketPayload}
          />

          {rightPanelTab === 'controls' && (
            <VoiceSettings
              settings={voiceSettings}
              onUpdate={setVoiceSettings}
              availableVoices={availableVoices}
              supportedModels={supportedModels}
            />
          )}

          {rightPanelTab === 'history' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  Saved Conversations
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => newConversation(voiceSettings.language)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold cursor-pointer"
                  >
                    <MessageSquarePlus className="w-3 h-3" /> New
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-[10px] font-semibold cursor-pointer"
                    title="Export conversation JSON"
                  >
                    <Download className="w-3 h-3" /> Export
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search transcripts..."
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-2.5 py-1.5 text-[11px]"
                />
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {filteredConversations.map((c) => {
                  const isActive = c.id === activeConversation.id;
                  return (
                    <div
                      key={c.id}
                      className={`p-2 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                        isActive
                          ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        {editingTitleId === c.id ? (
                          <input
                            type="text"
                            value={titleDraft}
                            onChange={(e) => setTitleDraft(e.target.value)}
                            onBlur={() => {
                              renameConversation(c.id, titleDraft);
                              setEditingTitleId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                renameConversation(c.id, titleDraft);
                                setEditingTitleId(null);
                              }
                            }}
                            autoFocus
                            className="w-full rounded border border-emerald-500 px-1.5 py-0.5 text-[11px] bg-white dark:bg-slate-900"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveId(c.id)}
                            className="text-left w-full cursor-pointer"
                          >
                            <div className="font-semibold truncate text-slate-900 dark:text-slate-100">
                              {c.title}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {c.messages.length} msgs · Topic: {c.activeTopic}
                              {c.lastEntity ? ` (${c.lastEntity})` : ''}
                            </div>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTitleId(c.id);
                            setTitleDraft(c.title);
                          }}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteConversation(c.id)}
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/60 text-red-600 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={clearActiveMessages}
                  className="text-[10px] text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                >
                  Clear active session messages
                </button>
              </div>
            </div>
          )}

          {rightPanelTab === 'qa' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    Section 40 Test Cases (12 Phrases)
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Tests Bengali, English, Mixed, Interrupt & Navigation
                  </div>
                </div>
                <button
                  type="button"
                  onClick={runSection40Suite}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold cursor-pointer"
                >
                  <Play className="w-3 h-3" /> Run All 12
                </button>
              </div>

              {qaResults && (
                <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Passed {qaResults.filter((r) => r.passed).length} / {qaResults.length} Bilingual Routing Checks
                  </span>
                </div>
              )}

              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {SECTION_40_TEST_CASES.map((tc) => {
                  const res = qaResults?.find((r) => r.id === tc.id);
                  return (
                    <div
                      key={tc.id}
                      className="p-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-1 text-[11px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {tc.id}. "{tc.phrase}"
                        </span>
                        <button
                          type="button"
                          onClick={() => simulateVoicePhrase(tc.phrase)}
                          className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-[10px] font-semibold cursor-pointer shrink-0"
                        >
                          Speak/Run
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {tc.description}
                      </div>
                      {res && (
                        <div
                          className={`text-[10px] font-mono ${
                            res.passed
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          [{res.passed ? 'PASS' : 'FAIL'}] {res.details}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export type VoiceStateStatus =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'paused'
  | 'interrupted'
  | 'error';

export type LanguagePreference =
  | 'auto'
  | 'bn'
  | 'en'
  | 'hi'
  | 'bn-en'
  | 'hi-en'
  | 'bn-hi-en';

export type DetectedLanguage =
  | 'bn'
  | 'en'
  | 'hi'
  | 'bn-en'
  | 'hi-en'
  | 'bn-hi-en';

export type VoiceIntentType =
  | 'GENERAL_CHAT'
  | 'MARKET_STATUS'
  | 'STOCK_ANALYSIS'
  | 'WATCHLIST'
  | 'RISK_CALCULATOR'
  | 'JOURNAL'
  | 'SETTINGS'
  | 'HELP';

export type VoiceActionCommand =
  | 'NONE'
  | 'STOP'
  | 'PAUSE'
  | 'RESUME'
  | 'REPEAT'
  | 'SLOWER'
  | 'SET_LANG_BN'
  | 'SET_LANG_EN'
  | 'SET_LANG_HI'
  | 'DARK_MODE'
  | 'LIGHT_MODE'
  | 'OPEN_WATCHLIST'
  | 'OPEN_SETTINGS'
  | 'OPEN_JOURNAL'
  | 'OPEN_RISK_CALC'
  | 'CLEAR_CONVERSATION'
  | 'NEW_CONVERSATION';

export type GeminiErrorType =
  | 'NONE'
  | 'INVALID_API_KEY'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'MODEL_NOT_FOUND'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_REQUEST'
  | 'SERVER_ERROR'
  | 'RESPONSE_PARSE_ERROR'
  | 'UNKNOWN_ERROR';

export interface GeminiDiagnosticDetails {
  errorType: GeminiErrorType;
  httpStatus: number;
  endpoint: string;
  modelName: string;
  requestStartTime: string;
  responseTimeMs: number;
  timeoutDurationMs: number;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
  apiConfigured?: boolean;
  envSource?: string;
}

export interface GeminiConnectionTestResult extends GeminiDiagnosticDetails {
  ok: boolean;
  status: 'SUCCESS' | 'FAILED';
  message: string;
  replyPreview?: string;
}

export interface VoiceIntent {
  intent: VoiceIntentType;
  action: VoiceActionCommand;
  symbol?: string;
  language: DetectedLanguage;
  detailRequested: boolean;
  confidence: number;
}

export interface VoiceSession {
  status: VoiceStateStatus;
  language: LanguagePreference;
  detectedLanguage: DetectedLanguage;
  transcript: string;
  interimTranscript: string;
  confidence?: number;
  lowConfidenceWarning?: boolean;
  error?: string;
}

export interface VoiceSettingsConfig {
  language: LanguagePreference;
  ttsEngine: 'browser' | 'gemini-neural';
  voiceURI: string; // 'auto' or specific SpeechSynthesisVoice.voiceURI or Gemini prebuilt name
  speechRate: 0.75 | 1.0 | 1.25 | 1.5;
  autoSpeak: boolean;
  interruptAi: boolean;
  continuousConversation: boolean;
  saveHistory: boolean;
  modelName: string;
}

export interface VoiceDiagnosticsState {
  sttStatus: 'IDLE' | 'LISTENING' | 'WORKING' | 'UNAVAILABLE' | 'FAILED';
  geminiStatus: 'IDLE' | 'THINKING' | 'CONNECTED' | 'TIMEOUT' | 'ERROR';
  ttsStatus: 'IDLE' | 'UNLOCKED' | 'SPEAKING' | 'PAUSED' | 'WORKING' | 'BLOCKED' | 'FAILED';
  selectedVoice: string;
  detectedLanguage: string;
  lastError: string;
  audioPlaybackStatus: 'IDLE' | 'PLAYING' | 'PAUSED' | 'BLOCKED' | 'COMPLETED' | 'ERROR';
  ttsProvider: string;
  // Detailed Gemini proxy diagnostics (never includes API key)
  geminiModel: string;
  apiKeyConfigured: boolean;
  apiEnvSource: string;
  lastRequestTime: string;
  responseTimeMs: number | null;
  lastHttpStatus: number | null;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
  lastErrorType: GeminiErrorType;
  lastEndpoint: string;
}

export interface VoiceStockJsonPayload {
  symbol: string;
  companyName: string;
  exchange: string;
  timestamp: string;
  dataStatus: 'LIVE' | 'DELAYED' | 'STALE' | 'MISSING' | 'ERROR';
  sourceLabel: string;
  price: number | null;
  pctChange: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi14: number | null;
  macd: {
    line: number | null;
    signal: number | null;
    histogram: number | null;
  };
  volumeRatio: number | null;
  atr14: number | null;
  support: number[];
  resistance: number[];
  liquidityStatus: string;
  fundamentalScore: number | null;
  setupStatus: string;
  missingCandles: number;
  corporateActionAdjusted: boolean;
}

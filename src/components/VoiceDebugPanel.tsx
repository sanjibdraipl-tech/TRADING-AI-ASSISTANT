import React from 'react';
import { Activity, CheckCircle2, Loader2, PlugZap, Volume2, XCircle } from 'lucide-react';
import {
  DetectedLanguage,
  GeminiConnectionTestResult,
  VoiceDiagnosticsState,
} from '../types/voice';

interface Props {
  diagnostics: VoiceDiagnosticsState;
  availableVoices: SpeechSynthesisVoice[];
  isTestingConnection: boolean;
  connectionTestResult: GeminiConnectionTestResult | null;
  onTestConnection: () => void;
  onTestTts: (sampleText: string, lang: DetectedLanguage) => void;
}

export const VoiceDebugPanel: React.FC<Props> = ({
  diagnostics,
  availableVoices,
  isTestingConnection,
  connectionTestResult,
  onTestConnection,
  onTestTts,
}) => {
  const indianVoicesCount = availableVoices.filter((v) =>
    /^(bn|hi|en-in)/i.test(v.lang)
  ).length;

  const statusColor = (val: string) => {
    if (
      val === 'WORKING' ||
      val === 'CONNECTED' ||
      val === 'SPEAKING' ||
      val === 'PLAYING' ||
      val === 'COMPLETED' ||
      val === 'UNLOCKED'
    ) {
      return 'text-emerald-700 dark:text-emerald-400 font-bold';
    }
    if (val === 'THINKING' || val === 'LISTENING' || val === 'PAUSED') {
      return 'text-amber-700 dark:text-amber-400 font-bold';
    }
    if (
      val === 'FAILED' ||
      val === 'ERROR' ||
      val === 'TIMEOUT' ||
      val === 'BLOCKED' ||
      val === 'UNAVAILABLE'
    ) {
      return 'text-red-600 dark:text-red-400 font-bold';
    }
    return 'text-slate-700 dark:text-slate-300 font-semibold';
  };

  const isGeminiConnected = diagnostics.geminiStatus === 'CONNECTED';
  const isGeminiFailed =
    diagnostics.geminiStatus === 'ERROR' || diagnostics.geminiStatus === 'TIMEOUT';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
          <Activity className="w-4 h-4 text-emerald-600" />
          <span>Gemini & Voice Debug Panel</span>
        </div>
        <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold">
          <span
            className={`w-2 h-2 rounded-full ${
              isGeminiConnected
                ? 'bg-emerald-500'
                : isGeminiFailed
                ? 'bg-red-500'
                : diagnostics.geminiStatus === 'THINKING'
                ? 'bg-amber-500'
                : 'bg-slate-400'
            }`}
          />
          <span
            className={
              isGeminiConnected
                ? 'text-emerald-700 dark:text-emerald-400'
                : isGeminiFailed
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-600 dark:text-slate-400'
            }
          >
            {isGeminiConnected
              ? 'Gemini Connected'
              : isGeminiFailed
              ? 'Gemini Failed'
              : diagnostics.geminiStatus === 'THINKING'
              ? 'Testing / Thinking'
              : 'Idle (Untested)'}
          </span>
        </div>
      </div>

      {/* Requirement 13: TEST GEMINI CONNECTION button */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={onTestConnection}
          disabled={isTestingConnection}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-bold tracking-wide cursor-pointer transition-colors"
        >
          {isTestingConnection ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Testing Gemini Connection...
            </>
          ) : (
            <>
              <PlugZap className="w-3.5 h-3.5" />
              TEST GEMINI CONNECTION
            </>
          )}
        </button>

        {connectionTestResult && (
          <div
            className={`p-2.5 rounded-lg border text-[11px] font-mono space-y-0.5 ${
              connectionTestResult.ok
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                : 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              {connectionTestResult.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              )}
              <span>{connectionTestResult.status}</span>
            </div>
            {connectionTestResult.ok ? (
              <>
                <div>Gemini API reachable</div>
                <div>
                  Model responding ({connectionTestResult.modelName}: "
                  {connectionTestResult.replyPreview || 'OK'}")
                </div>
                <div>Response time: {connectionTestResult.responseTimeMs} ms</div>
              </>
            ) : (
              <>
                <div className="break-words">
                  Reason: {connectionTestResult.errorType} — {connectionTestResult.errorMessage}
                </div>
                <div>
                  HTTP status: {connectionTestResult.httpStatus || 0} · Retries:{' '}
                  {connectionTestResult.retryCount}/{connectionTestResult.maxRetries}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Separate STT / GEMINI / TTS + Proxy Telemetry */}
      <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-950/60">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">STT</div>
          <div className={statusColor(diagnostics.sttStatus)}>{diagnostics.sttStatus}</div>
        </div>
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-950/60">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">GEMINI</div>
          <div className={statusColor(diagnostics.geminiStatus)}>{diagnostics.geminiStatus}</div>
        </div>
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-950/60">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">TTS</div>
          <div className={statusColor(diagnostics.ttsStatus)}>{diagnostics.ttsStatus}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-950/60">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Model</div>
          <div className="text-slate-900 dark:text-slate-100 truncate">{diagnostics.geminiModel}</div>
        </div>
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-950/60">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">API Key</div>
          <div
            className={
              diagnostics.apiKeyConfigured
                ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                : 'text-red-600 dark:text-red-400 font-bold'
            }
          >
            {diagnostics.apiKeyConfigured ? 'configured' : 'missing'}
          </div>
        </div>
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-950/60">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Last Request</div>
          <div className="text-slate-800 dark:text-slate-200 truncate">
            {diagnostics.lastRequestTime === 'Never'
              ? 'Never'
              : new Date(diagnostics.lastRequestTime).toLocaleTimeString()}
          </div>
        </div>
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-950/60">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Response Time</div>
          <div className="text-slate-800 dark:text-slate-200">
            {diagnostics.responseTimeMs !== null ? `${diagnostics.responseTimeMs} ms` : '—'}
          </div>
        </div>
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-950/60">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Last HTTP Status</div>
          <div className="text-slate-800 dark:text-slate-200">
            {diagnostics.lastHttpStatus !== null ? diagnostics.lastHttpStatus : '—'}
          </div>
        </div>
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-950/60">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Retry</div>
          <div className="text-slate-800 dark:text-slate-200">
            {diagnostics.retryCount}/{diagnostics.maxRetries}
          </div>
        </div>
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-950/60 col-span-2">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            Audio Playback ({diagnostics.ttsProvider}) · {availableVoices.length} voices (
            {indianVoicesCount} IN)
          </div>
          <div className="text-slate-800 dark:text-slate-200 truncate">
            {diagnostics.audioPlaybackStatus} · {diagnostics.selectedVoice}
          </div>
        </div>
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-950/60 col-span-2">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            Last Error ({diagnostics.lastErrorType})
          </div>
          <div
            className={
              diagnostics.lastError !== 'None'
                ? 'text-red-600 dark:text-red-400 break-words'
                : 'text-emerald-700 dark:text-emerald-400'
            }
          >
            {diagnostics.lastError}
          </div>
        </div>
      </div>

      {/* Browser TTS Verification */}
      <div className="space-y-1.5 pt-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Live Browser TTS Audio Verification (Independent of Gemini)
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() =>
              onTestTts('নমস্কার, আমি আপনার AI assistant. আজ Nifty এবং RSI নিয়ে কথা বলব।', 'bn-en')
            }
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-[10px] font-semibold cursor-pointer"
          >
            <Volume2 className="w-3 h-3" /> Test বাংলা
          </button>
          <button
            type="button"
            onClick={() =>
              onTestTts(
                'नमस्ते दोस्त, मैं आपका AI assistant हूँ। Nifty और Bank Nifty का RSI देखते हैं।',
                'hi-en'
              )
            }
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-[10px] font-semibold cursor-pointer"
          >
            <Volume2 className="w-3 h-3" /> Test हिंदी
          </button>
          <button
            type="button"
            onClick={() =>
              onTestTts(
                'Hello Friend, voice playback is working properly for EMA, RSI, and MACD.',
                'en'
              )
            }
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-[10px] font-semibold cursor-pointer"
          >
            <Volume2 className="w-3 h-3" /> Test English
          </button>
        </div>
      </div>
    </div>
  );
};

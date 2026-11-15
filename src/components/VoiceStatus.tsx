import React from 'react';
import {
  ExternalLink,
  Hand,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  Volume2,
} from 'lucide-react';
import { DetectedLanguage, VoiceStateStatus } from '../types/voice';
import { formatLanguageTag } from '../utils/languageDetector';

interface Props {
  status: VoiceStateStatus;
  detectedLanguage: DetectedLanguage;
  hasPlayableAnswer?: boolean;
  ttsBlockedOrFailed?: boolean;
  canRetryGemini?: boolean;
  onInterrupt: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onPlayAnswer?: () => void;
  onRetryGemini?: () => void;
  onUseExplicitDemo?: () => void;
  onRetryMic?: () => void;
  onUseNoMicMode?: () => void;
  error?: string;
}

export const VoiceStatus: React.FC<Props> = ({
  status,
  detectedLanguage,
  hasPlayableAnswer,
  ttsBlockedOrFailed,
  canRetryGemini,
  onInterrupt,
  onPause,
  onResume,
  onPlayAnswer,
  onRetryGemini,
  onUseExplicitDemo,
  onRetryMic,
  onUseNoMicMode,
  error,
}) => {
  const badgeStyles: Record<VoiceStateStatus, string> = {
    idle: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    listening: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    thinking: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    speaking: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    paused: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    interrupted: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    error: 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
  };

  const labelMap: Record<VoiceStateStatus, string> = {
    idle: 'IDLE',
    listening: 'LISTENING',
    thinking: 'THINKING',
    speaking: 'SPEAKING',
    paused: 'PAUSED',
    interrupted: 'INTERRUPTED',
    error: 'ERROR',
  };

  const isMicPermissionIssue = Boolean(
    error &&
      (error.toLowerCase().includes('microphone') ||
        error.toLowerCase().includes('permission') ||
        error.toLowerCase().includes('denied'))
  );

  const isEmbeddedIframe =
    typeof window !== 'undefined' && window.self !== window.top;
  const standaloneUrl =
    typeof window !== 'undefined' ? window.location.href : '/';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${badgeStyles[status]}`}
          >
            {labelMap[status]}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
            Detected: {formatLanguageTag(detectedLanguage)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {status === 'speaking' && onPause && (
            <button
              type="button"
              onClick={onPause}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 cursor-pointer"
            >
              <Pause className="w-3 h-3" /> Pause
            </button>
          )}

          {status === 'paused' && onResume && (
            <button
              type="button"
              onClick={onResume}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              <Play className="w-3 h-3" /> Resume
            </button>
          )}

          {(status === 'speaking' || status === 'thinking' || status === 'paused') && (
            <button
              type="button"
              onClick={onInterrupt}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              <Hand className="w-3.5 h-3.5" />
              Interrupt AI
            </button>
          )}

          {hasPlayableAnswer &&
            status !== 'speaking' &&
            status !== 'thinking' &&
            onPlayAnswer && (
              <button
                type="button"
                onClick={onPlayAnswer}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                  ttsBlockedOrFailed
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                Play Answer
              </button>
            )}
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-[11px] text-red-800 dark:text-red-200 space-y-2">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">{error}</span>
          </div>

          <div className="pl-6 flex flex-wrap items-center gap-2">
            {canRetryGemini && onRetryGemini && (
              <button
                type="button"
                onClick={onRetryGemini}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Retry Gemini
              </button>
            )}

            {canRetryGemini && onUseExplicitDemo && (
              <button
                type="button"
                onClick={onUseExplicitDemo}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 text-[11px] font-semibold cursor-pointer"
              >
                Offline Demo Reply (Not Gemini)
              </button>
            )}

            {ttsBlockedOrFailed && onPlayAnswer && (
              <button
                type="button"
                onClick={onPlayAnswer}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"
              >
                <Volume2 className="w-3 h-3" />
                Play Answer Now
              </button>
            )}

            {isMicPermissionIssue && onUseNoMicMode && (
              <button
                type="button"
                onClick={onUseNoMicMode}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"
              >
                Use Text + AI Voice (No Mic)
              </button>
            )}

            {isMicPermissionIssue && onRetryMic && (
              <button
                type="button"
                onClick={onRetryMic}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Retry Mic
              </button>
            )}

            {isMicPermissionIssue && isEmbeddedIframe && (
              <a
                href={standaloneUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-[11px] font-semibold"
              >
                <ExternalLink className="w-3 h-3" />
                Standalone Tab
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

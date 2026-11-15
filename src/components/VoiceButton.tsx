import React from 'react';
import { Mic, Loader2, Volume2, AlertTriangle, Square, Pause } from 'lucide-react';
import { VoiceStateStatus } from '../types/voice';

interface Props {
  status: VoiceStateStatus;
  onClick: () => void;
  disabled?: boolean;
}

export const VoiceButton: React.FC<Props> = ({ status, onClick, disabled }) => {
  const isListening = status === 'listening';
  const isThinking = status === 'thinking';
  const isSpeaking = status === 'speaking';
  const isPaused = status === 'paused';
  const isError = status === 'error';

  const labelMap: Record<VoiceStateStatus, string> = {
    idle: 'Tap to Speak',
    listening: 'Listening... Tap to Stop',
    thinking: 'Thinking...',
    speaking: 'AI Speaking — Tap to Interrupt',
    paused: 'Paused — Tap to Speak',
    interrupted: 'Interrupted — Tap to Speak',
    error: 'Tap to Retry Mic',
  };

  const ringClass = isListening
    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/30 ring-4 ring-rose-500/25'
    : isSpeaking
    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-500/25'
    : isThinking
    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md ring-2 ring-amber-500/20'
    : isPaused
    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
    : isError
    ? 'bg-red-600 hover:bg-red-700 text-white shadow-md'
    : 'bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white shadow-md';

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={isListening ? 'Stop voice listening' : 'Start voice conversation'}
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 ${ringClass}`}
      >
        {isListening ? (
          <Square className="w-6 h-6 fill-current" />
        ) : isThinking ? (
          <Loader2 className="w-7 h-7 animate-spin" />
        ) : isSpeaking ? (
          <Volume2 className="w-7 h-7" />
        ) : isPaused ? (
          <Pause className="w-6 h-6" />
        ) : isError ? (
          <AlertTriangle className="w-6 h-6" />
        ) : (
          <Mic className="w-7 h-7" />
        )}
      </button>
      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 text-center">
        {labelMap[status]}
      </div>
    </div>
  );
};

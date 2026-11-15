import React from 'react';
import { VoiceStateStatus } from '../types/voice';

interface Props {
  levels: number[];
  status: VoiceStateStatus;
}

export const VoiceWaveform: React.FC<Props> = ({ levels, status }) => {
  const isListening = status === 'listening';
  const isSpeaking = status === 'speaking';

  return (
    <div
      className="flex items-center justify-center gap-1 h-10 px-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
      aria-label="Audio waveform visualizer"
    >
      {levels.map((lvl, idx) => {
        const speakingSynthetic = isSpeaking
          ? 0.25 + 0.55 * Math.abs(Math.sin((idx + 1) * 0.7))
          : 0;
        const heightPct = isListening
          ? Math.max(15, Math.round(lvl * 100))
          : isSpeaking
          ? Math.max(20, Math.round(speakingSynthetic * 90))
          : 14;

        const barColor = isListening
          ? 'bg-rose-500'
          : isSpeaking
          ? 'bg-emerald-500'
          : 'bg-slate-400 dark:bg-slate-600';

        return (
          <div
            key={idx}
            className={`w-1 rounded-sm transition-all duration-75 ${barColor}`}
            style={{ height: `${heightPct}%` }}
          />
        );
      })}
    </div>
  );
};

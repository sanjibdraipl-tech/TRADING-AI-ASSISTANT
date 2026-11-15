import React from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  interimTranscript: string;
  finalTranscript: string;
  lowConfidenceWarning?: boolean;
}

export const TranscriptPanel: React.FC<Props> = ({
  interimTranscript,
  finalTranscript,
  lowConfidenceWarning,
}) => {
  if (!interimTranscript && !finalTranscript && !lowConfidenceWarning) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-xs space-y-1">
      {interimTranscript ? (
        <div className="text-slate-600 dark:text-slate-300 italic">
          <span className="font-semibold not-italic text-rose-600 dark:text-rose-400 mr-1.5">
            Live Captions:
          </span>
          {interimTranscript}
        </div>
      ) : (
        <div className="text-slate-700 dark:text-slate-200">
          <span className="font-semibold text-emerald-700 dark:text-emerald-400 mr-1.5">
            Last Heard:
          </span>
          {finalTranscript}
        </div>
      )}

      {lowConfidenceWarning && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>I may have misheard you — you can edit or type your message below if needed.</span>
        </div>
      )}
    </div>
  );
};

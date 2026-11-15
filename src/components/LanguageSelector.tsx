import React from 'react';
import { Languages } from 'lucide-react';
import { LanguagePreference } from '../types/voice';

interface Props {
  value: LanguagePreference;
  onChange: (lang: LanguagePreference) => void;
}

const OPTIONS: { id: LanguagePreference; label: string }[] = [
  { id: 'auto', label: 'AUTO' },
  { id: 'bn', label: 'বাংলা' },
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिंदी' },
  { id: 'bn-en', label: 'বাংলা + EN' },
  { id: 'hi-en', label: 'हिंदी + EN' },
];

export const LanguageSelector: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 mr-1">
        <Languages className="w-3.5 h-3.5" />
        Language:
      </span>
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
              active
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

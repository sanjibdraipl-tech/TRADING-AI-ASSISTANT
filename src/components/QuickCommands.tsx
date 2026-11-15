import React from 'react';
import { BookOpen, HelpCircle, ListChecks, Sparkles, TrendingUp } from 'lucide-react';

interface Props {
  onSelectCommand: (phrase: string) => void;
}

const COMMANDS = [
  { label: 'Market (BN)', phrase: 'আজ market কেমন?', icon: TrendingUp },
  { label: 'HDFC RSI (HI+EN)', phrase: 'आज HDFC Bank का RSI और EMA 20 क्या है?', icon: Sparkles },
  { label: 'HDFC RSI (BN+EN)', phrase: 'HDFC Bank-এর RSI কত?', icon: Sparkles },
  { label: 'Watchlist', phrase: 'আমার watchlist দেখাও.', icon: ListChecks },
  { label: 'Journal', phrase: 'Open journal', icon: BookOpen },
  { label: 'Help', phrase: 'What can you do?', icon: HelpCircle },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning, Friend';
  if (hour < 17) return 'Good afternoon, Friend';
  return 'Good evening, Friend';
}

export const QuickCommands: React.FC<Props> = ({ onSelectCommand }) => {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {getGreeting()}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Try a quick voice/text prompt in বাংলা, English, or mixed Banglish:
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {COMMANDS.map((cmd) => {
          const Icon = cmd.icon;
          return (
            <button
              key={cmd.phrase}
              type="button"
              onClick={() => onSelectCommand(cmd.phrase)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[11px] font-medium text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <Icon className="w-3.5 h-3.5 text-emerald-600" />
              <span>{cmd.phrase}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

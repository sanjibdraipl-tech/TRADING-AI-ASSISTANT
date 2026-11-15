import React, { useState } from 'react';
import { Check, Copy, Edit3, Mic, Trash2, Volume2, X } from 'lucide-react';
import { VoiceChatMessage } from '../types/conversation';
import { formatLanguageTag } from '../utils/languageDetector';

interface Props {
  message: VoiceChatMessage;
  onReplay: (text: string, lang: VoiceChatMessage['language']) => void;
  onEdit: (id: string, newText: string) => void;
  onDelete: (id: string) => void;
}

export const ChatMessage: React.FC<Props> = ({
  message,
  onReplay,
  onEdit,
  onDelete,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);
  const [copied, setCopied] = useState(false);

  const isUser = message.role === 'user';
  const timeStr = new Date(message.timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSaveEdit = () => {
    if (draft.trim()) {
      onEdit(message.id, draft.trim());
    }
    setEditing(false);
  };

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[88%] sm:max-w-[78%] rounded-xl px-3.5 py-2.5 border text-xs space-y-1.5 ${
          isUser
            ? 'bg-emerald-600 text-white border-emerald-700'
            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700'
        }`}
      >
        {/* Top Metadata */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] opacity-85">
          <span className="font-bold uppercase tracking-wide">
            {isUser ? 'You' : 'Smart Trader AI'}
          </span>
          {!isUser && message.isDemoFallback && (
            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/50 font-bold uppercase tracking-wide">
              DEMO/OFFLINE RESPONSE — NOT GEMINI
            </span>
          )}
          {!isUser && message.isRealGemini && (
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-400/40 font-bold uppercase tracking-wide">
              REAL GEMINI RESPONSE{message.modelName ? ` · ${message.modelName}` : ''}
            </span>
          )}
          <span>·</span>
          <span>{timeStr}</span>
          {message.inputMode === 'voice' && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-black/15 dark:bg-white/10 font-semibold">
              <Mic className="w-2.5 h-2.5" />
              Voice
            </span>
          )}
          <span className="px-1.5 py-0.2 rounded bg-black/15 dark:bg-white/10 font-semibold">
            {formatLanguageTag(message.language)}
          </span>
          {message.symbol && (
            <span className="px-1.5 py-0.2 rounded bg-blue-500/20 font-mono font-bold">
              {message.symbol}
            </span>
          )}
        </div>

        {/* Body */}
        {editing ? (
          <div className="space-y-2 pt-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-2 text-xs"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-2 py-1 rounded bg-emerald-700 text-white text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Save
              </button>
            </div>
          </div>
        ) : (
          <p className="leading-relaxed whitespace-pre-wrap">{message.text}</p>
        )}

        {/* Action Strip */}
        {!editing && (
          <div className="flex items-center justify-end gap-2 pt-1 opacity-80 text-[10px]">
            {!isUser && (
              <button
                type="button"
                onClick={() => onReplay(message.text, message.language)}
                className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                title="Replay spoken audio"
              >
                <Volume2 className="w-3 h-3" /> Replay
              </button>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 hover:underline cursor-pointer"
              title="Copy text"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(message.text);
                setEditing(true);
              }}
              className="inline-flex items-center gap-1 hover:underline cursor-pointer"
              title="Edit message"
            >
              <Edit3 className="w-3 h-3" /> Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              className="inline-flex items-center gap-1 hover:underline cursor-pointer"
              title="Delete message"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

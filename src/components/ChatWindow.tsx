import React, { useEffect, useRef, useState } from 'react';
import { Mic, Send, Volume2, VolumeX } from 'lucide-react';
import { VoiceChatMessage } from '../types/conversation';
import { DetectedLanguage, VoiceStateStatus } from '../types/voice';
import { ChatMessage } from './ChatMessage';

interface Props {
  messages: VoiceChatMessage[];
  streamingText: string;
  isStreaming: boolean;
  voiceStatus: VoiceStateStatus;
  autoSpeak: boolean;
  showMicButton?: boolean;
  onToggleAutoSpeak: () => void;
  onSendText: (text: string) => void;
  onToggleMic: () => void;
  onReplay: (text: string, lang: DetectedLanguage) => void;
  onEditMessage: (id: string, newText: string) => void;
  onDeleteMessage: (id: string) => void;
}

export const ChatWindow: React.FC<Props> = ({
  messages,
  streamingText,
  isStreaming,
  voiceStatus,
  autoSpeak,
  showMicButton = true,
  onToggleAutoSpeak,
  onSendText,
  onToggleMic,
  onReplay,
  onEditMessage,
  onDeleteMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendText(inputText.trim());
    setInputText('');
  };

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Scrollable Transcript Feed */}
      <div className="flex-1 min-h-[320px] max-h-[460px] overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !streamingText ? (
          <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center text-xs text-slate-500 dark:text-slate-400 space-y-2 px-4">
            <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
              Friend, type below or pick a quick prompt — no microphone required.
            </p>
            <p className="max-w-md">
              Ask in বাংলা, English, or mixed Banglish — AI replies in text and speaks aloud automatically. Try{' '}
              <span className="font-mono text-emerald-700 dark:text-emerald-400">
                "আজ HDFC Bank-এর RSI কত?"
              </span>{' '}
              or{' '}
              <span className="font-mono text-emerald-700 dark:text-emerald-400">
                "Explain EMA 20 and EMA 50."
              </span>
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onReplay={onReplay}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
              />
            ))}

            {(isStreaming || streamingText) && (
              <div className="flex flex-col items-start">
                <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-xs text-slate-900 dark:text-slate-100 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                    Smart Trader AI · Streaming
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">
                    {streamingText || '...'}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Primary Text + Spoken Voice Input Bar (No Microphone Required) */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-2.5 flex items-center gap-2"
      >
        {showMicButton && (
          <button
            type="button"
            onClick={onToggleMic}
            aria-label="Optional microphone input"
            className={`p-2 rounded-lg border transition-colors cursor-pointer shrink-0 ${
              voiceStatus === 'listening'
                ? 'bg-rose-600 text-white border-rose-700'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            title="Optional Voice Input (Mic)"
          >
            <Mic className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onToggleAutoSpeak}
          className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border text-[11px] font-semibold cursor-pointer shrink-0 transition-colors ${
            autoSpeak
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
              : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'
          }`}
          title="Toggle spoken voice replies from AI"
        >
          {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{autoSpeak ? 'Voice ON' : 'Muted'}</span>
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type in বাংলা, English, or Banglish — AI replies in text & spoken voice..."
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          Send
        </button>
      </form>
    </div>
  );
};

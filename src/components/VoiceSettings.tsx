import React from 'react';
import { Lock, Sliders } from 'lucide-react';
import { LanguagePreference, VoiceSettingsConfig } from '../types/voice';

interface Props {
  settings: VoiceSettingsConfig;
  onUpdate: (next: VoiceSettingsConfig) => void;
  availableVoices: SpeechSynthesisVoice[];
  supportedModels: string[];
}

export const VoiceSettings: React.FC<Props> = ({
  settings,
  onUpdate,
  availableVoices,
  supportedModels,
}) => {
  const relevantVoices = availableVoices.filter((v) =>
    /^(bn|hi|en)/i.test(v.lang)
  );
  const displayVoices = relevantVoices.length > 0 ? relevantVoices : availableVoices;
  const geminiVoices = ['Kore', 'Aoede', 'Charon', 'Fenrir', 'Puck'];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-3 text-xs">
      <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
        <Sliders className="w-4 h-4 text-emerald-600" />
        <span>Voice & AI Settings</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
        {/* Language */}
        <label className="space-y-1">
          <span className="font-semibold text-slate-600 dark:text-slate-400 block">
            Response Language
          </span>
          <select
            value={settings.language}
            onChange={(e) =>
              onUpdate({ ...settings, language: e.target.value as LanguagePreference })
            }
            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-slate-900 dark:text-slate-100"
          >
            <option value="auto">AUTO (Detect Naturally)</option>
            <option value="bn">বাংলা (bn-IN)</option>
            <option value="en">English (en-IN)</option>
            <option value="hi">हिंदी (hi-IN)</option>
            <option value="bn-en">বাংলা + English (Mixed)</option>
            <option value="hi-en">हिंदी + English (Mixed)</option>
            <option value="bn-hi-en">Bengali + Hindi + English</option>
          </select>
        </label>

        {/* TTS Engine */}
        <label className="space-y-1">
          <span className="font-semibold text-slate-600 dark:text-slate-400 block">
            Voice Output Engine
          </span>
          <select
            value={settings.ttsEngine}
            onChange={(e) =>
              onUpdate({
                ...settings,
                ttsEngine: e.target.value as VoiceSettingsConfig['ttsEngine'],
                voiceURI: 'auto',
              })
            }
            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-slate-900 dark:text-slate-100"
          >
            <option value="browser">Browser SpeechSynthesis (Instant)</option>
            <option value="gemini-neural">Gemini Neural TTS (Auto Fallback)</option>
          </select>
        </label>

        {/* Dynamic Voice Selection */}
        <label className="space-y-1">
          <span className="font-semibold text-slate-600 dark:text-slate-400 block">
            Voice Speaker ({displayVoices.length} available)
          </span>
          <select
            value={settings.voiceURI}
            onChange={(e) => onUpdate({ ...settings, voiceURI: e.target.value })}
            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-slate-900 dark:text-slate-100"
          >
            <option value="auto">Auto Best Match (bn-IN / hi-IN / en-IN)</option>
            {settings.ttsEngine === 'gemini-neural'
              ? geminiVoices.map((gv) => (
                  <option key={gv} value={gv}>
                    Gemini Voice: {gv}
                  </option>
                ))
              : displayVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
          </select>
        </label>

        {/* Speech Speed */}
        <label className="space-y-1">
          <span className="font-semibold text-slate-600 dark:text-slate-400 block">
            Speech Speed
          </span>
          <select
            value={settings.speechRate}
            onChange={(e) =>
              onUpdate({
                ...settings,
                speechRate: parseFloat(e.target.value) as VoiceSettingsConfig['speechRate'],
              })
            }
            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-slate-900 dark:text-slate-100"
          >
            <option value={0.75}>0.75x (Calm / Slower)</option>
            <option value={1}>1.0x (Normal)</option>
            <option value={1.25}>1.25x (Brisk)</option>
            <option value={1.5}>1.5x (Fast)</option>
          </select>
        </label>

        {/* Gemini Model */}
        <label className="space-y-1 sm:col-span-2">
          <span className="font-semibold text-slate-600 dark:text-slate-400 block">
            Gemini Reasoning Model (Server Proxy)
          </span>
          <select
            value={settings.modelName}
            onChange={(e) => onUpdate({ ...settings, modelName: e.target.value })}
            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-slate-900 dark:text-slate-100 font-mono"
          >
            {supportedModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
        <label className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
          <span>Auto Speak AI Replies</span>
          <input
            type="checkbox"
            checked={settings.autoSpeak}
            onChange={(e) => onUpdate({ ...settings, autoSpeak: e.target.checked })}
            className="accent-emerald-600"
          />
        </label>
        <label className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
          <span>Interrupt AI (Barge-In)</span>
          <input
            type="checkbox"
            checked={settings.interruptAi}
            onChange={(e) => onUpdate({ ...settings, interruptAi: e.target.checked })}
            className="accent-emerald-600"
          />
        </label>
        <label className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
          <span>Continuous Conversation</span>
          <input
            type="checkbox"
            checked={settings.continuousConversation}
            onChange={(e) =>
              onUpdate({ ...settings, continuousConversation: e.target.checked })
            }
            className="accent-emerald-600"
          />
        </label>
        <label className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
          <span>Save History Locally</span>
          <input
            type="checkbox"
            checked={settings.saveHistory}
            onChange={(e) => onUpdate({ ...settings, saveHistory: e.target.checked })}
            className="accent-emerald-600"
          />
        </label>
      </div>

      <div className="flex items-start gap-1.5 p-2 rounded bg-slate-50 dark:bg-slate-800/40 text-[10px] text-slate-500 dark:text-slate-400">
        <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
        <span>
          Privacy Notice: Microphone is active only when listening. Raw audio is never stored permanently, and API keys stay strictly server-side.
        </span>
      </div>
    </div>
  );
};

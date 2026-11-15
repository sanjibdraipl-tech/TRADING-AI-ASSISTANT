import { DetectedLanguage } from '../types/voice';
import {
  detectLanguage,
  splitLanguageAwareSegments,
  SpeechSegment,
  toSpeechLocale,
} from '../utils/languageDetector';

export interface TtsSpeakOptions {
  engine?: 'browser' | 'gemini-neural';
  voiceURI?: string;
  rate?: number;
  onStart?: (voiceInfo: string, locale: string) => void;
  onEnd?: () => void;
  onError?: (reason: string, isAutoplayBlocked: boolean) => void;
  onStatusChange?: (status: {
    ttsStatus: 'IDLE' | 'UNLOCKED' | 'SPEAKING' | 'PAUSED' | 'BLOCKED' | 'ERROR';
    playbackStatus: 'IDLE' | 'PLAYING' | 'PAUSED' | 'BLOCKED' | 'COMPLETED' | 'ERROR';
    selectedVoice: string;
    provider: string;
    lastError?: string;
  }) => void;
}

/**
 * Production-hardened multilingual Text-to-Speech service supporting Bengali (bn-IN),
 * Hindi (hi-IN), English (en-IN), and mixed-language code-switched responses.
 *
 * Fixes critical browser SpeechSynthesis issues:
 * 1. Synchronous user-gesture audio/speechSynthesis unlocking (`unlockAudio`).
 * 2. Post-cancel yield (40ms) preventing Chrome from eating the first spoken utterance.
 * 3. Active utterance retention + Chrome keep-alive timer preventing 15s cutoff/GC drop.
 * 4. True `onstart` verification — never claims SPEAKING until browser playback starts.
 * 5. Explicit error & `not-allowed` autoplay-blocked surfacing with Play Answer recovery.
 */
class TextToSpeechService {
  private segments: SpeechSegment[] = [];
  private isPlaying = false;
  private isPaused = false;
  private hasActuallyStarted = false;
  private currentAudio: HTMLAudioElement | null = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private keepAliveTimer: number | null = null;
  private abortToken = 0;
  private activeOptions: TtsSpeakOptions | null = null;
  private audioUnlocked = false;
  private cachedAudioCtx: AudioContext | null = null;

  /**
   * Unlocks Web AudioContext & Web SpeechSynthesis synchronously inside a user gesture
   * (click / mic tap / Enter submit) so async Gemini responses play aloud automatically.
   */
  public unlockAudio(): void {
    if (typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!this.cachedAudioCtx) {
          this.cachedAudioCtx = new AudioCtx();
        }
        if (this.cachedAudioCtx.state === 'suspended') {
          this.cachedAudioCtx.resume().catch(() => {});
        }
      }
    } catch {
      // ignore AudioContext init issues
    }

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
        if (!this.audioUnlocked) {
          const primer = new SpeechSynthesisUtterance(' ');
          primer.volume = 0;
          primer.rate = 2;
          primer.onend = () => {
            this.audioUnlocked = true;
          };
          primer.onerror = () => {
            // do not crash on silent primer
          };
          window.speechSynthesis.speak(primer);
          this.audioUnlocked = true;
        }
      } catch (err) {
        console.error('[TTS] unlockAudio error:', err);
      }
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return [];
    }
    return window.speechSynthesis.getVoices() || [];
  }

  public detectResponseLanguage(text: string): DetectedLanguage {
    return detectLanguage(text, 'auto');
  }

  public pickBestBrowserVoice(
    localeOrLang: 'bn-IN' | 'hi-IN' | 'en-IN' | DetectedLanguage,
    preferredVoiceURI?: string,
    preferMultilingual = false
  ): SpeechSynthesisVoice | null {
    const voices = this.getAvailableVoices();
    if (voices.length === 0) return null;

    if (preferredVoiceURI && preferredVoiceURI !== 'auto') {
      const exact = voices.find(
        (v) => v.voiceURI === preferredVoiceURI || v.name === preferredVoiceURI
      );
      if (exact) return exact;
    }

    const locale =
      localeOrLang === 'bn-IN' || localeOrLang === 'hi-IN' || localeOrLang === 'en-IN'
        ? localeOrLang
        : toSpeechLocale(localeOrLang);
    const prefix = locale.split('-')[0].toLowerCase();

    if (preferMultilingual) {
      const multi = voices.find(
        (v) =>
          v.name.toLowerCase().includes('multilingual') &&
          (v.lang.toLowerCase().startsWith(prefix) || v.lang.toLowerCase().includes('in'))
      );
      if (multi) return multi;
    }

    // 1. Exact locale match (e.g. bn-IN, hi-IN, en-IN), preferring Google/Microsoft/Natural voices
    const exactMatches = voices.filter((v) => v.lang.toLowerCase() === locale.toLowerCase());
    if (exactMatches.length > 0) {
      return (
        exactMatches.find((v) => /google|microsoft|natural|neural/i.test(v.name)) ||
        exactMatches[0]
      );
    }

    // 2. Same language prefix (e.g. bn-BD for bn-IN, hi for hi-IN, en-GB/en-US for en-IN)
    const prefixMatches = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
    if (prefixMatches.length > 0) {
      return (
        prefixMatches.find((v) => /google|microsoft|natural|neural/i.test(v.name)) ||
        prefixMatches[0]
      );
    }

    // 3. Fallback Indian English or default browser voice
    return (
      voices.find((v) => v.lang.toLowerCase() === 'en-in') ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
      voices.find((v) => v.default) ||
      voices[0]
    );
  }

  /**
   * Main public TTS entry point called AFTER Gemini generates a valid response.
   * Splits mixed-language answers into language-aware speakable segments and starts playback.
   */
  public async speak(
    text: string,
    language?: DetectedLanguage,
    options: TtsSpeakOptions = {}
  ): Promise<void> {
    const cleaned = text.trim();
    if (!cleaned) {
      const msg = 'Cannot speak empty AI response.';
      console.error('[TTS]', msg);
      options.onError?.(msg, false);
      return;
    }

    const hadActivePlayback =
      this.isPlaying ||
      this.isPaused ||
      (typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        (window.speechSynthesis.speaking || window.speechSynthesis.pending));

    this.stopSpeaking();

    // Yield briefly after cancel() so Chrome does not swallow the new utterance
    if (hadActivePlayback) {
      await new Promise((r) => setTimeout(r, 45));
    }

    const token = this.abortToken;
    const detectedLang = language || this.detectResponseLanguage(cleaned);
    const segments = splitLanguageAwareSegments(cleaned, detectedLang);

    if (segments.length === 0) {
      options.onEnd?.();
      return;
    }

    this.activeOptions = options;
    this.segments = segments;
    this.isPlaying = true;
    this.isPaused = false;
    this.hasActuallyStarted = false;

    await this.playSegmentQueue(token, detectedLang);
  }

  public stopSpeaking(): void {
    this.abortToken += 1;
    this.segments = [];
    this.isPlaying = false;
    this.isPaused = false;
    this.hasActuallyStarted = false;
    this.clearKeepAlive();
    this.activeUtterance = null;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending || window.speechSynthesis.paused) {
          window.speechSynthesis.cancel();
        }
      } catch (err) {
        console.error('[TTS] stopSpeaking cancel error:', err);
      }
    }

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.src = '';
      } catch {
        // ignore
      }
      this.currentAudio = null;
    }
  }

  // Backward-compatible alias
  public stop(): void {
    this.stopSpeaking();
  }

  public pauseSpeaking(): void {
    if (!this.isPlaying) return;
    this.isPaused = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.pause();
      } catch (err) {
        console.error('[TTS] pause error:', err);
      }
    }
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
    }
    this.activeOptions?.onStatusChange?.({
      ttsStatus: 'PAUSED',
      playbackStatus: 'PAUSED',
      selectedVoice: this.activeUtterance?.voice?.name || 'Browser Voice',
      provider: this.activeOptions?.engine === 'gemini-neural' ? 'Gemini Neural TTS' : 'Browser SpeechSynthesis',
    });
  }

  public resumeSpeaking(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
      } catch (err) {
        console.error('[TTS] resume error:', err);
      }
    }
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play().catch((err) => {
        console.error('[TTS] audio resume blocked:', err);
      });
    }
    this.activeOptions?.onStatusChange?.({
      ttsStatus: 'SPEAKING',
      playbackStatus: 'PLAYING',
      selectedVoice: this.activeUtterance?.voice?.name || 'Browser Voice',
      provider: this.activeOptions?.engine === 'gemini-neural' ? 'Gemini Neural TTS' : 'Browser SpeechSynthesis',
    });
  }

  public isCurrentlySpeaking(): boolean {
    return this.isPlaying;
  }

  private clearKeepAlive(): void {
    if (this.keepAliveTimer !== null) {
      window.clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private startChromeKeepAlive(): void {
    this.clearKeepAlive();
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.keepAliveTimer = window.setInterval(() => {
      if (window.speechSynthesis.speaking && !this.isPaused) {
        try {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } catch {
          // ignore
        }
      }
    }, 9000);
  }

  private async playSegmentQueue(
    token: number,
    overallLang: DetectedLanguage
  ): Promise<void> {
    const opts = this.activeOptions;
    if (!opts || token !== this.abortToken) return;

    while (this.segments.length > 0) {
      if (token !== this.abortToken) return;
      const seg = this.segments.shift()!;

      if (opts.engine === 'gemini-neural') {
        const neuralResult = await this.playGeminiNeural(seg.text, seg.locale, opts, token);
        if (token !== this.abortToken) return;
        if (neuralResult.ok) continue;
        if (neuralResult.blocked) {
          this.isPlaying = false;
          opts.onStatusChange?.({
            ttsStatus: 'BLOCKED',
            playbackStatus: 'BLOCKED',
            selectedVoice: opts.voiceURI || 'Kore',
            provider: 'Gemini Neural TTS',
            lastError: 'Browser autoplay blocked audio playback. Click Play Answer.',
          });
          opts.onError?.('Browser autoplay blocked audio playback. Click Play Answer to listen.', true);
          return;
        }
        // Else fall through cleanly to Browser SpeechSynthesis fallback
      }

      const browserResult = await this.playBrowserSegment(seg, overallLang, opts, token);
      if (token !== this.abortToken) return;

      if (!browserResult.ok) {
        this.isPlaying = false;
        this.clearKeepAlive();
        const isBlocked = browserResult.isAutoplayBlocked;
        opts.onStatusChange?.({
          ttsStatus: isBlocked ? 'BLOCKED' : 'ERROR',
          playbackStatus: isBlocked ? 'BLOCKED' : 'ERROR',
          selectedVoice: browserResult.voiceLabel,
          provider: 'Browser SpeechSynthesis',
          lastError: browserResult.errorMsg,
        });
        opts.onError?.(browserResult.errorMsg, isBlocked);
        return;
      }
    }

    if (token === this.abortToken) {
      this.isPlaying = false;
      this.isPaused = false;
      this.clearKeepAlive();
      this.activeUtterance = null;
      opts.onStatusChange?.({
        ttsStatus: 'IDLE',
        playbackStatus: 'COMPLETED',
        selectedVoice: opts.voiceURI && opts.voiceURI !== 'auto' ? opts.voiceURI : 'Auto Voice',
        provider: opts.engine === 'gemini-neural' ? 'Gemini Neural TTS' : 'Browser SpeechSynthesis',
      });
      opts.onEnd?.();
    }
  }

  private async playGeminiNeural(
    text: string,
    locale: 'bn-IN' | 'hi-IN' | 'en-IN',
    opts: TtsSpeakOptions,
    token: number
  ): Promise<{ ok: boolean; blocked: boolean }> {
    try {
      const voiceName = opts.voiceURI && opts.voiceURI !== 'auto' ? opts.voiceURI : 'Kore';
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceName }),
      });
      if (!res.ok || token !== this.abortToken) return { ok: false, blocked: false };
      const payload = await res.json();
      if (!payload?.audioBase64 || token !== this.abortToken) return { ok: false, blocked: false };

      const audioUrl = `data:${payload.mimeType || 'audio/wav'};base64,${payload.audioBase64}`;
      return await new Promise((resolve) => {
        const audio = new Audio(audioUrl);
        audio.playbackRate = opts.rate || 1.0;
        this.currentAudio = audio;

        audio.onplaying = () => {
          if (!this.hasActuallyStarted) {
            this.hasActuallyStarted = true;
            opts.onStart?.(`Gemini Neural (${voiceName})`, locale);
            opts.onStatusChange?.({
              ttsStatus: 'SPEAKING',
              playbackStatus: 'PLAYING',
              selectedVoice: `Gemini Neural (${voiceName})`,
              provider: 'Gemini Neural TTS',
            });
          }
        };

        audio.onended = () => {
          this.currentAudio = null;
          resolve({ ok: true, blocked: false });
        };

        audio.onerror = () => {
          this.currentAudio = null;
          resolve({ ok: false, blocked: false });
        };

        audio.play().catch((err: any) => {
          console.error('[TTS] Gemini audio.play() rejected:', err);
          this.currentAudio = null;
          const blocked = err?.name === 'NotAllowedError';
          resolve({ ok: false, blocked });
        });
      });
    } catch (err) {
      console.error('[TTS] Gemini Neural TTS fetch failed, falling back to browser TTS:', err);
      return { ok: false, blocked: false };
    }
  }

  private playBrowserSegment(
    seg: SpeechSegment,
    overallLang: DetectedLanguage,
    opts: TtsSpeakOptions,
    token: number
  ): Promise<{
    ok: boolean;
    isAutoplayBlocked: boolean;
    errorMsg: string;
    voiceLabel: string;
  }> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      const msg = 'Browser SpeechSynthesis API is not supported in this browser.';
      console.error('[TTS]', msg);
      return Promise.resolve({
        ok: false,
        isAutoplayBlocked: false,
        errorMsg: msg,
        voiceLabel: 'None',
      });
    }

    const preferMulti = overallLang.includes('-');
    const voice = this.pickBestBrowserVoice(seg.locale, opts.voiceURI, preferMulti);
    const voiceLabel = voice ? `${voice.name} (${voice.lang})` : `Browser Default (${seg.locale})`;

    return new Promise((resolve) => {
      try {
        window.speechSynthesis.resume();
        const utterance = new SpeechSynthesisUtterance(seg.text);
        this.activeUtterance = utterance;

        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        } else {
          utterance.lang = seg.locale;
        }
        utterance.rate = opts.rate || 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        let settled = false;
        let started = false;

        // Guard against browsers that silently stall without firing onstart or onerror
        const startWatchdog = window.setTimeout(() => {
          if (!settled && !started && token === this.abortToken) {
            // Try one resume kick before declaring blocked/stalled
            try {
              window.speechSynthesis.resume();
            } catch {
              // ignore
            }
          }
        }, 1200);

        const maxStallWatchdog = window.setTimeout(() => {
          if (!settled && !started && token === this.abortToken) {
            settled = true;
            window.clearTimeout(startWatchdog);
            const msg = `Browser TTS did not start playback for ${voiceLabel}. Click Play Answer to trigger audio manually.`;
            console.error('[TTS]', msg);
            resolve({
              ok: false,
              isAutoplayBlocked: true,
              errorMsg: msg,
              voiceLabel,
            });
          }
        }, 4500);

        utterance.onstart = () => {
          started = true;
          window.clearTimeout(startWatchdog);
          window.clearTimeout(maxStallWatchdog);
          this.startChromeKeepAlive();
          if (!this.hasActuallyStarted) {
            this.hasActuallyStarted = true;
            opts.onStart?.(voiceLabel, utterance.lang);
          }
          opts.onStatusChange?.({
            ttsStatus: 'SPEAKING',
            playbackStatus: 'PLAYING',
            selectedVoice: voiceLabel,
            provider: 'Browser SpeechSynthesis',
          });
        };

        utterance.onend = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(startWatchdog);
          window.clearTimeout(maxStallWatchdog);
          resolve({
            ok: true,
            isAutoplayBlocked: false,
            errorMsg: '',
            voiceLabel,
          });
        };

        utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(startWatchdog);
          window.clearTimeout(maxStallWatchdog);

          const code = String(event?.error || 'unknown');
          // Intentional stop/interrupt cancels current utterance — not a failure
          if (token !== this.abortToken || code === 'canceled' || code === 'interrupted') {
            resolve({ ok: true, isAutoplayBlocked: false, errorMsg: '', voiceLabel });
            return;
          }

          const isBlocked = code === 'not-allowed';
          const friendly = isBlocked
            ? 'Browser blocked automatic audio playback (not-allowed). Click Play Answer to hear the response.'
            : `SpeechSynthesis error (${code}) using ${voiceLabel}. Click Play Answer to retry.`;

          console.error('[TTS] utterance.onerror:', code, event);
          resolve({
            ok: false,
            isAutoplayBlocked: isBlocked,
            errorMsg: friendly,
            voiceLabel,
          });
        };

        if (token !== this.abortToken) {
          settled = true;
          window.clearTimeout(startWatchdog);
          window.clearTimeout(maxStallWatchdog);
          resolve({ ok: true, isAutoplayBlocked: false, errorMsg: '', voiceLabel });
          return;
        }

        window.speechSynthesis.speak(utterance);
      } catch (err: any) {
        const msg = `Failed to speak via SpeechSynthesis: ${err?.message || err}`;
        console.error('[TTS]', msg);
        resolve({
          ok: false,
          isAutoplayBlocked: false,
          errorMsg: msg,
          voiceLabel,
        });
      }
    });
  }
}

export const ttsService = new TextToSpeechService();

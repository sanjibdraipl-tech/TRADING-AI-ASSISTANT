import { startMicStreamMonitor, MicMonitorHandle } from '../utils/audioUtils';
import {
  isWebSpeechSupported,
  startSpeechCapture,
  SttCallbacks,
  SttController,
} from './speechRecognitionService';
import { LanguagePreference } from '../types/voice';
import { ttsService } from './textToSpeechService';

export interface VoiceSessionController {
  micHandle: MicMonitorHandle | null;
  sttHandle: SttController;
  stopAll: () => void;
}

/**
 * Coordinates microphone Web Audio level monitoring and speech recognition.
 * If getUserMedia fails (e.g., strict iframe audio policy) while Web SpeechRecognition
 * is available, still attempts SpeechRecognition directly with a fallback waveform
 * before reporting a permission error.
 */
export async function startVoiceInputSession(
  langPref: LanguagePreference,
  callbacks: SttCallbacks,
  onAudioLevels: (levels: number[]) => void
): Promise<VoiceSessionController> {
  // Always halt AI playback immediately before capturing user voice (Barge-In)
  ttsService.stop();

  let micHandle: MicMonitorHandle | null = null;
  let micError: Error | null = null;

  try {
    micHandle = await startMicStreamMonitor(16);
  } catch (err: any) {
    micError = err instanceof Error ? err : new Error(String(err));
  }

  // If neither getUserMedia nor Web SpeechRecognition can run, surface exact mic error
  if (!micHandle && !isWebSpeechSupported()) {
    throw micError || new Error('Microphone access is unavailable. Please enable microphone permission or use text chat.');
  }

  let tick = 0;
  const levelTimer = window.setInterval(() => {
    if (micHandle) {
      onAudioLevels(micHandle.getLevels());
    } else {
      tick += 0.35;
      const synthetic = Array.from({ length: 16 }, (_, idx) =>
        0.18 + 0.32 * Math.abs(Math.sin(tick + idx * 0.45))
      );
      onAudioLevels(synthetic);
    }
  }, 60);

  let cleaned = false;
  const cleanupMic = () => {
    if (cleaned) return;
    cleaned = true;
    window.clearInterval(levelTimer);
    micHandle?.stop();
    onAudioLevels(new Array(16).fill(0));
  };

  const sttHandle = startSpeechCapture(langPref, micHandle?.stream ?? null, {
    onInterim: callbacks.onInterim,
    onFinal: (text, conf) => {
      cleanupMic();
      callbacks.onFinal(text, conf);
    },
    onError: (err) => {
      cleanupMic();
      const lowerErr = err.toLowerCase();
      const isPermOrHardware =
        lowerErr.includes('permission') ||
        lowerErr.includes('unavailable') ||
        lowerErr.includes('microphone');
      callbacks.onError(isPermOrHardware && micError ? micError.message : err);
    },
    onEnd: () => {
      cleanupMic();
      callbacks.onEnd();
    },
  });

  return {
    micHandle,
    sttHandle,
    stopAll: () => {
      sttHandle.abort();
      cleanupMic();
    },
  };
}

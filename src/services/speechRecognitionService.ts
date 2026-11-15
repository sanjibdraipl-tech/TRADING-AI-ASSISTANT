import { LanguagePreference } from '../types/voice';
import { mapSpeechRecognitionError } from '../utils/errorHandler';
import { transcribeAudioBlob } from './geminiService';

export interface SttCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string, confidence: number) => void;
  onError: (friendlyError: string) => void;
  onEnd: () => void;
}

export interface SttController {
  mode: 'web-speech' | 'media-recorder';
  stop: () => void;
  abort: () => void;
}

export function isWebSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function getRecognitionLocale(pref: LanguagePreference): string {
  if (pref === 'bn') return 'bn-IN';
  if (pref === 'hi' || pref === 'hi-en') return 'hi-IN';
  if (pref === 'en') return 'en-IN';
  if (pref === 'bn-en') return 'bn-IN';
  if (pref === 'bn-hi-en') return 'hi-IN';
  return 'en-IN';
}

/**
 * Starts browser speech recognition with real-time interim captions
 * or falls back cleanly to MediaRecorder + /api/voice/transcribe if unavailable.
 */
export function startSpeechCapture(
  langPref: LanguagePreference,
  existingStream: MediaStream | null,
  callbacks: SttCallbacks
): SttController {
  const SpeechRec =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  if (SpeechRec) {
    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = getRecognitionLocale(langPref);

    let finalized = false;
    let latestInterim = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      let finalStr = '';
      let bestConfidence = 0.88;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const alt = res[0];
        if (res.isFinal) {
          finalStr += alt.transcript;
          if (typeof alt.confidence === 'number' && alt.confidence > 0) {
            bestConfidence = alt.confidence;
          }
        } else {
          interim += alt.transcript;
        }
      }

      if (interim) {
        latestInterim = interim;
        callbacks.onInterim(interim);
      }

      if (finalStr.trim()) {
        finalized = true;
        callbacks.onFinal(finalStr.trim(), bestConfidence);
      }
    };

    recognition.onerror = (event: any) => {
      const code = String(event?.error || 'unknown');
      const mapped = mapSpeechRecognitionError(code);
      if (mapped) {
        callbacks.onError(mapped);
      }
    };

    recognition.onend = () => {
      if (!finalized && latestInterim.trim()) {
        finalized = true;
        callbacks.onFinal(latestInterim.trim(), 0.72);
      }
      callbacks.onEnd();
    };

    try {
      recognition.start();
    } catch {
      callbacks.onError("Couldn't start voice recognition. Tap the mic again or type below.");
      callbacks.onEnd();
    }

    return {
      mode: 'web-speech',
      stop: () => {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      },
      abort: () => {
        try {
          recognition.abort();
        } catch {
          // ignore
        }
      },
    };
  }

  // Fallback: MediaRecorder -> /api/voice/transcribe
  if (existingStream && typeof MediaRecorder !== 'undefined') {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    const recorder = new MediaRecorder(existingStream, mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];
    let aborted = false;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      if (aborted || chunks.length === 0) {
        callbacks.onEnd();
        return;
      }
      try {
        const blob = new Blob(chunks, { type: mimeType });
        const result = await transcribeAudioBlob(blob, mimeType, langPref);
        if (result.transcript) {
          callbacks.onFinal(result.transcript, result.confidence || 0.85);
        } else {
          callbacks.onError("I couldn't hear any speech. Tap the mic and speak clearly.");
        }
      } catch (err: any) {
        callbacks.onError(err?.message || "I couldn't understand the audio. Please try again.");
      } finally {
        callbacks.onEnd();
      }
    };

    recorder.start();
    return {
      mode: 'media-recorder',
      stop: () => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      },
      abort: () => {
        aborted = true;
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      },
    };
  }

  callbacks.onError('Speech recognition is not supported in this browser. Please use the text input below.');
  callbacks.onEnd();
  return {
    mode: 'web-speech',
    stop: () => {},
    abort: () => {},
  };
}

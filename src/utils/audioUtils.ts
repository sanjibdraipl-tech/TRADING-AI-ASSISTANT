import { mapMicrophoneError } from './errorHandler';

export interface MicMonitorHandle {
  stream: MediaStream;
  getLevels: () => number[];
  getRms: () => number;
  stop: () => void;
}

/**
 * Safely opens a browser microphone stream with Web Audio AnalyserNode
 * for live waveform rendering & barge-in voice activity detection (VAD).
 */
export async function startMicStreamMonitor(barCount: number = 16): Promise<MicMonitorHandle> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('SecurityError');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.fftSize);

    const getLevels = () => {
      analyser.getByteFrequencyData(freqData);
      const bars: number[] = [];
      const step = Math.max(1, Math.floor(freqData.length / barCount));
      for (let i = 0; i < barCount; i++) {
        const val = freqData[Math.min(freqData.length - 1, i * step)] || 0;
        bars.push(Math.min(1, val / 220));
      }
      return bars;
    };

    const getRms = () => {
      analyser.getByteTimeDomainData(timeData);
      let sum = 0;
      for (let i = 0; i < timeData.length; i++) {
        const norm = (timeData[i] - 128) / 128;
        sum += norm * norm;
      }
      return Math.sqrt(sum / timeData.length);
    };

    const stop = () => {
      stopMediaStream(stream);
      if (ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }
    };

    return { stream, getLevels, getRms, stop };
  } catch (err) {
    throw new Error(mapMicrophoneError(err));
  }
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // ignore track cleanup errors
    }
  });
}

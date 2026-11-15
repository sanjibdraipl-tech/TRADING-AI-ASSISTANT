import { GeminiDiagnosticDetails, GeminiErrorType } from '../types/voice';

/**
 * Section 18 & 22: Friendly, non-sensitive error mapping for Microphone, STT, Gemini, and Network failures.
 */

export function mapMicrophoneError(err: unknown): string {
  const name = (err as any)?.name || '';
  const msg = String((err as any)?.message || '');

  if (
    name === 'NotAllowedError' ||
    msg.toLowerCase().includes('permission') ||
    msg.toLowerCase().includes('denied')
  ) {
    return 'Microphone access is unavailable (permission denied). Enable microphone permission in your browser site settings or continue using text chat.';
  }
  if (name === 'NotFoundError' || msg.toLowerCase().includes('device not found')) {
    return 'Microphone access is unavailable (no microphone detected). Connect a mic or continue using text chat.';
  }
  if (name === 'NotReadableError') {
    return 'Microphone is currently busy in another app. Close the other app or use text chat.';
  }
  if (name === 'AbortError') {
    return 'Microphone activation was interrupted. Tap the mic to try again.';
  }
  if (name === 'SecurityError') {
    return 'Microphone access requires HTTPS or localhost. You can continue using text chat.';
  }
  return 'Microphone access is unavailable. You can continue using text chat.';
}

export function mapSpeechRecognitionError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is unavailable. Please allow microphone permission or type below.';
    case 'audio-capture':
      return 'No microphone was found for audio capture.';
    case 'network':
      return 'Internet connection seems unstable for speech recognition.';
    case 'no-speech':
      return "I couldn't hear any speech. Tap the mic and speak clearly.";
    case 'aborted':
      return '';
    default:
      return "I couldn't understand the audio. Please try again.";
  }
}

export function classifyClientErrorType(status?: number, msg?: string): GeminiErrorType {
  const lower = String(msg || '').toLowerCase();
  if (status === 401 || lower.includes('unauthorized')) return 'UNAUTHORIZED';
  if (status === 403 || lower.includes('forbidden') || lower.includes('permission_denied')) {
    return 'FORBIDDEN';
  }
  if (status === 404 || lower.includes('not found') || lower.includes('model')) return 'MODEL_NOT_FOUND';
  if (status === 429 && (lower.includes('quota') || lower.includes('resource_exhausted'))) {
    return 'QUOTA_EXCEEDED';
  }
  if (status === 429) return 'RATE_LIMITED';
  if (status === 504 || lower.includes('timeout') || lower.includes('timed out')) return 'TIMEOUT';
  if (status === 400 && lower.includes('key')) return 'INVALID_API_KEY';
  if (status === 400) return 'INVALID_REQUEST';
  if (status && status >= 500) return 'SERVER_ERROR';
  if (!navigator.onLine || lower.includes('network') || lower.includes('fetch')) return 'NETWORK_ERROR';
  return 'UNKNOWN_ERROR';
}

export function mapAiError(status?: number, serverMsg?: string, errorType?: GeminiErrorType): string {
  const cleanMsg = String(serverMsg || '').replace(/AIza[0-9A-Za-z_-]{15,}/g, '[REDACTED]');
  const prefix = errorType && errorType !== 'NONE' ? `[${errorType}] ` : '';

  if (errorType === 'INVALID_API_KEY' || errorType === 'UNAUTHORIZED') {
    return `Gemini unavailable — ${prefix}${cleanMsg || 'Server GEMINI_API_KEY is missing or invalid.'}`;
  }
  if (errorType === 'FORBIDDEN') {
    return `Gemini unavailable — ${prefix}${cleanMsg || 'Permission denied for this Gemini API key or project.'}`;
  }
  if (errorType === 'MODEL_NOT_FOUND') {
    return `Gemini unavailable — ${prefix}${cleanMsg || 'Selected Gemini model was not found or is unsupported.'}`;
  }
  if (errorType === 'QUOTA_EXCEEDED' || errorType === 'RATE_LIMITED' || status === 429) {
    return `Gemini unavailable — ${prefix}${cleanMsg || 'Quota or rate limit exceeded. Please try again later.'}`;
  }
  if (errorType === 'TIMEOUT' || status === 504) {
    return `Gemini unavailable — please try again. (${prefix}${cleanMsg || 'Upstream request timed out.'})`;
  }
  if (cleanMsg) {
    return `Gemini unavailable — please try again. (${prefix}${cleanMsg})`;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Gemini unavailable — please try again. ([NETWORK_ERROR] Browser appears offline.)';
  }
  return 'Gemini unavailable — please try again.';
}

export function formatDiagnosticSummary(diag: GeminiDiagnosticDetails): string {
  return `${diag.errorType} (HTTP ${diag.httpStatus || 0}) · Model: ${diag.modelName} · ${diag.responseTimeMs}ms · Retries: ${diag.retryCount}/${diag.maxRetries}`;
}

import { VoiceChatMessage } from '../types/conversation';
import {
  DetectedLanguage,
  GeminiConnectionTestResult,
  GeminiDiagnosticDetails,
  LanguagePreference,
  VoiceStockJsonPayload,
} from '../types/voice';
import { classifyClientErrorType, mapAiError } from '../utils/errorHandler';

export interface StreamVoiceParams {
  message: string;
  languagePreference: LanguagePreference;
  detectedLanguage: DetectedLanguage;
  history: VoiceChatMessage[];
  activeTopic?: string;
  lastEntity?: string;
  marketContext?: VoiceStockJsonPayload | Record<string, unknown> | null;
  detailRequested?: boolean;
  modelName?: string;
  signal: AbortSignal;
  onChunk: (chunk: string) => void;
  onDone: (fullText: string, diagnostic: GeminiDiagnosticDetails) => void;
  onError: (friendlyError: string, diagnostic: GeminiDiagnosticDetails) => void;
}

const CLIENT_REQUEST_CEILING_MS = 65000;

/**
 * Calls server-side Gemini connection diagnostic endpoint (/api/ai/test-connection).
 * Never uses the voice or TTS pipeline.
 */
export async function testGeminiConnection(
  modelName?: string
): Promise<GeminiConnectionTestResult> {
  const startMs = Date.now();
  const requestStartTime = new Date().toISOString();
  const model = modelName || 'gemini-4-hydrogen';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), CLIENT_REQUEST_CEILING_MS);

  try {
    const res = await fetch('/api/ai/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ modelName: model }),
    });
    window.clearTimeout(timer);

    const data = await res.json().catch(() => null);
    if (!data || typeof data !== 'object') {
      return {
        ok: false,
        status: 'FAILED',
        message: 'Invalid response from server proxy',
        errorType: 'RESPONSE_PARSE_ERROR',
        httpStatus: res.status || 502,
        endpoint,
        modelName: model,
        requestStartTime,
        responseTimeMs: Date.now() - startMs,
        timeoutDurationMs: 30000,
        errorMessage: 'Server proxy returned non-JSON diagnostic payload.',
        retryCount: 0,
        maxRetries: 1,
      };
    }

    return data as GeminiConnectionTestResult;
  } catch (err: any) {
    window.clearTimeout(timer);
    const isAbort = err?.name === 'AbortError';
    const errorType = isAbort ? 'TIMEOUT' : 'NETWORK_ERROR';
    return {
      ok: false,
      status: 'FAILED',
      message: isAbort ? 'Connection test timed out' : 'Network error reaching server proxy',
      errorType,
      httpStatus: isAbort ? 504 : 0,
      endpoint,
      modelName: model,
      requestStartTime,
      responseTimeMs: Date.now() - startMs,
      timeoutDurationMs: 30000,
      errorMessage: isAbort
        ? 'Request exceeded client diagnostic timeout.'
        : String(err?.message || 'Unable to reach /api/ai/test-connection.'),
      retryCount: 0,
      maxRetries: 1,
    };
  }
}

/**
 * Streams a real Gemini response over SSE (/api/voice/stream).
 * NEVER substitutes a simulated response silently when Gemini fails —
 * propagates exact diagnostic error details so the user can see and retry.
 */
export async function streamVoiceResponse(params: StreamVoiceParams): Promise<void> {
  const { signal, onChunk, onDone, onError } = params;
  const startMs = Date.now();
  const requestStartTime = new Date().toISOString();
  const model = params.modelName || 'gemini-4-hydrogen';
  const defaultEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`;

  const fetchController = new AbortController();
  let clientTimedOut = false;

  const abortListener = () => fetchController.abort();
  signal.addEventListener('abort', abortListener, { once: true });
  const timeoutId = window.setTimeout(() => {
    clientTimedOut = true;
    fetchController.abort();
  }, CLIENT_REQUEST_CEILING_MS);

  try {
    let res: Response;
    try {
      res = await fetch('/api/voice/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: fetchController.signal,
        body: JSON.stringify({
          message: params.message,
          languagePreference: params.languagePreference,
          detectedLanguage: params.detectedLanguage,
          history: params.history.slice(-6).map((m) => ({ role: m.role, text: m.text })),
          activeTopic: params.activeTopic,
          lastEntity: params.lastEntity,
          marketContext: params.marketContext,
          detailRequested: params.detailRequested,
          modelName: model,
        }),
      });
    } catch (fetchErr: any) {
      window.clearTimeout(timeoutId);
      signal.removeEventListener('abort', abortListener);
      if (signal.aborted && !clientTimedOut) return;

      const diag: GeminiDiagnosticDetails = {
        errorType: clientTimedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        httpStatus: clientTimedOut ? 504 : 0,
        endpoint: defaultEndpoint,
        modelName: model,
        requestStartTime,
        responseTimeMs: Date.now() - startMs,
        timeoutDurationMs: 30000,
        errorMessage: clientTimedOut
          ? 'Client waited 65s for server proxy without receiving a Gemini response.'
          : String(fetchErr?.message || 'Network request to /api/voice/stream failed.'),
        retryCount: 0,
        maxRetries: 1,
      };
      onError(mapAiError(diag.httpStatus, diag.errorMessage, diag.errorType), diag);
      return;
    }

    window.clearTimeout(timeoutId);
    signal.removeEventListener('abort', abortListener);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const errorType = payload?.errorType || classifyClientErrorType(res.status, payload?.error || payload?.errorMessage);
      const diag: GeminiDiagnosticDetails = {
        errorType,
        httpStatus: payload?.httpStatus || res.status,
        endpoint: payload?.endpoint || defaultEndpoint,
        modelName: payload?.modelName || model,
        requestStartTime: payload?.requestStartTime || requestStartTime,
        responseTimeMs: payload?.responseTimeMs ?? Date.now() - startMs,
        timeoutDurationMs: payload?.timeoutDurationMs ?? 30000,
        errorMessage: payload?.errorMessage || payload?.error || `HTTP ${res.status} from /api/voice/stream`,
        retryCount: payload?.retryCount ?? 0,
        maxRetries: payload?.maxRetries ?? 1,
        apiConfigured: payload?.apiConfigured,
        envSource: payload?.envSource,
      };
      onError(mapAiError(diag.httpStatus, diag.errorMessage, diag.errorType), diag);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      const diag: GeminiDiagnosticDetails = {
        errorType: 'RESPONSE_PARSE_ERROR',
        httpStatus: res.status,
        endpoint: defaultEndpoint,
        modelName: model,
        requestStartTime,
        responseTimeMs: Date.now() - startMs,
        timeoutDurationMs: 30000,
        errorMessage: 'Streaming response body reader unavailable.',
        retryCount: 0,
        maxRetries: 1,
      };
      onError(mapAiError(diag.httpStatus, diag.errorMessage, diag.errorType), diag);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let completedHandled = false;

    while (true) {
      if (signal.aborted) {
        reader.cancel().catch(() => {});
        return;
      }

      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;
        try {
          const evt = JSON.parse(jsonStr);
          if (evt.error) {
            const evtDiag: GeminiDiagnosticDetails = evt.diagnostic || {
              errorType: 'SERVER_ERROR',
              httpStatus: 502,
              endpoint: defaultEndpoint,
              modelName: model,
              requestStartTime,
              responseTimeMs: Date.now() - startMs,
              timeoutDurationMs: 30000,
              errorMessage: String(evt.error),
              retryCount: 0,
              maxRetries: 1,
            };
            onError(mapAiError(evtDiag.httpStatus, evtDiag.errorMessage, evtDiag.errorType), evtDiag);
            completedHandled = true;
            return;
          }
          if (evt.chunk) {
            fullText += evt.chunk;
            onChunk(evt.chunk);
          }
          if (evt.done) {
            const doneDiag: GeminiDiagnosticDetails = {
              errorType: 'NONE',
              httpStatus: evt.httpStatus || 200,
              endpoint: evt.endpoint || defaultEndpoint,
              modelName: evt.model || model,
              requestStartTime: evt.requestStartTime || requestStartTime,
              responseTimeMs: evt.responseTimeMs ?? Date.now() - startMs,
              timeoutDurationMs: evt.timeoutDurationMs ?? 30000,
              errorMessage: '',
              retryCount: evt.retryCount ?? 0,
              maxRetries: evt.maxRetries ?? 1,
            };
            completedHandled = true;
            if (!fullText.trim()) {
              doneDiag.errorType = 'RESPONSE_PARSE_ERROR';
              doneDiag.httpStatus = 502;
              doneDiag.errorMessage = 'Gemini stream finished with an empty response.';
              onError(mapAiError(502, doneDiag.errorMessage, 'RESPONSE_PARSE_ERROR'), doneDiag);
              return;
            }
            onDone(fullText.trim(), doneDiag);
            return;
          }
        } catch {
          // ignore partial SSE JSON fragment
        }
      }
    }

    if (!completedHandled && !signal.aborted) {
      if (fullText.trim()) {
        onDone(fullText.trim(), {
          errorType: 'NONE',
          httpStatus: 200,
          endpoint: defaultEndpoint,
          modelName: model,
          requestStartTime,
          responseTimeMs: Date.now() - startMs,
          timeoutDurationMs: 30000,
          errorMessage: '',
          retryCount: 0,
          maxRetries: 1,
        });
      } else {
        const diag: GeminiDiagnosticDetails = {
          errorType: 'RESPONSE_PARSE_ERROR',
          httpStatus: 502,
          endpoint: defaultEndpoint,
          modelName: model,
          requestStartTime,
          responseTimeMs: Date.now() - startMs,
          timeoutDurationMs: 30000,
          errorMessage: 'Stream closed before Gemini returned any text.',
          retryCount: 0,
          maxRetries: 1,
        };
        onError(mapAiError(502, diag.errorMessage, 'RESPONSE_PARSE_ERROR'), diag);
      }
    }
  } catch (err: any) {
    window.clearTimeout(timeoutId);
    signal.removeEventListener('abort', abortListener);
    if (err?.name === 'AbortError' || signal.aborted) return;

    const diag: GeminiDiagnosticDetails = {
      errorType: 'UNKNOWN_ERROR',
      httpStatus: 0,
      endpoint: defaultEndpoint,
      modelName: model,
      requestStartTime,
      responseTimeMs: Date.now() - startMs,
      timeoutDurationMs: 30000,
      errorMessage: String(err?.message || 'Unexpected error during Gemini streaming.'),
      retryCount: 0,
      maxRetries: 1,
    };
    onError(mapAiError(0, diag.errorMessage, 'UNKNOWN_ERROR'), diag);
  }
}

/**
 * Explicit opt-in offline simulated helper (ONLY used if user explicitly requests
 * a demo/offline reply — NEVER substituted silently for a failed Gemini request).
 */
export function buildExplicitDemoReply(
  message: string,
  lang: DetectedLanguage,
  marketContext?: VoiceStockJsonPayload | Record<string, unknown> | null
): string {
  const lower = message.toLowerCase();
  const isStock = marketContext && 'symbol' in marketContext;
  const isBreadth = marketContext && 'universeCount' in marketContext;

  if (lower.includes('ema 20') && lower.includes('ema 50')) {
    if (lang === 'bn') {
      return 'EMA 20 হলো শেষ ২০ দিনের exponential গড় দাম, যা স্বল্পমেয়াদী trend দেখায়। EMA 50 হলো ৫০ দিনের গড়, যা মাঝারি মেয়াদের trend আর support বুঝতে সাহায্য করে।';
    }
    if (lang === 'hi' || lang === 'hi-en') {
      return 'EMA 20 पिछले 20 दिनों का exponential moving average है जो short-term momentum दिखाता है, जबकि EMA 50 medium-term trend और support दर्शाता है।';
    }
    if (lang === 'bn-en') {
      return 'EMA 20 short-term momentum দ্রুত capture করে, আর EMA 50 medium-term trend আর institutional support দেখায়।';
    }
    return 'EMA 20 tracks the last 20 sessions for short-term momentum, while EMA 50 smooths 50 sessions to show medium-term trend support.';
  }

  if (isStock) {
    const s = marketContext as VoiceStockJsonPayload;
    const priceText = s.price !== null ? `₹${s.price}` : 'unavailable';
    const rsiText = s.rsi14 !== null ? `${s.rsi14.toFixed(1)}` : 'unavailable';
    const ema20Text = s.ema20 !== null ? `₹${s.ema20.toFixed(1)}` : 'unavailable';
    const statusText = `${s.dataStatus} (${s.sourceLabel})`;

    if (lang === 'bn' || lang === 'bn-en') {
      return `অফলাইন ডেমো ডেটা (${statusText}) অনুযায়ী ${s.companyName}-এর দাম ${priceText}, RSI হলো ${rsiText} এবং EMA 20 আছে ${ema20Text}-এ। Setup status: ${s.setupStatus}। এটি শুধুমাত্র শিক্ষামূলক বিশ্লেষণ।`;
    }
    if (lang === 'hi' || lang === 'hi-en') {
      return `Offline demo data (${statusText}) के अनुसार ${s.companyName} का price ${priceText}, RSI ${rsiText} और EMA 20 ${ema20Text} है। Setup status: ${s.setupStatus}।`;
    }
    return `Based on local ${statusText} data, ${s.companyName} (${s.symbol}) is at ${priceText} with RSI ${rsiText} and EMA 20 near ${ema20Text}. Setup status: ${s.setupStatus}. Educational analysis only.`;
  }

  if (isBreadth) {
    const m = marketContext as any;
    if (lang === 'bn' || lang === 'bn-en') {
      return `অফলাইন ডেমো ডেটা অনুযায়ী ট্র্যাক করা ${m.universeCount}-টি স্টকের মধ্যে ${m.bullishAboveEma50Count}-টি EMA 50-এর উপরে রয়েছে এবং ${m.setupDetectedCount}-টি সেটআপ পাওয়া গেছে।`;
    }
    if (lang === 'hi' || lang === 'hi-en') {
      return `Offline demo data के अनुसार ${m.universeCount} stocks में से ${m.bullishAboveEma50Count} EMA 50 के ऊपर हैं और ${m.setupDetectedCount} में setup दिख रहा है।`;
    }
    return `Local ${m.dataStatus} dataset shows ${m.bullishAboveEma50Count} of ${m.universeCount} NSE/BSE stocks above EMA 50 with ${m.setupDetectedCount} setups detected.`;
  }

  if (lang === 'bn' || lang === 'bn-en') {
    return 'এটি একটি স্থানীয় অফলাইন ডেমো উত্তর (Gemini সংযোগ ছাড়া)। আপনার স্টক, RSI বা EMA সংক্রান্ত স্থানীয় ডেটা দেখতে যেকোনো স্টকের নাম লিখুন।';
  }
  if (lang === 'hi' || lang === 'hi-en') {
    return 'यह एक local offline demo उत्तर है (Gemini से नहीं)। Local stock RSI या EMA देखने के लिए stock का नाम लिखें।';
  }
  return 'This is a local offline demo reply (not generated by Gemini). Verify your Gemini connection in Diagnostics for live neural responses.';
}

export async function transcribeAudioBlob(
  blob: Blob,
  mimeType: string,
  languageHint: LanguagePreference
): Promise<{ transcript: string; confidence: number }> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
    reader.readAsDataURL(blob);
  });

  const res = await fetch('/api/voice/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64: base64,
      mimeType: mimeType || 'audio/webm',
      languageHint,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "I couldn't understand the audio. Please try again.");
  }

  return res.json();
}

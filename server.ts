import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';

const GEMINI_TIMEOUT_MS = Math.max(
  5000,
  parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10) || 30000
);
const RETRY_COUNT = Math.max(
  0,
  Math.min(2, parseInt(process.env.GEMINI_RETRY_COUNT || '1', 10) || 1)
);

const ALLOWED_TEXT_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
]);

app.use(express.json({ limit: '4mb' }));

// Explicitly permit microphone delegation for preview iframes and standalone tabs
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Permissions-Policy', 'microphone=*');
  next();
});

// Simple sliding-window rate limiter for AI routes (Section 41 Security)
const rateBuckets = new Map<string, number[]>();
function aiRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'local';
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = 45;
  const hits = (rateBuckets.get(ip) || []).filter((t) => now - t < windowMs);
  if (hits.length >= maxRequests) {
    return res.status(429).json({
      unavailable: true,
      quotaExceeded: true,
      errorType: 'RATE_LIMITED',
      httpStatus: 429,
      error: 'Local server AI rate limit reached. Please wait a moment and try again.',
    });
  }
  hits.push(now);
  rateBuckets.set(ip, hits);
  next();
}

// Initialize Gemini Client strictly on server-side (never exposed to browser)
const envSource = process.env.GEMINI_API_KEY
  ? 'GEMINI_API_KEY (server env)'
  : process.env.GOOGLE_API_KEY
  ? 'GOOGLE_API_KEY (server env)'
  : 'missing';

const rawKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '')
  .trim()
  .replace(/^["']|["']$/g, '');

const isKeyValid = Boolean(
  rawKey &&
    rawKey !== 'MY_GEMINI_API_KEY' &&
    !rawKey.startsWith('your_') &&
    rawKey.length > 10
);

const ai = isKeyValid
  ? new GoogleGenAI({
      apiKey: rawKey,
      httpOptions: {
        timeout: GEMINI_TIMEOUT_MS,
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

function resolveModel(requestedModel?: unknown): string {
  if (typeof requestedModel === 'string' && ALLOWED_TEXT_MODELS.has(requestedModel)) {
    return requestedModel;
  }
  return ALLOWED_TEXT_MODELS.has(MODEL_NAME) ? MODEL_NAME : 'gemini-4-hydrogen';
}

type GeminiErrorType =
  | 'INVALID_API_KEY'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'MODEL_NOT_FOUND'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_REQUEST'
  | 'SERVER_ERROR'
  | 'RESPONSE_PARSE_ERROR'
  | 'UNKNOWN_ERROR';

function buildSafeEndpoint(model: string, rpcMethod: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${rpcMethod}`;
}

function sanitizeErrorText(input: unknown): string {
  let msg = String(input || 'Unknown error');
  if (rawKey) {
    msg = msg.split(rawKey).join('[REDACTED_KEY]');
  }
  msg = msg.replace(/AIza[0-9A-Za-z_-]{15,}/g, '[REDACTED_KEY]');
  msg = msg.replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED]');
  return msg.slice(0, 400);
}

function classifyGeminiError(
  err: any,
  explicitStatus?: number
): {
  errorType: GeminiErrorType;
  httpStatus: number;
  errorMessage: string;
  retryable: boolean;
} {
  const safeMsg = sanitizeErrorText(err?.message || err?.statusText || err || 'Unknown Gemini error');
  const lower = safeMsg.toLowerCase();
  const statusFromErr =
    typeof explicitStatus === 'number'
      ? explicitStatus
      : typeof err?.status === 'number'
      ? err.status
      : typeof err?.statusCode === 'number'
      ? err.statusCode
      : typeof err?.code === 'number'
      ? err.code
      : 0;

  if (!isKeyValid) {
    return {
      errorType: 'INVALID_API_KEY',
      httpStatus: 401,
      errorMessage: 'GEMINI_API_KEY is missing or placeholder on the server.',
      retryable: false,
    };
  }

  if (
    err?.name === 'AbortError' ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('etimedout') ||
    lower.includes('upstream_timeout') ||
    statusFromErr === 504
  ) {
    return {
      errorType: 'TIMEOUT',
      httpStatus: 504,
      errorMessage: `Gemini API request timed out after ${GEMINI_TIMEOUT_MS}ms.`,
      retryable: true,
    };
  }

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('invalid api key')
  ) {
    return {
      errorType: 'INVALID_API_KEY',
      httpStatus: statusFromErr || 400,
      errorMessage: `Invalid Gemini API key: ${safeMsg}`,
      retryable: false,
    };
  }

  if (statusFromErr === 401 || lower.includes('unauthenticated') || lower.includes('unauthorized')) {
    return {
      errorType: 'UNAUTHORIZED',
      httpStatus: 401,
      errorMessage: `Unauthorized Gemini API request: ${safeMsg}`,
      retryable: false,
    };
  }

  if (statusFromErr === 403 || lower.includes('permission_denied') || lower.includes('forbidden')) {
    return {
      errorType: 'FORBIDDEN',
      httpStatus: 403,
      errorMessage: `Gemini API permission denied (403): ${safeMsg}`,
      retryable: false,
    };
  }

  if (
    statusFromErr === 404 ||
    lower.includes('not_found') ||
    lower.includes('not found') ||
    lower.includes('is not supported for')
  ) {
    return {
      errorType: 'MODEL_NOT_FOUND',
      httpStatus: 404,
      errorMessage: `Selected Gemini model is unavailable or unsupported: ${safeMsg}`,
      retryable: false,
    };
  }

  if (statusFromErr === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    const isQuota = lower.includes('quota') || lower.includes('billing') || lower.includes('resource_exhausted');
    return {
      errorType: isQuota ? 'QUOTA_EXCEEDED' : 'RATE_LIMITED',
      httpStatus: 429,
      errorMessage: `Gemini API ${isQuota ? 'quota exceeded' : 'rate limited'} (429): ${safeMsg}`,
      retryable: !isQuota,
    };
  }

  if (statusFromErr === 400 || lower.includes('invalid_argument') || lower.includes('bad request')) {
    return {
      errorType: 'INVALID_REQUEST',
      httpStatus: 400,
      errorMessage: `Invalid Gemini request payload (400): ${safeMsg}`,
      retryable: false,
    };
  }

  if (
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('eai_again') ||
    lower.includes('fetch failed') ||
    lower.includes('network') ||
    lower.includes('socket') ||
    lower.includes('tls') ||
    lower.includes('certificate')
  ) {
    return {
      errorType: 'NETWORK_ERROR',
      httpStatus: statusFromErr || 502,
      errorMessage: `Network connection to Gemini API failed: ${safeMsg}`,
      retryable: true,
    };
  }

  if (lower.includes('parse') || lower.includes('empty response') || lower.includes('no audio')) {
    return {
      errorType: 'RESPONSE_PARSE_ERROR',
      httpStatus: statusFromErr || 502,
      errorMessage: `Gemini returned an unreadable or empty response: ${safeMsg}`,
      retryable: false,
    };
  }

  if (statusFromErr >= 500 || lower.includes('internal') || lower.includes('unavailable')) {
    return {
      errorType: 'SERVER_ERROR',
      httpStatus: statusFromErr || 503,
      errorMessage: `Gemini upstream server error (${statusFromErr || 503}): ${safeMsg}`,
      retryable: true,
    };
  }

  return {
    errorType: 'UNKNOWN_ERROR',
    httpStatus: statusFromErr || 500,
    errorMessage: safeMsg,
    retryable: false,
  };
}

function logGeminiTelemetry(details: {
  route: string;
  endpoint: string;
  modelName: string;
  requestStartTime: string;
  responseTimeMs: number;
  timeoutDurationMs: number;
  httpStatus: number;
  retryCount: number;
  errorType: string;
  errorMessage: string;
}) {
  console.log(
    `[GeminiProxy] route=${details.route} status=${details.httpStatus} type=${details.errorType} model=${details.modelName} time=${details.responseTimeMs}ms timeout=${details.timeoutDurationMs}ms retries=${details.retryCount}/${RETRY_COUNT} start=${details.requestStartTime} endpoint=${details.endpoint} msg="${details.errorMessage}"`
  );
}

function linkAbortSignals(
  timeoutMs: number,
  externalSignal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void; wasTimedOut: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error(`UPSTREAM_TIMEOUT_${timeoutMs}MS`));
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort(new Error('CLIENT_ABORTED'));
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(new Error('CLIENT_ABORTED'));
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    wasTimedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

async function runGeminiWithRetry<T>(opts: {
  route: string;
  modelName: string;
  rpcMethod: string;
  externalSignal?: AbortSignal;
  timeoutMs?: number;
  maxRetries?: number;
  fn: (abortSignal: AbortSignal, timeoutMs: number) => Promise<T>;
}): Promise<{
  result: T;
  requestStartTime: string;
  responseTimeMs: number;
  retryCount: number;
  endpoint: string;
}> {
  const timeoutMs = opts.timeoutMs ?? GEMINI_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? RETRY_COUNT;
  const endpoint = buildSafeEndpoint(opts.modelName, opts.rpcMethod);
  const requestStartTime = new Date().toISOString();
  const overallStart = Date.now();
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (opts.externalSignal?.aborted) {
      throw Object.assign(new Error('CLIENT_ABORTED'), { clientAborted: true });
    }

    const linked = linkAbortSignals(timeoutMs, opts.externalSignal);
    try {
      const result = await opts.fn(linked.signal, timeoutMs);
      linked.cleanup();
      const responseTimeMs = Date.now() - overallStart;
      logGeminiTelemetry({
        route: opts.route,
        endpoint,
        modelName: opts.modelName,
        requestStartTime,
        responseTimeMs,
        timeoutDurationMs: timeoutMs,
        httpStatus: 200,
        retryCount,
        errorType: 'NONE',
        errorMessage: 'OK',
      });
      return { result, requestStartTime, responseTimeMs, retryCount, endpoint };
    } catch (err: any) {
      const timedOut = linked.wasTimedOut();
      linked.cleanup();

      if (opts.externalSignal?.aborted && !timedOut) {
        throw Object.assign(new Error('CLIENT_ABORTED'), { clientAborted: true });
      }

      const effectiveErr = timedOut
        ? Object.assign(new Error(`Request timed out after ${timeoutMs}ms`), { status: 504 })
        : err;
      const classified = classifyGeminiError(effectiveErr);

      if (attempt < maxRetries && classified.retryable) {
        retryCount += 1;
        const backoffMs = 800 * Math.pow(2, attempt);
        logGeminiTelemetry({
          route: opts.route,
          endpoint,
          modelName: opts.modelName,
          requestStartTime,
          responseTimeMs: Date.now() - overallStart,
          timeoutDurationMs: timeoutMs,
          httpStatus: classified.httpStatus,
          retryCount,
          errorType: classified.errorType,
          errorMessage: `Retrying in ${backoffMs}ms: ${classified.errorMessage}`,
        });
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }

      const responseTimeMs = Date.now() - overallStart;
      logGeminiTelemetry({
        route: opts.route,
        endpoint,
        modelName: opts.modelName,
        requestStartTime,
        responseTimeMs,
        timeoutDurationMs: timeoutMs,
        httpStatus: classified.httpStatus,
        retryCount,
        errorType: classified.errorType,
        errorMessage: classified.errorMessage,
      });

      throw Object.assign(new Error(classified.errorMessage), {
        diagnostic: {
          errorType: classified.errorType,
          httpStatus: classified.httpStatus,
          endpoint,
          modelName: opts.modelName,
          requestStartTime,
          responseTimeMs,
          timeoutDurationMs: timeoutMs,
          errorMessage: classified.errorMessage,
          retryCount,
          maxRetries,
          apiConfigured: isKeyValid,
          envSource,
        },
      });
    }
  }

  throw new Error('Unexpected retry termination');
}

// Section 20: Exact Gemini Analyst System Instruction (for Structured Stock Reports)
const GEMINI_ANALYST_SYSTEM_INSTRUCTION = `You are an educational market-analysis assistant for a personal research application called SMART TRADER AI.

Use ONLY the JSON data supplied by the application.
Do not invent prices, fundamentals, news, indicators, events, or missing data.
Do NOT modify any numbers provided in the JSON. All calculations are already computed deterministically by the application.
Clearly distinguish FACT from INTERPRETATION.

Explain:
- Trend and technical setup.
- Fundamental strengths and weaknesses.
- Liquidity, earnings, sector, macro and event risks.
- Exact user-defined condition that invalidates the setup.
- Pre-trade checklist items.

Never claim certainty about future prices.
Never promise profits.
Never encourage oversized positions.
Never recommend leverage.
Never recommend options selling.
Never override the application's deterministic risk controls.
NEVER use the words BUY, SELL, STRONG BUY, or TARGET as trade recommendations. Use only SETUP DETECTED, WATCH, NO SETUP, INVALID, INSUFFICIENT DATA, RISK TOO HIGH, or WAIT FOR CONFIRMATION.

If data is missing, stale, inconsistent or low quality, explicitly state that limitation and do not provide a confident conclusion.
Do not invent news.
Do not invent corporate actions.
Do not invent analyst opinions.

Use simple, friendly language.
When appropriate, address the user naturally as 'Friend'.
Always finish with:
'Educational analysis only. Not investment advice. Markets involve risk of loss.'`;

// Section 9 & 10: Real-Time Multilingual Voice Assistant System Instruction
const VOICE_ASSISTANT_SYSTEM_INSTRUCTION = `You are a friendly real-time voice AI assistant for SMART TRADER AI.

Your job is to understand the user's spoken or written language naturally.

You support:
- Bengali (বাংলা)
- English (en-IN)
- Hindi (हिंदी)
- Bengali-English, Hindi-English, and Bengali-Hindi-English mixed conversation.

Always detect the user's language automatically unless a specific target language preference is specified.
- If the user speaks Bengali, respond naturally in Bengali.
- If the user speaks Hindi, respond naturally in Hindi.
- If the user speaks English, respond naturally in English.
- If the user speaks mixed language (Banglish / Hinglish), respond naturally in matching mixed language (keeping stock-market terms like RSI, EMA 20, MACD, Nifty, Bank Nifty, bullish, volume in English).
- If the user explicitly asks "English-এ explain করো" or "in English", reply in English.
- If the user explicitly asks "বাংলায় বলুন" or "in Bengali", reply in Bengali.
- If the user explicitly asks "हिंदी में बताओ" or "in Hindi", reply in Hindi.

Do not translate technical terms unnecessarily.
Be concise during voice conversation: normally 1-4 short, natural sentences unless the user explicitly asks for detail.
Use short, speakable sentences with natural pauses.
NEVER speak URLs, raw JSON, markdown symbols (#, *, backticks), or programming code unless specifically requested.

If the user's transcript looks unclear or ambiguous, ask a short clarification instead of inventing meaning.
Never invent prices, candles, indicators, news, or corporate actions.
Use ONLY verified JSON market data supplied in the context. If market data is stale, demo, delayed, or missing (null), explicitly mention that limitation calmly.

Clearly distinguish FACT from INTERPRETATION from ASSUMPTION.
For financial-market questions:
- Never guarantee profit or claim certainty about future prices.
- Never provide personalised investment advice.
- Never say BUY, SELL, STRONG BUY, or TARGET as trade recommendations.
- When market context is answered, include or conclude cleanly with: "Educational analysis only. Not investment advice. Markets involve risk of loss."

Sound friendly, calm, professional, and human ("Friend").`;

// Health / AI Configuration Status (never exposes secrets)
app.get('/api/ai/status', (_req: Request, res: Response) => {
  res.json({
    available: Boolean(ai),
    modelName: resolveModel(MODEL_NAME),
    supportedModels: Array.from(ALLOWED_TEXT_MODELS),
    keyConfigured: Boolean(ai),
    apiKeyStatus: isKeyValid ? 'configured' : 'missing',
    envSource,
    timeoutMs: GEMINI_TIMEOUT_MS,
    retryCount: RETRY_COUNT,
    message: ai
      ? `Gemini server proxy configured (${envSource})`
      : 'GEMINI_API_KEY is missing on the server. Configure GEMINI_API_KEY in Secrets or .env.local.',
  });
});

// Requirement 5 & 13: Dedicated Development/Diagnostics Gemini Connection Test (no TTS side effects)
app.all('/api/ai/test-connection', async (req: Request, res: Response) => {
  const requestedModel = req.body?.modelName || req.query?.modelName;
  const selectedModel = resolveModel(requestedModel);
  const endpoint = buildSafeEndpoint(selectedModel, 'generateContent');
  const requestStartTime = new Date().toISOString();

  if (!ai) {
    const diag = {
      ok: false,
      status: 'FAILED' as const,
      errorType: 'INVALID_API_KEY' as const,
      httpStatus: 401,
      endpoint,
      modelName: selectedModel,
      requestStartTime,
      responseTimeMs: 0,
      timeoutDurationMs: GEMINI_TIMEOUT_MS,
      retryCount: 0,
      maxRetries: RETRY_COUNT,
      apiConfigured: false,
      envSource,
      errorMessage: 'GEMINI_API_KEY is missing or placeholder in server environment.',
    };
    logGeminiTelemetry({ route: '/api/ai/test-connection', ...diag });
    return res.status(401).json(diag);
  }

  const abortController = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const { result, responseTimeMs, retryCount } = await runGeminiWithRetry({
      route: '/api/ai/test-connection',
      modelName: selectedModel,
      rpcMethod: 'generateContent',
      externalSignal: abortController.signal,
      fn: async (signal, timeoutMs) =>
        ai.models.generateContent({
          model: selectedModel,
          contents: 'Reply with OK.',
          config: {
            abortSignal: signal,
            httpOptions: { timeout: timeoutMs },
          },
        }),
    });

    const replyText = (result?.text || '').trim();
    if (!replyText) {
      return res.status(502).json({
        ok: false,
        status: 'FAILED',
        errorType: 'RESPONSE_PARSE_ERROR',
        httpStatus: 502,
        endpoint,
        modelName: selectedModel,
        requestStartTime,
        responseTimeMs,
        timeoutDurationMs: GEMINI_TIMEOUT_MS,
        retryCount,
        maxRetries: RETRY_COUNT,
        apiConfigured: true,
        envSource,
        errorMessage: 'Gemini API responded with an empty text candidate.',
      });
    }

    return res.json({
      ok: true,
      status: 'SUCCESS',
      message: 'Gemini connection working',
      errorType: 'NONE',
      httpStatus: 200,
      endpoint,
      modelName: selectedModel,
      requestStartTime,
      responseTimeMs,
      timeoutDurationMs: GEMINI_TIMEOUT_MS,
      retryCount,
      maxRetries: RETRY_COUNT,
      apiConfigured: true,
      envSource,
      replyPreview: replyText.slice(0, 80),
      errorMessage: '',
    });
  } catch (err: any) {
    if (err?.clientAborted) return;
    const diag = err?.diagnostic || {
      errorType: 'UNKNOWN_ERROR',
      httpStatus: 500,
      endpoint,
      modelName: selectedModel,
      requestStartTime,
      responseTimeMs: 0,
      timeoutDurationMs: GEMINI_TIMEOUT_MS,
      errorMessage: sanitizeErrorText(err?.message || err),
      retryCount: 0,
      maxRetries: RETRY_COUNT,
      apiConfigured: true,
      envSource,
    };
    return res.status(diag.httpStatus >= 400 ? diag.httpStatus : 502).json({
      ok: false,
      status: 'FAILED',
      ...diag,
    });
  }
});

// Section 19 & 39: Structured JSON Explanation Endpoint
app.post('/api/ai/analyze', aiRateLimiter, async (req: Request, res: Response) => {
  const { structuredPayload, modelName } = req.body || {};
  const selectedModel = resolveModel(modelName);
  const endpoint = buildSafeEndpoint(selectedModel, 'generateContent');
  const requestStartTime = new Date().toISOString();

  if (!structuredPayload || typeof structuredPayload !== 'object') {
    return res.status(400).json({
      unavailable: true,
      errorType: 'INVALID_REQUEST',
      httpStatus: 400,
      modelName: selectedModel,
      endpoint,
      error: 'structuredPayload JSON is required.',
    });
  }

  if (!ai) {
    return res.status(401).json({
      unavailable: true,
      errorType: 'INVALID_API_KEY',
      httpStatus: 401,
      modelName: selectedModel,
      endpoint,
      requestStartTime,
      responseTimeMs: 0,
      timeoutDurationMs: GEMINI_TIMEOUT_MS,
      retryCount: 0,
      maxRetries: RETRY_COUNT,
      error: 'Gemini unavailable — GEMINI_API_KEY is missing on the server.',
    });
  }

  const abortController = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const userPrompt = `Analyze ONLY the following pre-calculated JSON from SMART TRADER AI and format your response strictly using these exact headings:

DATA STATUS
(Verified / Warning / Insufficient based on data_quality and data_integrity)

FACTS
(Only supplied/calculated numbers from the JSON — do not modify or invent any number)

TECHNICAL INTERPRETATION
(Explain trend, EMA alignment, RSI, ATR, volume ratio, and why the setup passed or failed)

FUNDAMENTAL INTERPRETATION
(Strengths and weaknesses from fundamental_score and components; note any N/A fields)

RISK
- Liquidity:
- Earnings / Event:
- Sector & Macro:

INVALIDATION
(Exact user-defined condition from invalidation_condition)

PRE-TRADE CHECKLIST
(Clear checklist items including liquidity, data quality, risk limit status, and R:R check)

CONCLUSION
(State one of: SETUP DETECTED / WATCH / NO SETUP / INVALID / INSUFFICIENT DATA / RISK TOO HIGH / WAIT FOR CONFIRMATION. Never use BUY or SELL.)

Finish with the exact line:
Educational analysis only. Not investment advice. Markets involve risk of loss.

SUPPLIED APPLICATION JSON:
${JSON.stringify(structuredPayload, null, 2)}`;

    const { result, responseTimeMs, retryCount } = await runGeminiWithRetry({
      route: '/api/ai/analyze',
      modelName: selectedModel,
      rpcMethod: 'generateContent',
      externalSignal: abortController.signal,
      fn: async (signal, timeoutMs) =>
        ai.models.generateContent({
          model: selectedModel,
          contents: userPrompt,
          config: {
            systemInstruction: GEMINI_ANALYST_SYSTEM_INSTRUCTION,
            abortSignal: signal,
            httpOptions: { timeout: timeoutMs },
          },
        }),
    });

    const text = result?.text?.trim();
    if (!text) {
      return res.status(502).json({
        unavailable: true,
        errorType: 'RESPONSE_PARSE_ERROR',
        httpStatus: 502,
        modelName: selectedModel,
        endpoint,
        responseTimeMs,
        retryCount,
        error: 'Gemini returned an empty analysis response. Please try again.',
      });
    }

    return res.json({
      text,
      model: selectedModel,
      responseTimeMs,
      retryCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error?.clientAborted) return;
    const diag = error?.diagnostic || classifyGeminiError(error);
    return res.status(diag.httpStatus >= 400 ? diag.httpStatus : 502).json({
      unavailable: true,
      ...diag,
      error: diag.errorMessage || 'Gemini unavailable — please try again.',
    });
  }
});

// Section 21: AI Conversation Mode
app.post('/api/ai/chat', aiRateLimiter, async (req: Request, res: Response) => {
  const { message, appContextJson, modelName } = req.body || {};
  const selectedModel = resolveModel(modelName);
  const endpoint = buildSafeEndpoint(selectedModel, 'generateContent');
  const requestStartTime = new Date().toISOString();

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      unavailable: true,
      errorType: 'INVALID_REQUEST',
      httpStatus: 400,
      modelName: selectedModel,
      endpoint,
      error: 'message string is required.',
    });
  }

  if (!ai) {
    return res.status(401).json({
      unavailable: true,
      errorType: 'INVALID_API_KEY',
      httpStatus: 401,
      modelName: selectedModel,
      endpoint,
      requestStartTime,
      responseTimeMs: 0,
      timeoutDurationMs: GEMINI_TIMEOUT_MS,
      retryCount: 0,
      maxRetries: RETRY_COUNT,
      error: 'Gemini unavailable — GEMINI_API_KEY is missing on the server.',
    });
  }

  const abortController = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const prompt = `Greet the user naturally (e.g. "Friend, let's analyse the setup step by step." when starting or answering).
Answer the user's question using ONLY the verified application JSON context below.
If the verified data required to answer the question does not exist in the JSON below, say:
"I don't have enough verified data to answer that."
Do not hallucinate or invent any prices, news, or indicators.

VERIFIED APPLICATION CONTEXT JSON:
${JSON.stringify(appContextJson || {}, null, 2)}

USER QUESTION:
${message.slice(0, 2000)}`;

    const { result, responseTimeMs, retryCount } = await runGeminiWithRetry({
      route: '/api/ai/chat',
      modelName: selectedModel,
      rpcMethod: 'generateContent',
      externalSignal: abortController.signal,
      fn: async (signal, timeoutMs) =>
        ai.models.generateContent({
          model: selectedModel,
          contents: prompt,
          config: {
            systemInstruction: GEMINI_ANALYST_SYSTEM_INSTRUCTION,
            abortSignal: signal,
            httpOptions: { timeout: timeoutMs },
          },
        }),
    });

    const text = result?.text?.trim();
    if (!text) {
      return res.status(502).json({
        unavailable: true,
        errorType: 'RESPONSE_PARSE_ERROR',
        httpStatus: 502,
        modelName: selectedModel,
        endpoint,
        responseTimeMs,
        retryCount,
        error: 'Gemini returned an empty response. Please try again.',
      });
    }

    return res.json({
      text,
      model: selectedModel,
      responseTimeMs,
      retryCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error?.clientAborted) return;
    const diag = error?.diagnostic || classifyGeminiError(error);
    return res.status(diag.httpStatus >= 400 ? diag.httpStatus : 502).json({
      unavailable: true,
      ...diag,
      error: diag.errorMessage || 'Gemini unavailable — please try again.',
    });
  }
});

// Real-Time Voice-to-Voice Streaming SSE Endpoint (Supports Bengali, Hindi, English, Mixed)
app.post('/api/voice/stream', aiRateLimiter, async (req: Request, res: Response) => {
  const {
    message,
    languagePreference = 'auto',
    detectedLanguage = 'en',
    history = [],
    activeTopic,
    lastEntity,
    marketContext,
    detailRequested = false,
    modelName,
  } = req.body || {};

  const selectedModel = resolveModel(modelName);
  const endpoint = buildSafeEndpoint(selectedModel, 'streamGenerateContent');
  const requestStartTime = new Date().toISOString();

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      unavailable: true,
      errorType: 'INVALID_REQUEST',
      httpStatus: 400,
      modelName: selectedModel,
      endpoint,
      requestStartTime,
      responseTimeMs: 0,
      timeoutDurationMs: GEMINI_TIMEOUT_MS,
      retryCount: 0,
      maxRetries: RETRY_COUNT,
      error: 'Valid spoken or text message is required.',
    });
  }

  if (!ai) {
    const diag = {
      unavailable: true,
      errorType: 'INVALID_API_KEY' as const,
      httpStatus: 401,
      modelName: selectedModel,
      endpoint,
      requestStartTime,
      responseTimeMs: 0,
      timeoutDurationMs: GEMINI_TIMEOUT_MS,
      retryCount: 0,
      maxRetries: RETRY_COUNT,
      apiConfigured: false,
      envSource,
      errorMessage: 'GEMINI_API_KEY is missing or placeholder on the server.',
      error: 'Gemini unavailable — GEMINI_API_KEY is not configured on the server.',
    };
    logGeminiTelemetry({
      route: '/api/voice/stream',
      endpoint,
      modelName: selectedModel,
      requestStartTime,
      responseTimeMs: 0,
      timeoutDurationMs: GEMINI_TIMEOUT_MS,
      httpStatus: 401,
      retryCount: 0,
      errorType: 'INVALID_API_KEY',
      errorMessage: diag.errorMessage,
    });
    return res.status(401).json(diag);
  }

  const abortController = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  let headersCommitted = false;

  try {
    const compactHistory = Array.isArray(history)
      ? history.slice(-6).map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: String(m.text || '').slice(0, 500),
        }))
      : [];

    const langDirective =
      languagePreference === 'bn'
        ? 'Respond strictly in natural Bengali (বাংলা), keeping technical indicators like RSI, EMA 20, MACD, Nifty, Bank Nifty in standard form.'
        : languagePreference === 'hi'
        ? 'Respond strictly in natural Hindi (हिंदी), keeping technical indicators like RSI, EMA 20, MACD, Nifty, Bank Nifty in standard form.'
        : languagePreference === 'en'
        ? 'Respond strictly in clear, friendly English.'
        : languagePreference === 'bn-en'
        ? 'Respond in natural Bengali-English mixed conversational tone.'
        : languagePreference === 'hi-en'
        ? 'Respond in natural Hindi-English mixed (Hinglish) conversational tone.'
        : languagePreference === 'bn-hi-en'
        ? 'Respond naturally matching the user mixed Bengali-Hindi-English language.'
        : `User detected language: ${detectedLanguage}. Mirror their language naturally (bn=Bengali, hi=Hindi, en=English, bn-en=Bengali-English mixed, hi-en=Hindi-English mixed, bn-hi-en=Bengali-Hindi-English mixed).`;

    const prompt = `${langDirective}
${detailRequested ? 'User asked for detail: you may provide a thorough but well-structured explanation.' : 'Voice response rule: keep it crisp (1-4 short speakable sentences, no markdown bullets or URLs).'}
Active Topic: ${activeTopic || 'None'}
Last Entity: ${lastEntity || 'None'}

Recent Conversation Context:
${JSON.stringify(compactHistory)}

Verified Market Data JSON (if any — NEVER invent missing/null values; note Demo/Delayed status if not LIVE):
${JSON.stringify(marketContext || null)}

Current User Utterance:
${message.trim().slice(0, 2000)}`;

    const { result: firstPayload, retryCount } = await runGeminiWithRetry({
      route: '/api/voice/stream',
      modelName: selectedModel,
      rpcMethod: 'streamGenerateContent',
      externalSignal: abortController.signal,
      fn: async (signal, timeoutMs) => {
        const stream = await ai.models.generateContentStream({
          model: selectedModel,
          contents: prompt,
          config: {
            systemInstruction: VOICE_ASSISTANT_SYSTEM_INSTRUCTION,
            abortSignal: signal,
            httpOptions: { timeout: timeoutMs },
          },
        });
        const iterator = stream[Symbol.asyncIterator]();
        const firstResult = await iterator.next();
        return { iterator, firstResult };
      },
    });

    if (abortController.signal.aborted) return;

    const { iterator, firstResult } = firstPayload;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    headersCommitted = true;

    const startMs = Date.now();
    if (!firstResult.done && firstResult.value?.text) {
      res.write(
        `data: ${JSON.stringify({
          chunk: firstResult.value.text,
          model: selectedModel,
          retryCount,
        })}\n\n`
      );
    }

    while (!firstResult.done) {
      if (abortController.signal.aborted) break;
      const next = await iterator.next();
      if (next.done) break;
      const chunkText = next.value?.text;
      if (chunkText) {
        res.write(`data: ${JSON.stringify({ chunk: chunkText, model: selectedModel })}\n\n`);
      }
    }

    if (!abortController.signal.aborted) {
      const responseTimeMs = Date.now() - startMs;
      res.write(
        `data: ${JSON.stringify({
          done: true,
          model: selectedModel,
          httpStatus: 200,
          endpoint,
          requestStartTime,
          responseTimeMs,
          timeoutDurationMs: GEMINI_TIMEOUT_MS,
          retryCount,
          maxRetries: RETRY_COUNT,
        })}\n\n`
      );
      res.end();
    }
  } catch (error: any) {
    if (error?.clientAborted || abortController.signal.aborted) return;

    const diag = error?.diagnostic || {
      ...classifyGeminiError(error),
      endpoint,
      modelName: selectedModel,
      requestStartTime,
      responseTimeMs: 0,
      timeoutDurationMs: GEMINI_TIMEOUT_MS,
      retryCount: 0,
      maxRetries: RETRY_COUNT,
      apiConfigured: isKeyValid,
      envSource,
    };

    if (!headersCommitted) {
      return res.status(diag.httpStatus >= 400 ? diag.httpStatus : 502).json({
        unavailable: true,
        ...diag,
        error: diag.errorMessage || 'Gemini unavailable — please try again.',
      });
    }

    res.write(
      `data: ${JSON.stringify({
        error: diag.errorMessage || 'Gemini unavailable — please try again.',
        diagnostic: diag,
      })}\n\n`
    );
    res.end();
  }
});

// Server-side Audio Transcription Fallback (when browser lacks Web SpeechRecognition)
app.post('/api/voice/transcribe', aiRateLimiter, async (req: Request, res: Response) => {
  const { audioBase64, mimeType = 'audio/webm', languageHint = 'auto' } = req.body || {};
  const selectedModel = 'gemini-3.5-transcribe';
  const endpoint = buildSafeEndpoint(selectedModel, 'generateContent');

  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return res.status(400).json({ errorType: 'INVALID_REQUEST', error: 'audioBase64 string is required.' });
  }
  if (!ai) {
    return res.status(401).json({
      unavailable: true,
      errorType: 'INVALID_API_KEY',
      httpStatus: 401,
      error: 'AI audio transcription unavailable — GEMINI_API_KEY is not configured.',
    });
  }

  const abortController = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const { result } = await runGeminiWithRetry({
      route: '/api/voice/transcribe',
      modelName: selectedModel,
      rpcMethod: 'generateContent',
      externalSignal: abortController.signal,
      fn: async (signal, timeoutMs) =>
        ai.models.generateContent({
          model: selectedModel,
          contents: {
            parts: [
              { inlineData: { mimeType, data: audioBase64 } },
              {
                text: `Transcribe this audio verbatim. The speaker may speak Bengali, Hindi, English, or mixed speech (keeping English financial terms). Language hint: ${languageHint}. Return ONLY the transcript text.`,
              },
            ],
          },
          config: {
            abortSignal: signal,
            httpOptions: { timeout: timeoutMs },
          },
        }),
    });

    return res.json({
      transcript: (result.text || '').trim(),
      confidence: 0.88,
    });
  } catch (error: any) {
    if (error?.clientAborted) return;
    const diag = error?.diagnostic || classifyGeminiError(error);
    return res.status(diag.httpStatus >= 400 ? diag.httpStatus : 502).json({
      unavailable: true,
      ...diag,
      endpoint,
      error: diag.errorMessage || "I couldn't understand the audio. Please try again.",
    });
  }
});

// Optional Gemini Neural TTS Endpoint
app.post('/api/voice/tts', aiRateLimiter, async (req: Request, res: Response) => {
  const { text, voiceName = 'Kore', style = 'Calm, friendly conversational assistant' } = req.body || {};
  const selectedModel = 'gemini-3.8-flash-lite-tts';
  const endpoint = buildSafeEndpoint(selectedModel, 'generateContent');

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ errorType: 'INVALID_REQUEST', error: 'text string is required.' });
  }
  if (!ai) {
    return res.status(401).json({
      unavailable: true,
      errorType: 'INVALID_API_KEY',
      httpStatus: 401,
      error: 'Neural TTS unavailable without Gemini API configuration.',
    });
  }

  const abortController = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const { result } = await runGeminiWithRetry({
      route: '/api/voice/tts',
      modelName: selectedModel,
      rpcMethod: 'generateContent',
      externalSignal: abortController.signal,
      fn: async (signal, timeoutMs) =>
        ai.models.generateContent({
          model: selectedModel,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: text.slice(0, 1200),
                  speechMetadata: { style },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: String(voiceName || 'Kore') },
              },
            },
            abortSignal: signal,
            httpOptions: { timeout: timeoutMs },
          },
        }),
    });

    const base64Audio = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(502).json({
        unavailable: true,
        errorType: 'RESPONSE_PARSE_ERROR',
        httpStatus: 502,
        endpoint,
        error: 'No audio returned from TTS model.',
      });
    }

    return res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (error: any) {
    if (error?.clientAborted) return;
    const diag = error?.diagnostic || classifyGeminiError(error);
    return res.status(diag.httpStatus >= 400 ? diag.httpStatus : 502).json({
      unavailable: true,
      ...diag,
      endpoint,
      error: diag.errorMessage || 'Neural TTS temporarily unavailable.',
    });
  }
});

// Market Status Endpoint (clearly states Demo / Prototype status)
app.get('/api/market/status', (_req: Request, res: Response) => {
  const now = new Date();
  const istTimeStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(now);

  res.json({
    serverTimeIst: istTimeStr,
    exchangeCoverage: ['NSE', 'BSE'],
    dataMode: 'DEMO_MODE',
    liveApiConnected: false,
    notice: 'Demo / delayed / imported data — not suitable for live execution.',
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `SMART TRADER AI server running on port ${PORT} (Model: ${resolveModel(MODEL_NAME)}, Timeout: ${GEMINI_TIMEOUT_MS}ms, Retries: ${RETRY_COUNT}, Key: ${isKeyValid ? 'configured' : 'missing'})`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

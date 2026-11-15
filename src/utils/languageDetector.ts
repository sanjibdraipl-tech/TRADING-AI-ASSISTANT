import { DetectedLanguage, LanguagePreference } from '../types/voice';

const BENGALI_CHAR_REGEX = /[\u0980-\u09FF]/g;
// Exclude U+0964 (।) and U+0965 (॥) Danda punctuation shared by Bengali and Hindi
const HINDI_CHAR_REGEX = /[\u0900-\u0963\u0966-\u097F]/g;
const LATIN_WORD_REGEX = /[A-Za-z]{2,}/g;

const ROMAN_BENGALI_KEYWORDS = new Set([
  'aj', 'ajke', 'kemon', 'acho', 'achho', 'ki', 'koto', 'bolun', 'bolo',
  'koro', 'korbo', 'korchi', 'dekhao', 'dekho', 'amar', 'tumi', 'ami',
  'er', 'ta', 'eta', 'sohoj', 'kore', 'ektu', 'thamun', 'thamo', 'aste',
  'abar', 'bujhao', 'banglay', 'bangla', 'hobe', 'ache', 'na', 'keno', 'valo',
]);

const ROMAN_HINDI_KEYWORDS = new Set([
  'aaj', 'kya', 'hai', 'hain', 'kaise', 'kaisa', 'batao', 'bataiye', 'bataye',
  'samjhao', 'samjhaiye', 'mera', 'meri', 'hamara', 'karo', 'karen', 'nahi',
  'kyun', 'kitna', 'kitni', 'hindi', 'mein', 'me', 'ruko', 'rukiye', 'phir',
  'se', 'chalu', 'achha', 'theek', 'bahut', 'upar', 'neeche',
]);

// Market terms preserved naturally inside Bengali or Hindi utterances without triggering spurious split
const PRESERVED_MARKET_TERMS = new Set([
  'ema', 'rsi', 'macd', 'nifty', 'bank', 'vwap', 'atr', 'adx', 'nse', 'bse',
  'hdfc', 'icici', 'sbi', 'tcs', 'itc', 'lt', 'bel', 'ntpc', 'bhel', 'bse',
  'demo', 'ai', 'sma', 'pe', 'pb', 'roe', 'roce',
]);

/**
 * Detects Bengali ('bn'), Hindi ('hi'), English ('en'), or mixed variants
 * ('bn-en', 'hi-en', 'bn-hi-en') from spoken or written text.
 */
export function detectLanguage(
  text: string,
  preference: LanguagePreference = 'auto'
): DetectedLanguage {
  const lower = text.toLowerCase();

  // Explicit user override instructions
  if (
    lower.includes('in bengali') ||
    lower.includes('বাংলায় বলুন') ||
    lower.includes('বাংলায় explain') ||
    lower.includes('banglay bolun')
  ) {
    return 'bn';
  }
  if (
    lower.includes('in hindi') ||
    lower.includes('हिंदी में') ||
    lower.includes('हिन्दी में') ||
    lower.includes('hindi mein') ||
    lower.includes('hindi me ')
  ) {
    return 'hi';
  }
  if (
    lower.includes('in english') ||
    lower.includes('english-এ') ||
    lower.includes('english e ') ||
    lower.includes('english-e') ||
    lower.includes('english mein')
  ) {
    return 'en';
  }

  if (preference !== 'auto') {
    return preference;
  }

  const bnMatches = text.match(BENGALI_CHAR_REGEX) || [];
  const hiMatches = text.match(HINDI_CHAR_REGEX) || [];
  const latinMatches = text.match(LATIN_WORD_REGEX) || [];

  const hasBengaliScript = bnMatches.length > 0;
  const hasHindiScript = hiMatches.length > 0;

  const hasRomanBengali = latinMatches.some((w) => ROMAN_BENGALI_KEYWORDS.has(w.toLowerCase()));
  const hasRomanHindi = latinMatches.some((w) => ROMAN_HINDI_KEYWORDS.has(w.toLowerCase()));
  const substantiveEnglishWords = latinMatches.filter((w) => {
    const lw = w.toLowerCase();
    return !ROMAN_BENGALI_KEYWORDS.has(lw) && !ROMAN_HINDI_KEYWORDS.has(lw);
  });
  const hasEnglish = substantiveEnglishWords.length > 0;

  const isBengali = hasBengaliScript || hasRomanBengali;
  const isHindi = hasHindiScript || hasRomanHindi;

  if (isBengali && isHindi) return 'bn-hi-en';
  if (isBengali && hasEnglish) return 'bn-en';
  if (isBengali) return 'bn';
  if (isHindi && hasEnglish) return 'hi-en';
  if (isHindi) return 'hi';
  return 'en';
}

export function formatLanguageTag(lang: DetectedLanguage): string {
  switch (lang) {
    case 'bn':
      return 'বাংলা (bn-IN)';
    case 'hi':
      return 'हिंदी (hi-IN)';
    case 'bn-en':
      return 'বাংলা + EN';
    case 'hi-en':
      return 'हिंदी + EN';
    case 'bn-hi-en':
      return 'BN + HI + EN';
    default:
      return 'English (en-IN)';
  }
}

export function toSpeechLocale(lang: DetectedLanguage): 'bn-IN' | 'hi-IN' | 'en-IN' {
  if (lang === 'bn' || lang === 'bn-en') return 'bn-IN';
  if (lang === 'hi' || lang === 'hi-en') return 'hi-IN';
  if (lang === 'bn-hi-en') return 'hi-IN';
  return 'en-IN';
}

export interface SpeechSegment {
  text: string;
  locale: 'bn-IN' | 'hi-IN' | 'en-IN';
}

/**
 * Splits a multi-sentence / mixed-script response into language-aware speakable segments
 * while keeping short stock-market terminology (EMA, RSI, MACD, Nifty, Bank Nifty)
 * attached cleanly to its surrounding sentence so speech stays fluid.
 */
export function splitLanguageAwareSegments(
  rawText: string,
  defaultLang: DetectedLanguage = 'en'
): SpeechSegment[] {
  const cleaned = rawText
    .replace(/[#*`>_~]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  // First split by natural sentence punctuation (Bengali/Hindi ।, ., !, ?, newline)
  const { completed, remainder } = extractCompletedSentences(cleaned);
  const sentences = [...completed];
  if (remainder.trim()) sentences.push(remainder.trim());

  const segments: SpeechSegment[] = [];

  for (const sentence of sentences) {
    // Check if single sentence mixes Bengali script and Hindi Devanagari letters (excluding ।)
    const hasBn = /[\u0980-\u09FF]/.test(sentence);
    const hasHi = /[\u0900-\u0963\u0966-\u097F]/.test(sentence);

    if (hasBn && hasHi) {
      // Split by script runs while keeping English market terms glued to the preceding clause
      const runs =
        sentence.match(
          /[\u0980-\u09FF\s0-9.,?!%₹\u0964\u0965-]+|[\u0900-\u0963\u0966-\u097F\s0-9.,?!%₹\u0964\u0965-]+|[^\u0980-\u09FF\u0900-\u0963\u0966-\u097F]+/g
        ) || [sentence];
      for (const run of runs) {
        const trimmed = run.trim();
        if (!trimmed) continue;
        if (/[\u0980-\u09FF]/.test(trimmed)) {
          segments.push({ text: trimmed, locale: 'bn-IN' });
        } else if (/[\u0900-\u0963\u0966-\u097F]/.test(trimmed)) {
          segments.push({ text: trimmed, locale: 'hi-IN' });
        } else {
          const words = trimmed.toLowerCase().split(/\s+/);
          const allMarketTerms = words.every((w) => PRESERVED_MARKET_TERMS.has(w.replace(/[^a-z]/g, '')));
          if (allMarketTerms && segments.length > 0) {
            segments[segments.length - 1].text += ` ${trimmed}`;
          } else {
            segments.push({ text: trimmed, locale: 'en-IN' });
          }
        }
      }
      continue;
    }

    // Sub-chunk very long sentences (>180 chars) on commas/semicolons so Chrome TTS never cuts off
    const subChunks = chunkByLength(sentence, 180);
    const detected = detectLanguage(sentence, 'auto');
    const locale =
      hasBn
        ? 'bn-IN'
        : hasHi
        ? 'hi-IN'
        : detected !== 'en'
        ? toSpeechLocale(detected)
        : toSpeechLocale(defaultLang);

    for (const sc of subChunks) {
      if (sc.trim()) {
        segments.push({ text: sc.trim(), locale });
      }
    }
  }

  return segments;
}

function chunkByLength(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let splitIdx = -1;
    const windowStr = remaining.slice(0, maxLen);
    for (const sep of [', ', '; ', ' — ', ' - ', ' ']) {
      const idx = windowStr.lastIndexOf(sep);
      if (idx > maxLen * 0.4) {
        splitIdx = idx + sep.length;
        break;
      }
    }
    if (splitIdx <= 0) splitIdx = maxLen;
    parts.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

/**
 * Splits streamed AI text into complete speakable sentences cleanly
 * across English (. ! ?) and Bengali/Hindi (।) sentence terminators.
 */
export function extractCompletedSentences(buffer: string): {
  completed: string[];
  remainder: string;
} {
  const completed: string[] = [];
  let start = 0;

  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    if (ch === '।' || ch === '!' || ch === '?' || ch === '\n' || (ch === '.' && (i + 1 === buffer.length || /\s/.test(buffer[i + 1])))) {
      const prevChar = i > 0 ? buffer[i - 1] : '';
      if (ch === '.' && /\d/.test(prevChar) && i + 1 < buffer.length && /\d/.test(buffer[i + 1])) {
        continue;
      }
      const sentence = buffer.slice(start, i + 1).trim();
      if (sentence.length > 1) {
        completed.push(sentence);
      }
      start = i + 1;
    }
  }

  return {
    completed,
    remainder: buffer.slice(start),
  };
}

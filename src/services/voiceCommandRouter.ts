import { AnalyzedStock } from '../types/trading';
import { LanguagePreference, VoiceActionCommand, VoiceIntent, VoiceIntentType } from '../types/voice';
import { detectLanguage } from '../utils/languageDetector';
import { resolveSymbolFromSpeech } from './marketDataService';

/**
 * Section 11 & 32: Rule-based Intent & Voice Command Router
 * Classifies spoken/typed Bengali, English, or Mixed utterances deterministically
 * before dispatching UI commands or calling Gemini.
 */
export function routeVoiceCommand(
  rawText: string,
  langPref: LanguagePreference,
  stocks: AnalyzedStock[],
  lastEntity?: string
): VoiceIntent {
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const detectedLanguage = detectLanguage(text, langPref);

  const detailRequested =
    lower.includes('detail') ||
    lower.includes('thoroughly') ||
    lower.includes('বিস্তারিত') ||
    lower.includes('ডিটেইল');

  // 1. Playback & Control Voice Commands
  let action: VoiceActionCommand = 'NONE';
  if (/^(stop|থামুন|থামো|रुको|रुकिए|रुक जाओ|रुकें|बंद करो|chup|stop speaking|cancel)\.?$/i.test(text) || lower === 'stop.' || lower === 'থামুন.') {
    action = 'STOP';
  } else if (/^(pause|পজ|একটু থামুন|पॉज)\.?$/i.test(text)) {
    action = 'PAUSE';
  } else if (/^(resume|continue|চালু করো|आगे बोलो)\.?$/i.test(text)) {
    action = 'RESUME';
  } else if (
    lower.includes('বাংলায় বলুন') ||
    lower.includes('in bengali') ||
    lower.includes('banglay bolun')
  ) {
    action = 'SET_LANG_BN';
  } else if (
    lower.includes('हिंदी में') ||
    lower.includes('हिन्दी में') ||
    lower.includes('in hindi') ||
    lower.includes('hindi mein')
  ) {
    action = 'SET_LANG_HI';
  } else if (
    lower.includes('english-এ') ||
    lower.includes('in english') ||
    lower.includes('english-e') ||
    lower.includes('english mein')
  ) {
    action = 'SET_LANG_EN';
  } else if (
    lower.includes('repeat') ||
    lower.includes('say that again') ||
    lower.includes('আবার বলুন') ||
    lower.includes('আবার বলো') ||
    lower.includes('abar bolun') ||
    lower.includes('फिर से बोलो')
  ) {
    action = 'REPEAT';
  } else if (
    lower.includes('speak slower') ||
    lower.includes('slowly') ||
    lower.includes('আস্তে বলুন') ||
    lower.includes('ধীরে বলুন') ||
    lower.includes('धीरे बोलो')
  ) {
    action = 'SLOWER';
  } else if (lower.includes('dark mode') || lower.includes('ডার্ক মোড')) {
    action = 'DARK_MODE';
  } else if (lower.includes('light mode') || lower.includes('লাইট মোড')) {
    action = 'LIGHT_MODE';
  } else if (lower.includes('clear conversation') || lower.includes('clear chat') || lower.includes('চ্যাট ক্লিয়ার')) {
    action = 'CLEAR_CONVERSATION';
  } else if (lower.includes('new chat') || lower.includes('নতুন চ্যাট') || lower.includes('new conversation')) {
    action = 'NEW_CONVERSATION';
  } else if (
    lower.includes('open watchlist') ||
    lower.includes('show watchlist') ||
    lower.includes('আমার watchlist দেখাও') ||
    lower.includes('ওয়াচলিস্ট দেখাও') ||
    (lower.includes('watchlist') && (lower.includes('দেখাও') || lower.includes('open') || lower.includes('show')))
  ) {
    action = 'OPEN_WATCHLIST';
  } else if (lower.includes('open settings') || lower.includes('সেটিংস খোলো')) {
    action = 'OPEN_SETTINGS';
  } else if (lower.includes('open journal') || lower.includes('জার্নাল দেখাও')) {
    action = 'OPEN_JOURNAL';
  } else if (lower.includes('risk calculator') || lower.includes('position size')) {
    action = 'OPEN_RISK_CALC';
  }

  // 2. Determine Intent Type
  const resolved = resolveSymbolFromSpeech(text, stocks, lastEntity);
  let intent: VoiceIntentType = 'GENERAL_CHAT';

  if (
    lower.includes('what can you do') ||
    lower.includes('কি কি করতে পারো') ||
    lower.includes('help') ||
    lower.includes('সাহায্য')
  ) {
    intent = 'HELP';
  } else if (action === 'OPEN_WATCHLIST' || lower.includes('watchlist') || lower.includes('ওয়াচলিস্ট')) {
    intent = 'WATCHLIST';
  } else if (action === 'OPEN_SETTINGS' || lower.includes('settings') || lower.includes('সেটিংস')) {
    intent = 'SETTINGS';
  } else if (action === 'OPEN_JOURNAL' || lower.includes('journal') || lower.includes('জার্নাল')) {
    intent = 'JOURNAL';
  } else if (action === 'OPEN_RISK_CALC' || lower.includes('risk') || lower.includes('stop loss') || lower.includes('রিস্ক')) {
    intent = 'RISK_CALCULATOR';
  } else if (resolved.symbol && !resolved.isMarketOverview) {
    intent = 'STOCK_ANALYSIS';
  } else if (resolved.isMarketOverview) {
    intent = 'MARKET_STATUS';
  }

  return {
    intent,
    action,
    symbol: resolved.symbol,
    language: detectedLanguage,
    detailRequested,
    confidence: resolved.symbol || action !== 'NONE' ? 0.92 : 0.85,
  };
}

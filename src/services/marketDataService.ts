import { AnalyzedStock, DataSourceMetadata } from '../types/trading';
import { VoiceStockJsonPayload } from '../types/voice';

const SPOKEN_ALIASES: Record<string, string> = {
  'hdfc bank': 'HDFCBANK',
  hdfc: 'HDFCBANK',
  'এইচডিএফসি': 'HDFCBANK',
  'icici bank': 'ICICIBANK',
  icici: 'ICICIBANK',
  'আইসিআইসিআই': 'ICICIBANK',
  reliance: 'RELIANCE',
  'reliance industries': 'RELIANCE',
  'রিলায়েন্স': 'RELIANCE',
  'state bank': 'SBIN',
  sbi: 'SBIN',
  'এসবিআই': 'SBIN',
  infosys: 'INFY',
  infy: 'INFY',
  'ইনফোসিস': 'INFY',
  tcs: 'TCS',
  'tata consultancy': 'TCS',
  'টিসিএস': 'TCS',
  'tata motors': 'TATAMOTORS',
  'টাটা মোটরস': 'TATAMOTORS',
  'tata steel': 'TATASTEEL',
  'টাটা স্টিল': 'TATASTEEL',
  'bharti airtel': 'BHARTIARTL',
  airtel: 'BHARTIARTL',
  'এয়ারটেল': 'BHARTIARTL',
  itc: 'ITC',
  'আইটিসি': 'ITC',
  'larsen': 'LT',
  'l&t': 'LT',
  'kotak': 'KOTAKBANK',
  'kotak bank': 'KOTAKBANK',
  'axis bank': 'AXISBANK',
  'bajaj finance': 'BAJFINANCE',
  'sun pharma': 'SUNPHARMA',
  'maruti': 'MARUTI',
  'mahindra': 'M&M',
  'wipro': 'WIPRO',
  'titan': 'TITAN',
  'ntpc': 'NTPC',
  'bel': 'BEL',
  'bharat electronics': 'BEL',
  'suzlon': 'SUZLON',
  'zomato': 'ETERNAL',
  eternal: 'ETERNAL',
  'bse': 'BSE',
  'mcx': 'MCX',
  'tata power': 'TATAPOWER-BSE',
  'adani ports': 'ADANIPORTS',
  'adani enterprises': 'ADANIENT',
  'trent': 'TRENT',
  'asian paints': 'ASIANPAINT',
  'cipla': 'CIPLA',
  'hcl': 'HCLTECH',
  'hcl tech': 'HCLTECH',
};

const PRONOUN_FOLLOWUP_REGEX =
  /(?:^|\s)(এর\s+(?:rsi|price|দাম|trend|ema|setup|volume|macd|কত|অবস্থা)|এটার\b|এই\s*স্টক|এই\s*stock|this\s+stock|that\s+stock|its\s+(?:rsi|price|ema|trend|setup|volume))/i;

export function resolveSymbolFromSpeech(
  text: string,
  stocks: AnalyzedStock[],
  lastEntity?: string
): { symbol?: string; isMarketOverview: boolean } {
  const lower = text.toLowerCase();

  // Check explicit stock alias first
  for (const [alias, sym] of Object.entries(SPOKEN_ALIASES)) {
    if (lower.includes(alias)) {
      const match = stocks.find((s) => s.raw.symbol === sym);
      if (match) return { symbol: match.raw.symbol, isMarketOverview: false };
    }
  }

  // Exact symbol or company name match across the 150-stock universe
  const upperWords = text.toUpperCase().replace(/[^A-Z0-9&-]+/g, ' ').split(/\s+/).filter(Boolean);
  for (const w of upperWords) {
    const exact = stocks.find((s) => s.raw.symbol === w);
    if (exact) return { symbol: exact.raw.symbol, isMarketOverview: false };
  }

  for (const stock of stocks) {
    const compLower = stock.raw.companyName.toLowerCase();
    const firstWord = compLower.split(' ')[0];
    if (compLower.length > 3 && lower.includes(compLower)) {
      return { symbol: stock.raw.symbol, isMarketOverview: false };
    }
    if (firstWord.length >= 4 && lower.includes(firstWord)) {
      return { symbol: stock.raw.symbol, isMarketOverview: false };
    }
  }

  // Check genuine pronoun follow-up ("এর RSI কত?", "What is its EMA 20?")
  if (lastEntity && lastEntity !== 'NIFTY50' && PRONOUN_FOLLOWUP_REGEX.test(text)) {
    const exists = stocks.find((s) => s.raw.symbol === lastEntity);
    if (exists) {
      return { symbol: exists.raw.symbol, isMarketOverview: false };
    }
  }

  // Check Nifty / broad market question
  if (
    lower.includes('nifty') ||
    lower.includes('নিফটি') ||
    lower.includes('market') ||
    lower.includes('মার্কেট') ||
    lower.includes('বাজার') ||
    lower.includes('sensex') ||
    lower.includes('সেনসেক্স')
  ) {
    return { symbol: 'NIFTY50', isMarketOverview: true };
  }

  return { symbol: undefined, isMarketOverview: false };
}

export function buildVoiceStockJson(
  stock: AnalyzedStock,
  dataSourceMeta: DataSourceMetadata
): VoiceStockJsonPayload {
  const integrity = stock.dataIntegrity;
  let dataStatus: VoiceStockJsonPayload['dataStatus'] = 'DELAYED';
  if (integrity.numberOfCandles === 0 || !stock.technicals.calculationComplete) {
    dataStatus = 'MISSING';
  } else if (integrity.dataFreshness === 'STALE' || integrity.status === 'RED') {
    dataStatus = 'STALE';
  } else if (dataSourceMeta.status === 'DEMO' || dataSourceMeta.status === 'DELAYED' || dataSourceMeta.status === 'IMPORTED') {
    dataStatus = 'DELAYED';
  }

  return {
    symbol: stock.raw.symbol,
    companyName: stock.raw.companyName,
    exchange: stock.raw.exchange,
    timestamp: integrity.lastUpdatedTimestamp || dataSourceMeta.lastUpdated,
    dataStatus,
    sourceLabel: dataSourceMeta.displayLabel,
    price: stock.technicals.latestClose ?? null,
    pctChange: stock.technicals.pctChange ?? null,
    ema20: stock.technicals.ema20 ?? null,
    ema50: stock.technicals.ema50 ?? null,
    ema200: stock.technicals.ema200 ?? null,
    rsi14: stock.technicals.rsi14 ?? null,
    macd: {
      line: stock.technicals.macd.line ?? null,
      signal: stock.technicals.macd.signal ?? null,
      histogram: stock.technicals.macd.histogram ?? null,
    },
    volumeRatio: stock.technicals.volumeRatio ?? null,
    atr14: stock.technicals.atr14 ?? null,
    support: stock.technicals.supportZones || [],
    resistance: stock.technicals.resistanceZones || [],
    liquidityStatus: stock.liquidity.status,
    fundamentalScore: stock.fundamentalsScore.totalScore ?? null,
    setupStatus: stock.primarySignal,
    missingCandles: integrity.missingCandles,
    corporateActionAdjusted: integrity.corporateActionAdjusted,
  };
}

export function buildMarketBreadthJson(
  stocks: AnalyzedStock[],
  dataSourceMeta: DataSourceMetadata
) {
  const total = stocks.length;
  const setupDetected = stocks.filter((s) => s.primarySignal === 'SETUP DETECTED');
  const watchList = stocks.filter((s) => s.primarySignal === 'WATCH');
  const bullishCount = stocks.filter(
    (s) =>
      s.technicals.latestClose !== null &&
      s.technicals.ema50 !== null &&
      s.technicals.latestClose > s.technicals.ema50
  ).length;
  const liquidPassed = stocks.filter((s) => s.liquidity.status === 'PASS').length;

  return {
    indexReference: 'NIFTY / NSE-BSE Tracked Universe',
    timestamp: dataSourceMeta.lastUpdated,
    dataStatus: dataSourceMeta.status === 'DISCONNECTED' ? 'ERROR' : 'DELAYED',
    sourceLabel: dataSourceMeta.displayLabel,
    note: dataSourceMeta.bannerText,
    universeCount: total,
    bullishAboveEma50Count: bullishCount,
    bearishOrBelowEma50Count: Math.max(0, total - bullishCount),
    liquidityPassedCount: liquidPassed,
    setupDetectedCount: setupDetected.length,
    watchCount: watchList.length,
    topSetupSymbols: setupDetected.slice(0, 5).map((s) => ({
      symbol: s.raw.symbol,
      price: s.technicals.latestClose,
      rsi14: s.technicals.rsi14,
      setup: s.primarySetupName,
    })),
  };
}

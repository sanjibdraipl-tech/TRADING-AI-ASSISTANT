import {
  IndicatorConfig,
  MultiTimeframeAnalysis,
  OHLCVCandle,
  TechnicalIndicators,
} from '../types/trading';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Deterministic EMA series calculation.
 * Returns null for indices before `period - 1`.
 */
export function calculateEMASeries(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period || period <= 0) return result;

  // Initial SMA seed
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let ema = sum / period;
  result[period - 1] = round2(ema);

  const multiplier = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
    result[i] = round2(ema);
  }
  return result;
}

/**
 * Deterministic Wilder's RSI(14) series calculation.
 */
export function calculateRSISeries(closes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period || period <= 0) return result;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  const computeRsi = (g: number, l: number) => {
    if (l === 0) return g === 0 ? 50 : 100;
    const rs = g / l;
    return round2(100 - 100 / (1 + rs));
  };

  result[period] = computeRsi(avgGain, avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = computeRsi(avgGain, avgLoss);
  }

  return result;
}

/**
 * Deterministic MACD (12, 26, 9) calculation.
 */
export function calculateMACDSeries(
  closes: number[]
): { line: number | null; signal: number | null; hist: number | null }[] {
  const ema12 = calculateEMASeries(closes, 12);
  const ema26 = calculateEMASeries(closes, 26);

  const macdLine: (number | null)[] = closes.map((_, i) =>
    ema12[i] !== null && ema26[i] !== null ? round2(ema12[i]! - ema26[i]!) : null
  );

  // Signal EMA(9) over non-null MACD values
  const validStart = macdLine.findIndex((v) => v !== null);
  const output: { line: number | null; signal: number | null; hist: number | null }[] =
    closes.map((_, i) => ({ line: macdLine[i], signal: null, hist: null }));

  if (validStart === -1) return output;

  const validMacd = macdLine.slice(validStart) as number[];
  const signalSub = calculateEMASeries(validMacd, 9);

  for (let i = 0; i < signalSub.length; i++) {
    const targetIdx = validStart + i;
    const sig = signalSub[i];
    const line = macdLine[targetIdx];
    output[targetIdx] = {
      line,
      signal: sig,
      hist: line !== null && sig !== null ? round2(line - sig) : null,
    };
  }

  return output;
}

/**
 * Deterministic Bollinger Bands (20, 2) calculation.
 */
export function calculateBollingerBands(closes: number[], period: number = 20, stdMult: number = 2) {
  if (closes.length < period) {
    return {
      upper: null,
      middle: null,
      lower: null,
      bandwidthPct: null,
      isCompressed: false,
    };
  }

  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = round2(mean + stdMult * stdDev);
  const lower = round2(mean - stdMult * stdDev);
  const middle = round2(mean);
  const bandwidthPct = middle > 0 ? round2(((upper - lower) / middle) * 100) : null;

  // Compare current bandwidth against average of prior 20 windows if possible
  let isCompressed = bandwidthPct !== null ? bandwidthPct < 8.5 : false;
  if (closes.length >= period + 20 && bandwidthPct !== null) {
    const priorBandwidths: number[] = [];
    for (let offset = 1; offset <= 15; offset++) {
      const end = closes.length - offset;
      const w = closes.slice(end - period, end);
      const m = w.reduce((a, b) => a + b, 0) / period;
      const v = w.reduce((s, x) => s + Math.pow(x - m, 2), 0) / period;
      const sd = Math.sqrt(v);
      if (m > 0) priorBandwidths.push(((2 * stdMult * sd) / m) * 100);
    }
    if (priorBandwidths.length > 0) {
      const avgBw = priorBandwidths.reduce((a, b) => a + b, 0) / priorBandwidths.length;
      isCompressed = bandwidthPct <= avgBw * 0.85 || bandwidthPct < 7.0;
    }
  }

  return { upper, middle, lower, bandwidthPct, isCompressed };
}

/**
 * Deterministic Wilder's ATR(14) calculation.
 */
export function calculateATR14(candles: OHLCVCandle[], period: number = 14): number | null {
  if (candles.length <= period) return null;

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length < period) return null;

  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return round2(atr);
}

/**
 * Deterministic Wilder's ADX(14) calculation.
 */
export function calculateADX14(candles: OHLCVCandle[], period: number = 14): number | null {
  if (candles.length < period * 2 + 1) return null;

  const trs: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const upMove = curr.high - prev.high;
    const downMove = prev.low - curr.low;

    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
    trs.push(
      Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close)
      )
    );
  }

  let smoothTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

  const dxValues: number[] = [];

  const pushDX = (tr: number, pDM: number, mDM: number) => {
    if (tr === 0) {
      dxValues.push(0);
      return;
    }
    const pDI = (100 * pDM) / tr;
    const mDI = (100 * mDM) / tr;
    const sum = pDI + mDI;
    dxValues.push(sum === 0 ? 0 : (100 * Math.abs(pDI - mDI)) / sum);
  };

  pushDX(smoothTR, smoothPlusDM, smoothMinusDM);

  for (let i = period; i < trs.length; i++) {
    smoothTR = smoothTR - smoothTR / period + trs[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDMs[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDMs[i];
    pushDX(smoothTR, smoothPlusDM, smoothMinusDM);
  }

  if (dxValues.length < period) return null;
  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }

  return round2(adx);
}

/**
 * Deterministic VWAP calculation (only when intraday candles exist).
 */
export function calculateVWAP(intradayCandles?: OHLCVCandle[]): number | null {
  if (!intradayCandles || intradayCandles.length === 0) return null;

  let cumPV = 0;
  let cumVol = 0;
  for (const c of intradayCandles) {
    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * c.volume;
    cumVol += c.volume;
  }

  if (cumVol === 0) return null;
  return round2(cumPV / cumVol);
}

/**
 * Resample Daily candles into Weekly candles cleanly (ISO week bucket).
 */
export function resampleToWeekly(candles: OHLCVCandle[]): OHLCVCandle[] {
  if (candles.length === 0) return [];
  const weeks: OHLCVCandle[] = [];
  let bucket: OHLCVCandle | null = null;
  let currentWeekKey = '';

  for (const c of candles) {
    const d = new Date(c.timestamp);
    if (Number.isNaN(d.getTime())) continue;
    // Monday-based week key
    const day = d.getUTCDay() || 7;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - day + 1);
    const weekKey = monday.toISOString().slice(0, 10);

    if (weekKey !== currentWeekKey) {
      if (bucket) weeks.push(bucket);
      currentWeekKey = weekKey;
      bucket = { ...c };
    } else if (bucket) {
      bucket.high = Math.max(bucket.high, c.high);
      bucket.low = Math.min(bucket.low, c.low);
      bucket.close = c.close;
      bucket.volume += c.volume;
      bucket.timestamp = c.timestamp;
    }
  }
  if (bucket) weeks.push(bucket);
  return weeks;
}

/**
 * Master Deterministic Technical Indicator Engine (Section 9)
 */
export function calculateTechnicalIndicators(
  candles: OHLCVCandle[],
  config: IndicatorConfig,
  intradayCandles?: OHLCVCandle[]
): TechnicalIndicators {
  const missingIndicators: string[] = [];

  if (!candles || candles.length === 0) {
    return {
      latestClose: null,
      prevClose: null,
      pctChange: null,
      latestVolume: null,
      avgVolume20: null,
      volumeRatio: null,
      ema20: null,
      ema50: null,
      ema200: null,
      ema20Series: [],
      ema50Series: [],
      ema200Series: [],
      rsi14: null,
      rsiSeries: [],
      macd: { line: null, signal: null, histogram: null, series: [] },
      bollinger20_2: { upper: null, middle: null, lower: null, bandwidthPct: null, isCompressed: false },
      atr14: null,
      adx14: null,
      vwap: null,
      fibonacci: null,
      supportZones: [],
      resistanceZones: [],
      calculationComplete: false,
      missingIndicators: ['OHLCV Price Series', 'EMA20', 'EMA50', 'EMA200', 'RSI14', 'MACD', 'ATR14', 'ADX14'],
    };
  }

  // Validate no corrupt NaN closes
  const validCandles = candles.filter(
    (c) =>
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close) &&
      c.close > 0
  );

  const closes = validCandles.map((c) => c.close);
  const latest = validCandles[validCandles.length - 1] || null;
  const prev = validCandles.length >= 2 ? validCandles[validCandles.length - 2] : null;

  const latestClose = latest ? round2(latest.close) : null;
  const prevClose = prev ? round2(prev.close) : null;
  const pctChange =
    latestClose !== null && prevClose !== null && prevClose > 0
      ? round2(((latestClose - prevClose) / prevClose) * 100)
      : null;

  const latestVolume = latest ? latest.volume : null;
  let avgVolume20: number | null = null;
  let volumeRatio: number | null = null;

  if (validCandles.length >= 20 && latestVolume !== null) {
    const volSlice = validCandles.slice(-20);
    avgVolume20 = Math.round(volSlice.reduce((s, c) => s + c.volume, 0) / 20);
    volumeRatio = avgVolume20 > 0 ? round2(latestVolume / avgVolume20) : null;
  } else {
    missingIndicators.push('20-Day Avg Volume');
  }

  const ema20Series = calculateEMASeries(closes, config.emaFast);
  const ema50Series = calculateEMASeries(closes, config.emaMedium);
  const ema200Series = calculateEMASeries(closes, config.emaSlow);

  const ema20 = ema20Series[ema20Series.length - 1] ?? null;
  const ema50 = ema50Series[ema50Series.length - 1] ?? null;
  const ema200 = ema200Series[ema200Series.length - 1] ?? null;

  if (ema20 === null) missingIndicators.push(`EMA${config.emaFast}`);
  if (ema50 === null) missingIndicators.push(`EMA${config.emaMedium}`);
  if (ema200 === null) missingIndicators.push(`EMA${config.emaSlow}`);

  const rsiSeries = calculateRSISeries(closes, config.rsiPeriod);
  const rsi14 = rsiSeries[rsiSeries.length - 1] ?? null;
  if (rsi14 === null) missingIndicators.push(`RSI${config.rsiPeriod}`);

  const macdSeries = calculateMACDSeries(closes);
  const lastMacd = macdSeries[macdSeries.length - 1] || { line: null, signal: null, hist: null };
  if (lastMacd.line === null || lastMacd.signal === null) missingIndicators.push('MACD(12,26,9)');

  const bollinger20_2 = calculateBollingerBands(closes, 20, 2);
  if (bollinger20_2.upper === null) missingIndicators.push('Bollinger(20,2)');

  const atr14 = calculateATR14(validCandles, 14);
  if (atr14 === null) missingIndicators.push('ATR14');

  const adx14 = calculateADX14(validCandles, 14);
  if (adx14 === null) missingIndicators.push('ADX14');

  const vwap = calculateVWAP(intradayCandles);

  // Fibonacci over trailing 60 sessions
  let fibonacci: TechnicalIndicators['fibonacci'] = null;
  if (validCandles.length >= 20) {
    const lookback = validCandles.slice(-60);
    const swingHigh = Math.max(...lookback.map((c) => c.high));
    const swingLow = Math.min(...lookback.map((c) => c.low));
    const diff = swingHigh - swingLow;
    fibonacci = {
      swingHigh: round2(swingHigh),
      swingLow: round2(swingLow),
      retracement382: round2(swingHigh - 0.382 * diff),
      retracement500: round2(swingHigh - 0.5 * diff),
      retracement618: round2(swingHigh - 0.618 * diff),
    };
  }

  // Pivot-based Support and Resistance zones (excluding last 2 candles for clean prior structure)
  const supportZones: number[] = [];
  const resistanceZones: number[] = [];

  if (validCandles.length >= 15 && latestClose !== null) {
    const window = validCandles.slice(-65, -1);
    for (let i = 2; i < window.length - 2; i++) {
      const c = window[i];
      const isSwingHigh =
        c.high > window[i - 1].high &&
        c.high > window[i - 2].high &&
        c.high > window[i + 1].high &&
        c.high > window[i + 2].high;
      const isSwingLow =
        c.low < window[i - 1].low &&
        c.low < window[i - 2].low &&
        c.low < window[i + 1].low &&
        c.low < window[i + 2].low;

      if (isSwingHigh && c.high >= latestClose * 0.995) {
        resistanceZones.push(round2(c.high));
      }
      if (isSwingLow && c.low <= latestClose * 1.005) {
        supportZones.push(round2(c.low));
      }
    }
  }

  // Deduplicate nearby zones within 1.2%
  const dedup = (arr: number[], ascending: boolean) => {
    const sorted = [...arr].sort((a, b) => (ascending ? a - b : b - a));
    const kept: number[] = [];
    for (const val of sorted) {
      if (!kept.some((k) => Math.abs(k - val) / val < 0.012)) {
        kept.push(val);
      }
    }
    return kept.slice(0, 3);
  };

  // Fallback to 60-day range high/low if pivot array sparse
  const lookback60 = validCandles.slice(-60);
  const recentHigh = lookback60.length ? round2(Math.max(...lookback60.map((c) => c.high))) : null;
  const recentLow = lookback60.length ? round2(Math.min(...lookback60.map((c) => c.low))) : null;

  const finalSupport = dedup(supportZones, false);
  if (finalSupport.length === 0 && recentLow !== null) finalSupport.push(recentLow);

  const finalResistance = dedup(resistanceZones, true);
  if (finalResistance.length === 0 && recentHigh !== null) finalResistance.push(recentHigh);

  return {
    latestClose,
    prevClose,
    pctChange,
    latestVolume,
    avgVolume20,
    volumeRatio,
    ema20,
    ema50,
    ema200,
    ema20Series,
    ema50Series,
    ema200Series,
    rsi14,
    rsiSeries,
    macd: {
      line: lastMacd.line,
      signal: lastMacd.signal,
      histogram: lastMacd.hist,
      series: macdSeries,
    },
    bollinger20_2,
    atr14,
    adx14,
    vwap,
    fibonacci,
    supportZones: finalSupport,
    resistanceZones: finalResistance,
    calculationComplete: missingIndicators.length === 0,
    missingIndicators,
  };
}

/**
 * Section 10: Multi-Timeframe Analysis Engine
 * Higher timeframe (Weekly) determines trend; Daily & optional 1H determine timing.
 */
export function evaluateMultiTimeframe(
  dailyCandles: OHLCVCandle[],
  tech: TechnicalIndicators,
  intradayCandles?: OHLCVCandle[]
): MultiTimeframeAnalysis {
  if (!tech.latestClose || !tech.ema20 || !tech.ema50 || !tech.ema200) {
    return {
      weeklyTrend: 'Insufficient Data',
      dailyTrend: 'Insufficient Data',
      entryTimeframe: 'Daily',
      entryStatus: 'Incomplete EMA history',
      alignment: 'WARNING',
      intradayAvailable: Boolean(intradayCandles && intradayCandles.length > 0),
    };
  }

  // Weekly trend via resampled weekly candles
  const weeklyCandles = resampleToWeekly(dailyCandles);
  let weeklyTrend: MultiTimeframeAnalysis['weeklyTrend'] = 'Sideways';
  if (weeklyCandles.length >= 20) {
    const wCloses = weeklyCandles.map((c) => c.close);
    const wEma10 = calculateEMASeries(wCloses, 10);
    const wEma20 = calculateEMASeries(wCloses, 20);
    const lastW = wCloses[wCloses.length - 1];
    const lastW10 = wEma10[wEma10.length - 1];
    const lastW20 = wEma20[wEma20.length - 1];

    if (lastW10 !== null && lastW20 !== null) {
      if (lastW > lastW10 && lastW10 > lastW20) weeklyTrend = 'Bullish';
      else if (lastW < lastW10 && lastW10 < lastW20) weeklyTrend = 'Bearish';
      else weeklyTrend = 'Sideways';
    }
  } else {
    weeklyTrend = 'Insufficient Data';
  }

  // Daily trend
  let dailyTrend: MultiTimeframeAnalysis['dailyTrend'] = 'Sideways';
  if (tech.latestClose > tech.ema50 && tech.ema50 > tech.ema200) {
    dailyTrend = 'Bullish';
  } else if (tech.latestClose < tech.ema50 && tech.ema50 < tech.ema200) {
    dailyTrend = 'Bearish';
  }

  // Entry timeframe
  const intradayAvailable = Boolean(intradayCandles && intradayCandles.length >= 10);
  const entryTimeframe = intradayAvailable ? '1H (Intraday)' : 'Daily';
  let entryStatus = 'Consolidating';

  if (dailyTrend === 'Bullish') {
    const distFromEma20Pct = ((tech.latestClose - tech.ema20) / tech.ema20) * 100;
    if (distFromEma20Pct >= -2.0 && distFromEma20Pct <= 2.5) {
      entryStatus = 'Pullback near EMA20';
    } else if (distFromEma20Pct > 2.5) {
      entryStatus = 'Extended above EMA20';
    } else {
      entryStatus = 'Testing EMA50 support';
    }
  } else if (dailyTrend === 'Bearish') {
    entryStatus = 'Downtrend / Below EMAs';
  }

  let alignment: MultiTimeframeAnalysis['alignment'] = 'WARNING';
  if (weeklyTrend === 'Bullish' && dailyTrend === 'Bullish') {
    alignment = 'PASS';
  } else if (weeklyTrend === 'Bearish' || dailyTrend === 'Bearish') {
    alignment = 'FAIL';
  }

  return {
    weeklyTrend,
    dailyTrend,
    entryTimeframe,
    entryStatus,
    alignment,
    intradayAvailable,
  };
}

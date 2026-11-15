import { LiquidityCheckResult, LiquidityConfig, RawMarketStock } from '../types/trading';

/**
 * Section 6: Mandatory Liquidity Filter
 * Filters out illiquid stocks, penny stocks, or stocks with insufficient trading history
 * before they can enter the deterministic setup engine.
 */
export function evaluateLiquidityFilter(
  stock: RawMarketStock,
  config: LiquidityConfig
): LiquidityCheckResult {
  const candles = stock.candles || [];
  const tradingDays = candles.length;
  const reasons: string[] = [];

  const isSmallcapStrict =
    stock.marketCapCategory === 'Small Cap' ||
    (stock.universeBuckets?.includes('NIFTY SMALLCAP 250') &&
      !stock.universeBuckets?.includes('NIFTY 50') &&
      !stock.universeBuckets?.includes('NIFTY MIDCAP 150'));

  const effMinTurnoverCr = isSmallcapStrict
    ? config.smallcapMinAvgDailyTradedValueCr
    : config.minAvgDailyTradedValueCr;
  const effMinVolume = isSmallcapStrict ? config.smallcapMinAvgVolume : config.minAvgVolume;
  const effMinPrice = isSmallcapStrict ? config.smallcapMinPrice : config.minPrice;

  if (tradingDays === 0) {
    return {
      status: 'FAIL',
      tradingDays: 0,
      avgDailyTradedValueCr: 0,
      avgVolume: 0,
      currentPrice: 0,
      estimatedSpreadPct: stock.estimatedSpreadPct,
      ruleProfile: isSmallcapStrict ? 'STRICT_SMALLCAP' : 'STANDARD',
      strictModeApplied: isSmallcapStrict,
      reasons: ['No trading candles available to evaluate liquidity.'],
    };
  }

  const latestCandle = candles[candles.length - 1];
  const currentPrice = latestCandle.close;

  // Use last 20 sessions for average volume & traded value
  const lookback = candles.slice(-20);
  const avgVolume =
    lookback.reduce((sum, c) => sum + (Number.isFinite(c.volume) ? c.volume : 0), 0) /
    lookback.length;
  const avgTradedValueRupees =
    lookback.reduce(
      (sum, c) => sum + (Number.isFinite(c.volume) && Number.isFinite(c.close) ? c.volume * c.close : 0),
      0
    ) / lookback.length;
  const avgDailyTradedValueCr = Math.round((avgTradedValueRupees / 1e7) * 100) / 100;

  let failCount = 0;
  let warnCount = 0;

  if (tradingDays < config.minTradingDays) {
    failCount++;
    reasons.push(
      `Trading history (${tradingDays} sessions) is below configured minimum (${config.minTradingDays} sessions).`
    );
  }

  if (avgDailyTradedValueCr < effMinTurnoverCr) {
    failCount++;
    reasons.push(
      `Average traded value (₹${avgDailyTradedValueCr.toFixed(2)} Cr) is below ${isSmallcapStrict ? 'strict smallcap ' : 'configured '}threshold (₹${effMinTurnoverCr} Cr).`
    );
  }

  if (avgVolume < effMinVolume) {
    failCount++;
    reasons.push(
      `Average volume (${Math.round(avgVolume).toLocaleString('en-IN')}) is below ${isSmallcapStrict ? 'strict smallcap ' : ''}minimum (${effMinVolume.toLocaleString('en-IN')}).`
    );
  }

  if (currentPrice < effMinPrice) {
    failCount++;
    reasons.push(
      `Current price (₹${currentPrice.toFixed(2)}) is below ${isSmallcapStrict ? 'strict smallcap ' : ''}minimum price filter (₹${effMinPrice}).`
    );
  }

  if (stock.estimatedSpreadPct !== null && stock.estimatedSpreadPct > config.maxSpreadPct) {
    warnCount++;
    reasons.push(
      `Estimated bid-ask spread (${stock.estimatedSpreadPct.toFixed(2)}%) exceeds ${config.maxSpreadPct}% target.`
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      `${isSmallcapStrict ? 'Strict Smallcap' : 'Standard'} liquidity thresholds satisfied (₹${avgDailyTradedValueCr.toFixed(1)} Cr avg daily turnover across ${tradingDays} sessions).`
    );
  }

  return {
    status: failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARNING' : 'PASS',
    tradingDays,
    avgDailyTradedValueCr,
    avgVolume: Math.round(avgVolume),
    currentPrice,
    estimatedSpreadPct: stock.estimatedSpreadPct,
    ruleProfile: isSmallcapStrict ? 'STRICT_SMALLCAP' : 'STANDARD',
    strictModeApplied: isSmallcapStrict,
    reasons,
  };
}

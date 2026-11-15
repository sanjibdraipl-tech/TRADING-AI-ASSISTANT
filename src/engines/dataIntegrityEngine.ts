import {
  CorporateActionStatus,
  DataIntegrityReport,
  DataIntegrityStatus,
  DataSourceType,
  RawMarketStock,
} from '../types/trading';

/**
 * Section 7: Corporate Action Engine
 * Checks whether historical OHLCV series is properly adjusted for splits, bonuses, dividends, mergers.
 */
export function evaluateCorporateActions(stock: RawMarketStock): CorporateActionStatus {
  const hasActions = stock.corporateActions.length > 0;

  if (!hasActions && stock.corporateActionsVerified) {
    return {
      hasActions: false,
      isProperlyAdjusted: true,
      statusLabel: 'NO_ACTIONS',
      message: 'No unadjusted splits, bonuses, or demergers affecting historical continuity.',
      actions: [],
    };
  }

  if (!stock.corporateActionsVerified) {
    return {
      hasActions,
      isProperlyAdjusted: false,
      statusLabel: 'UNVERIFIED_WARNING',
      message:
        'Historical price series may be inconsistent because corporate-action adjustment could not be verified.',
      actions: stock.corporateActions,
    };
  }

  return {
    hasActions: true,
    isProperlyAdjusted: true,
    statusLabel: 'VERIFIED_ADJUSTED',
    message: `All ${stock.corporateActions.length} corporate action(s) verified and adjusted in historical series.`,
    actions: stock.corporateActions,
  };
}

/**
 * Section 5: Data Integrity Panel Engine
 * Validates candle completeness, duplicates, OHLC consistency, freshness, and corporate actions.
 */
export function evaluateDataIntegrity(
  stock: RawMarketStock,
  dataSource: DataSourceType,
  referenceDateMs: number = new Date('2026-11-15T12:00:00Z').getTime()
): DataIntegrityReport {
  const candles = stock.candles || [];
  const issues: string[] = [];
  let score = 100;

  // 1. Check active symbol
  if (!stock.activeSymbol) {
    issues.push('Symbol is marked inactive or suspended on exchange.');
    score -= 50;
  }

  // 2. Check candle count
  const numberOfCandles = candles.length;
  if (numberOfCandles === 0) {
    issues.push('No OHLCV price candles available.');
    score -= 70;
  } else if (numberOfCandles < 200) {
    issues.push(`Insufficient history: ${numberOfCandles} candles found (200 required for EMA200 & full validation).`);
    score -= 30;
  }

  // 3. Check duplicate candles & OHLC consistency
  const seenDates = new Set<string>();
  let duplicateCandles = 0;
  let ohlcErrors = 0;
  let missingCandles = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!c || !c.timestamp) {
      missingCandles++;
      continue;
    }

    if (seenDates.has(c.timestamp)) {
      duplicateCandles++;
    }
    seenDates.add(c.timestamp);

    const invalidNumeric =
      !Number.isFinite(c.open) ||
      !Number.isFinite(c.high) ||
      !Number.isFinite(c.low) ||
      !Number.isFinite(c.close) ||
      !Number.isFinite(c.volume) ||
      c.open <= 0 ||
      c.high <= 0 ||
      c.low <= 0 ||
      c.close <= 0 ||
      c.volume < 0;

    const inconsistentBounds =
      c.high < Math.max(c.open, c.close) ||
      c.low > Math.min(c.open, c.close) ||
      c.low > c.high;

    if (invalidNumeric || inconsistentBounds) {
      ohlcErrors++;
    }
  }

  if (duplicateCandles > 0) {
    issues.push(`Detected ${duplicateCandles} duplicate timestamp candle(s).`);
    score -= Math.min(30, duplicateCandles * 10);
  }
  if (ohlcErrors > 0) {
    issues.push(`Detected ${ohlcErrors} candle(s) with invalid OHLC bounds or missing prices.`);
    score -= Math.min(40, ohlcErrors * 15);
  }
  if (missingCandles > 0) {
    issues.push(`Detected ${missingCandles} malformed or missing candle record(s).`);
    score -= Math.min(30, missingCandles * 10);
  }

  // 4. Corporate action verification
  if (!stock.corporateActionsVerified) {
    issues.push('Corporate-action adjustment unverified — historical indicators may be skewed.');
    score -= 25;
  }

  // 5. Data freshness check
  let dataFreshness: DataIntegrityReport['dataFreshness'] = 'FRESH';
  const lastUpdatedMs = Date.parse(stock.lastUpdatedTimestamp);
  if (Number.isNaN(lastUpdatedMs)) {
    dataFreshness = 'STALE';
    issues.push('Data timestamp is invalid or missing.');
    score -= 25;
  } else {
    const ageDays = (referenceDateMs - lastUpdatedMs) / (1000 * 60 * 60 * 24);
    if (ageDays > 7) {
      dataFreshness = 'STALE';
      issues.push(`Data is stale (${Math.round(ageDays)} days old). Analysis confidence reduced.`);
      score -= 30;
    } else if (ageDays > 2 || stock.isDemoData) {
      dataFreshness = 'DELAYED';
    }
  }

  const finalScore = Math.max(0, Math.min(100, score));
  let status: DataIntegrityStatus = 'GREEN';

  if (
    !stock.activeSymbol ||
    numberOfCandles < 30 ||
    ohlcErrors > 0 ||
    finalScore < 55
  ) {
    status = 'RED';
  } else if (
    duplicateCandles > 0 ||
    !stock.corporateActionsVerified ||
    dataFreshness === 'STALE' ||
    numberOfCandles < 200 ||
    finalScore < 85
  ) {
    status = 'YELLOW';
  }

  return {
    symbol: stock.symbol,
    exchange: stock.exchange,
    companyName: stock.companyName,
    dataSource,
    lastUpdatedTimestamp: stock.lastUpdatedTimestamp,
    dataInterval: stock.dataInterval,
    numberOfCandles,
    missingCandles,
    duplicateCandles,
    ohlcConsistent: ohlcErrors === 0 && missingCandles === 0,
    ohlcErrors,
    corporateActionAdjusted: stock.corporateActionsVerified,
    activeSymbol: stock.activeSymbol,
    dataFreshness,
    dataQualityScore: finalScore,
    status,
    issues,
  };
}

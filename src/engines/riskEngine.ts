import {
  PaperPosition,
  RiskCalculationResult,
  RiskConfig,
  RiskLimitState,
  TradeJournalEntry,
} from '../types/trading';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Indian Equity Transaction Charges (Delivery vs Intraday)
 * Includes Brokerage, STT, NSE Exchange Tx, SEBI charges, Stamp Duty, GST.
 */
export function estimateTransactionCharges(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  mode: 'delivery' | 'intraday' = 'delivery'
): number {
  if (entryPrice <= 0 || exitPrice <= 0 || quantity <= 0) return 0;
  const buyVal = entryPrice * quantity;
  const sellVal = exitPrice * quantity;
  const turnover = buyVal + sellVal;

  const brokerage = mode === 'delivery' ? 0 : Math.min(40, turnover * 0.0003);
  const stt = mode === 'delivery' ? turnover * 0.001 : sellVal * 0.00025;
  const exchangeTx = turnover * 0.0000297;
  const sebi = turnover * 0.000001;
  const stampDuty = buyVal * (mode === 'delivery' ? 0.00015 : 0.00003);
  const gst = (brokerage + exchangeTx + sebi) * 0.18;

  return round2(brokerage + stt + exchangeTx + sebi + stampDuty + gst);
}

/**
 * Section 16: Deterministic Risk Calculator
 * Formula: Quantity = floor((Capital * Risk %) / |Entry - Stop Loss|)
 * Enforces whole integer rounding down and guards against zero stop-loss distance or over-allocation.
 */
export function calculateDeterministicRisk(
  capital: number,
  riskPct: number,
  entryPrice: number,
  stopLossPrice: number,
  singleStockLimitPct: number = 25,
  includeEstimatedCharges: boolean = true
): RiskCalculationResult {
  if (!Number.isFinite(capital) || capital <= 0) {
    return {
      valid: false,
      error: 'Capital must be greater than ₹0.',
      riskAmount: 0,
      riskPerShare: 0,
      quantity: 0,
      positionValue: 0,
      oneRPrice: 0,
      twoRPrice: 0,
      threeRPrice: 0,
      maxPlannedLoss: 0,
      estimatedCharges: 0,
      totalCapitalPct: 0,
      exceedsSingleStockLimit: false,
    };
  }

  if (!Number.isFinite(riskPct) || riskPct <= 0 || riskPct > 5) {
    return {
      valid: false,
      error: 'Risk % must be between 0.1% and 5.0%.',
      riskAmount: 0,
      riskPerShare: 0,
      quantity: 0,
      positionValue: 0,
      oneRPrice: 0,
      twoRPrice: 0,
      threeRPrice: 0,
      maxPlannedLoss: 0,
      estimatedCharges: 0,
      totalCapitalPct: 0,
      exceedsSingleStockLimit: false,
    };
  }

  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(stopLossPrice) || stopLossPrice <= 0) {
    return {
      valid: false,
      error: 'Entry and Stop-Loss prices must be positive numbers.',
      riskAmount: 0,
      riskPerShare: 0,
      quantity: 0,
      positionValue: 0,
      oneRPrice: 0,
      twoRPrice: 0,
      threeRPrice: 0,
      maxPlannedLoss: 0,
      estimatedCharges: 0,
      totalCapitalPct: 0,
      exceedsSingleStockLimit: false,
    };
  }

  const riskPerShare = round2(Math.abs(entryPrice - stopLossPrice));
  if (riskPerShare <= 0) {
    return {
      valid: false,
      error: 'Zero stop-loss distance: Entry price and Stop-Loss cannot be equal.',
      riskAmount: 0,
      riskPerShare: 0,
      quantity: 0,
      positionValue: 0,
      oneRPrice: 0,
      twoRPrice: 0,
      threeRPrice: 0,
      maxPlannedLoss: 0,
      estimatedCharges: 0,
      totalCapitalPct: 0,
      exceedsSingleStockLimit: false,
    };
  }

  if (stopLossPrice >= entryPrice) {
    return {
      valid: false,
      error: 'Invalid Stop-Loss for equity long setup: Stop-Loss must be strictly below Entry Price.',
      riskAmount: 0,
      riskPerShare,
      quantity: 0,
      positionValue: 0,
      oneRPrice: 0,
      twoRPrice: 0,
      threeRPrice: 0,
      maxPlannedLoss: 0,
      estimatedCharges: 0,
      totalCapitalPct: 0,
      exceedsSingleStockLimit: false,
    };
  }

  const riskAmount = round2((capital * riskPct) / 100);
  const rawQuantity = Math.floor(riskAmount / riskPerShare);
  const maxAffordableShares = Math.floor(capital / entryPrice);
  const quantity = Math.max(0, Math.min(rawQuantity, maxAffordableShares));

  const positionValue = round2(quantity * entryPrice);
  const maxPlannedLoss = round2(quantity * riskPerShare);
  const twoRPrice = round2(entryPrice + 2 * riskPerShare);
  const estimatedCharges = includeEstimatedCharges
    ? estimateTransactionCharges(entryPrice, twoRPrice, quantity, 'delivery')
    : 0;
  const totalCapitalPct = round2((positionValue / capital) * 100);

  return {
    valid: true,
    riskAmount,
    riskPerShare,
    quantity,
    positionValue,
    oneRPrice: round2(entryPrice + riskPerShare),
    twoRPrice,
    threeRPrice: round2(entryPrice + 3 * riskPerShare),
    maxPlannedLoss,
    estimatedCharges,
    totalCapitalPct,
    exceedsSingleStockLimit: totalCapitalPct > singleStockLimitPct,
  };
}

/**
 * Section 17: Deterministic Risk Controls Blocker
 * Blocks new setups if daily loss limit, weekly loss limit, max open positions, or max portfolio exposure are breached.
 */
export function evaluateRiskControls(
  riskConfig: RiskConfig,
  journalEntries: TradeJournalEntry[],
  openPaperPositions: PaperPosition[],
  referenceDateStr: string = '2026-11-15'
): RiskLimitState {
  const reasons: string[] = [];

  // Daily realized loss (closed trades on referenceDateStr + closed paper today)
  const closedToday = journalEntries.filter((e) => e.date === referenceDateStr && e.netPnl !== null);
  const dailyNetPnl = closedToday.reduce((sum, e) => sum + (e.netPnl || 0), 0);
  const dailyLossUsedPct = dailyNetPnl < 0 ? round2((Math.abs(dailyNetPnl) / riskConfig.capital) * 100) : 0;

  if (dailyLossUsedPct >= riskConfig.maxDailyLossPct) {
    reasons.push(
      `Daily loss limit reached (${dailyLossUsedPct}% lost vs ${riskConfig.maxDailyLossPct}% limit).`
    );
  }

  // Weekly realized loss (within trailing 7 days of referenceDateStr)
  const refMs = Date.parse(referenceDateStr);
  const closedThisWeek = journalEntries.filter((e) => {
    if (e.netPnl === null) return false;
    const dMs = Date.parse(e.date);
    if (Number.isNaN(dMs) || Number.isNaN(refMs)) return false;
    const diffDays = (refMs - dMs) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  });
  const weeklyNetPnl = closedThisWeek.reduce((sum, e) => sum + (e.netPnl || 0), 0);
  const weeklyLossUsedPct = weeklyNetPnl < 0 ? round2((Math.abs(weeklyNetPnl) / riskConfig.capital) * 100) : 0;

  if (weeklyLossUsedPct >= riskConfig.maxWeeklyLossPct) {
    reasons.push(
      `Weekly loss limit reached (${weeklyLossUsedPct}% lost vs ${riskConfig.maxWeeklyLossPct}% limit).`
    );
  }

  const openOnly = openPaperPositions.filter((p) => p.status === 'OPEN');
  const openPositionsCount = openOnly.length;
  if (openPositionsCount >= riskConfig.maxOpenPositions) {
    reasons.push(
      `Maximum open positions reached (${openPositionsCount}/${riskConfig.maxOpenPositions}).`
    );
  }

  const openExposure = openOnly.reduce((sum, p) => sum + p.entryPrice * p.quantity, 0);
  const portfolioExposurePct = round2((openExposure / Math.max(1, riskConfig.capital)) * 100);
  if (portfolioExposurePct >= riskConfig.maxPortfolioExposurePct) {
    reasons.push(
      `Maximum portfolio exposure reached (${portfolioExposurePct}% vs ${riskConfig.maxPortfolioExposurePct}% limit).`
    );
  }

  return {
    blocked: reasons.length > 0,
    reasons,
    dailyLossUsedPct,
    weeklyLossUsedPct,
    openPositionsCount,
    portfolioExposurePct,
  };
}

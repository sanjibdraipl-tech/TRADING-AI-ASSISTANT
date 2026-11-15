import { PerformanceMetrics, TradeJournalEntry } from '../types/trading';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Sections 23 & 24: Performance & Expectancy Calculation Engine
 * Expectancy = (Win Rate × Average Win) − (Loss Rate × Average Loss)
 */
export function calculatePerformanceMetrics(
  entries: TradeJournalEntry[],
  startingCapital: number = 100000,
  sectorLookup: Record<string, string> = {}
): PerformanceMetrics {
  const closed = entries
    .filter((e) => e.exit !== null && e.netPnl !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (closed.length === 0) {
    return {
      totalTrades: entries.length,
      closedTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRatePct: 0,
      avgWinRs: 0,
      avgLossRs: 0,
      avgWinR: 0,
      avgLossR: 0,
      profitFactor: 0,
      expectancyRs: 0,
      expectancyR: 0,
      averageR: 0,
      maxDrawdownRs: 0,
      maxDrawdownPct: 0,
      largestWinRs: 0,
      largestLossRs: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      monthlyPnl: [],
      setupWise: [],
      sectorWise: [],
      equityCurve: [{ tradeIndex: 0, date: 'Start', equity: startingCapital }],
    };
  }

  const wins = closed.filter((t) => (t.netPnl || 0) > 0);
  const losses = closed.filter((t) => (t.netPnl || 0) <= 0);

  const winRate = wins.length / closed.length;
  const lossRate = 1 - winRate;
  const winRatePct = round2(winRate * 100);

  const grossWins = wins.reduce((s, t) => s + (t.netPnl || 0), 0);
  const grossLosses = Math.abs(losses.reduce((s, t) => s + (t.netPnl || 0), 0));

  const avgWinRs = wins.length > 0 ? round2(grossWins / wins.length) : 0;
  const avgLossRs = losses.length > 0 ? round2(grossLosses / losses.length) : 0;

  const rMult = (t: TradeJournalEntry) => (t.riskAmount > 0 ? (t.netPnl || 0) / t.riskAmount : 0);
  const avgWinR = wins.length > 0 ? round2(wins.reduce((s, t) => s + rMult(t), 0) / wins.length) : 0;
  const avgLossR =
    losses.length > 0 ? round2(Math.abs(losses.reduce((s, t) => s + rMult(t), 0) / losses.length)) : 0;

  const profitFactor = grossLosses > 0 ? round2(grossWins / grossLosses) : grossWins > 0 ? 99 : 0;

  // Section 24 Exact Expectancy Formula
  const expectancyRs = round2(winRate * avgWinRs - lossRate * avgLossRs);
  const expectancyR = round2(winRate * avgWinR - lossRate * avgLossR);
  const averageR = round2(closed.reduce((s, t) => s + rMult(t), 0) / closed.length);

  // Equity curve, Drawdown, Streaks
  let equity = startingCapital;
  let peak = startingCapital;
  let maxDrawdownRs = 0;
  let maxDrawdownPct = 0;
  let curWinStreak = 0;
  let curLossStreak = 0;
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let largestWinRs = 0;
  let largestLossRs = 0;

  const equityCurve: PerformanceMetrics['equityCurve'] = [
    { tradeIndex: 0, date: 'Start', equity: startingCapital },
  ];

  const monthlyMap: Record<string, { netPnl: number; trades: number }> = {};
  const setupMap: Record<string, { wins: number; trades: number; netPnl: number }> = {};
  const sectorMap: Record<string, { trades: number; netPnl: number }> = {};

  closed.forEach((t, idx) => {
    const pnl = t.netPnl || 0;
    equity = round2(equity + pnl);
    if (equity > peak) peak = equity;
    const ddRs = round2(peak - equity);
    const ddPct = peak > 0 ? round2((ddRs / peak) * 100) : 0;
    if (ddRs > maxDrawdownRs) maxDrawdownRs = ddRs;
    if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;

    if (pnl > largestWinRs) largestWinRs = round2(pnl);
    if (pnl < largestLossRs) largestLossRs = round2(pnl);

    if (pnl > 0) {
      curWinStreak++;
      curLossStreak = 0;
      if (curWinStreak > maxConsecutiveWins) maxConsecutiveWins = curWinStreak;
    } else {
      curLossStreak++;
      curWinStreak = 0;
      if (curLossStreak > maxConsecutiveLosses) maxConsecutiveLosses = curLossStreak;
    }

    equityCurve.push({ tradeIndex: idx + 1, date: t.date, equity });

    const month = t.date.slice(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = { netPnl: 0, trades: 0 };
    monthlyMap[month].netPnl = round2(monthlyMap[month].netPnl + pnl);
    monthlyMap[month].trades++;

    if (!setupMap[t.setup]) setupMap[t.setup] = { wins: 0, trades: 0, netPnl: 0 };
    setupMap[t.setup].trades++;
    if (pnl > 0) setupMap[t.setup].wins++;
    setupMap[t.setup].netPnl = round2(setupMap[t.setup].netPnl + pnl);

    const sector = sectorLookup[t.symbol] || 'Other';
    if (!sectorMap[sector]) sectorMap[sector] = { trades: 0, netPnl: 0 };
    sectorMap[sector].trades++;
    sectorMap[sector].netPnl = round2(sectorMap[sector].netPnl + pnl);
  });

  return {
    totalTrades: entries.length,
    closedTrades: closed.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRatePct,
    avgWinRs,
    avgLossRs,
    avgWinR,
    avgLossR,
    profitFactor,
    expectancyRs,
    expectancyR,
    averageR,
    maxDrawdownRs,
    maxDrawdownPct,
    largestWinRs,
    largestLossRs,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    monthlyPnl: Object.entries(monthlyMap).map(([month, d]) => ({ month, ...d })),
    setupWise: Object.entries(setupMap).map(([setup, d]) => ({
      setup,
      trades: d.trades,
      winRate: round2((d.wins / d.trades) * 100),
      netPnl: d.netPnl,
    })),
    sectorWise: Object.entries(sectorMap).map(([sector, d]) => ({ sector, ...d })),
    equityCurve,
  };
}

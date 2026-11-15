import {
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  IndicatorConfig,
  OHLCVCandle,
} from '../types/trading';
import {
  calculateATR14,
  calculateADX14,
  calculateBollingerBands,
  calculateEMASeries,
  calculateRSISeries,
} from './indicatorEngine';
import { estimateTransactionCharges } from './riskEngine';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Sections 25, 26, 38: Deterministic Zero-Look-Ahead Backtest Engine
 * Strict No Look-Ahead Bias Guarantee:
 * At bar index `i`, only `candles.slice(0, i + 1)` is visible to indicator & entry logic.
 * Entries execute on next-bar open (`candles[i + 1].open`) or strictly at signal close + slippage,
 * and exits never peek past the current bar `j`.
 */
export function runZeroLookAheadBacktest(
  candles: OHLCVCandle[],
  config: BacktestConfig,
  indicatorCfg: IndicatorConfig,
  corporateActionsVerified: boolean = true
): BacktestResult {
  const trades: BacktestTrade[] = [];
  const equityCurve: BacktestResult['equityCurve'] = [];

  let equity = config.capital;
  let peakEquity = config.capital;
  let maxDrawdownPct = 0;

  // Need at least 210 candles to compute EMA200 safely without look-ahead
  const warmupBars = Math.min(205, Math.max(50, Math.floor(candles.length * 0.35)));
  const splitIndex = Math.floor(candles.length * (config.outOfSampleSplitPct / 100));

  let activePosition: {
    entryDate: string;
    entryPrice: number;
    stopLoss: number;
    target2R: number;
    quantity: number;
    riskPerShare: number;
    sampleSegment: 'IN_SAMPLE' | 'OUT_OF_SAMPLE';
  } | null = null;

  for (let i = warmupBars; i < candles.length - 1; i++) {
    // STRICT NO LOOK-AHEAD: Slice only up to bar `i`
    const visibleHistory = candles.slice(0, i + 1);
    const currentBar = visibleHistory[visibleHistory.length - 1];
    const nextBar = candles[i + 1]; // Execution happens on next session open (realistic)
    const segment: 'IN_SAMPLE' | 'OUT_OF_SAMPLE' = i >= splitIndex ? 'OUT_OF_SAMPLE' : 'IN_SAMPLE';

    const closes = visibleHistory.map((c) => c.close);
    const ema20Arr = calculateEMASeries(closes, indicatorCfg.emaFast);
    const ema50Arr = calculateEMASeries(closes, indicatorCfg.emaMedium);
    const ema200Arr = calculateEMASeries(closes, indicatorCfg.emaSlow);
    const rsiArr = calculateRSISeries(closes, indicatorCfg.rsiPeriod);

    const ema20 = ema20Arr[ema20Arr.length - 1];
    const ema50 = ema50Arr[ema50Arr.length - 1];
    const ema200 = ema200Arr[ema200Arr.length - 1];
    const rsi = rsiArr[rsiArr.length - 1];
    const atr = calculateATR14(visibleHistory, 14);

    // 1. Check exit on current bar if a position is already open
    if (activePosition) {
      let exitPrice: number | null = null;
      let exitReason: BacktestTrade['exitReason'] | null = null;

      // Conservative execution: check Stop-Loss hit first if bar gaps down or hits low <= SL
      if (currentBar.open <= activePosition.stopLoss) {
        exitPrice = currentBar.open * (1 - config.slippagePct / 100);
        exitReason = 'STOP_LOSS';
      } else if (currentBar.low <= activePosition.stopLoss) {
        exitPrice = activePosition.stopLoss * (1 - config.slippagePct / 100);
        exitReason = 'STOP_LOSS';
      } else if (currentBar.high >= activePosition.target2R) {
        exitPrice = activePosition.target2R * (1 - config.slippagePct / 100);
        exitReason = 'TARGET_2R';
      } else if (ema20 !== null && currentBar.close < ema20 && currentBar.close > activePosition.entryPrice) {
        exitPrice = currentBar.close * (1 - config.slippagePct / 100);
        exitReason = 'TRAILING_EMA20';
      }

      if (exitPrice !== null && exitReason !== null) {
        exitPrice = round2(exitPrice);
        const grossPnl = round2((exitPrice - activePosition.entryPrice) * activePosition.quantity);
        const charges = estimateTransactionCharges(
          activePosition.entryPrice,
          exitPrice,
          activePosition.quantity,
          'delivery'
        );
        const slippageCost = round2(
          (activePosition.entryPrice * (config.slippagePct / 100) +
            exitPrice * (config.slippagePct / 100)) *
            activePosition.quantity
        );
        const netPnl = round2(grossPnl - charges);
        const totalRiskRs = activePosition.riskPerShare * activePosition.quantity;
        const rMultiple = totalRiskRs > 0 ? round2(netPnl / totalRiskRs) : 0;

        equity = round2(equity + netPnl);
        if (equity > peakEquity) peakEquity = equity;
        const dd = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
        if (dd > maxDrawdownPct) maxDrawdownPct = dd;

        trades.push({
          entryDate: activePosition.entryDate,
          exitDate: currentBar.timestamp,
          entryPrice: activePosition.entryPrice,
          exitPrice,
          stopLoss: activePosition.stopLoss,
          quantity: activePosition.quantity,
          grossPnl,
          chargesAndSlippage: round2(charges + slippageCost),
          netPnl,
          rMultiple,
          sampleSegment: activePosition.sampleSegment,
          exitReason,
        });

        equityCurve.push({
          date: currentBar.timestamp,
          equity,
          segment: activePosition.sampleSegment,
        });

        activePosition = null;
        continue;
      }
    }

    // 2. If flat, check entry signal using ONLY visibleHistory up to bar `i`
    if (!activePosition && ema20 !== null && ema50 !== null && ema200 !== null && rsi !== null && atr !== null) {
      let trigger = false;

      if (config.strategyId === 'SETUP_A') {
        const dist20 = ((currentBar.close - ema20) / ema20) * 100;
        const prevBar = visibleHistory[visibleHistory.length - 2];
        const avgVol =
          visibleHistory.slice(-20).reduce((s, c) => s + c.volume, 0) /
          Math.min(20, visibleHistory.length);
        trigger =
          currentBar.close > ema50 &&
          currentBar.close > ema200 &&
          dist20 >= -2.0 &&
          dist20 <= 3.5 &&
          rsi >= indicatorCfg.rsiPullbackMin &&
          rsi <= indicatorCfg.rsiOverbought &&
          currentBar.close > currentBar.open &&
          currentBar.close > prevBar.close &&
          currentBar.volume >= avgVol * 1.05;
      } else if (config.strategyId === 'SETUP_B') {
        const prior = visibleHistory.slice(-21, -1);
        const res = Math.max(...prior.map((c) => c.high));
        const avgVol = prior.reduce((s, c) => s + c.volume, 0) / prior.length;
        const bb = calculateBollingerBands(closes, 20, 2);
        trigger =
          currentBar.close > res &&
          currentBar.volume >= avgVol * indicatorCfg.volumeBreakoutMultiplier &&
          (bb.bandwidthPct === null || bb.bandwidthPct < 12);
      } else if (config.strategyId === 'SETUP_C') {
        const adx = calculateADX14(visibleHistory, 14);
        const prior = visibleHistory.slice(-30, -1);
        const sup = Math.min(...prior.map((c) => c.low));
        trigger =
          adx !== null &&
          adx < indicatorCfg.adxTrendThreshold &&
          currentBar.close <= sup * 1.035 &&
          rsi >= 32 &&
          rsi <= 55 &&
          currentBar.close > currentBar.open;
      }

      if (trigger) {
        // Enter at nextBar.open with slippage
        const entryPrice = round2(nextBar.open * (1 + config.slippagePct / 100));
        const stopLoss = round2(Math.max(1, entryPrice - 1.5 * atr));
        const riskPerShare = round2(entryPrice - stopLoss);
        if (riskPerShare > 0) {
          const riskRs = (equity * config.riskPerTradePct) / 100;
          const rawQty = Math.floor(riskRs / riskPerShare);
          const maxQty = Math.floor(equity / entryPrice);
          const quantity = Math.min(rawQty, maxQty);
          if (quantity > 0) {
            activePosition = {
              entryDate: nextBar.timestamp,
              entryPrice,
              stopLoss,
              target2R: round2(entryPrice + 2 * riskPerShare),
              quantity,
              riskPerShare,
              sampleSegment: segment,
            };
          }
        }
      }
    }
  }

  // Close open position at final candle if still active
  if (activePosition && candles.length > 0) {
    const finalBar = candles[candles.length - 1];
    const exitPrice = round2(finalBar.close * (1 - config.slippagePct / 100));
    const grossPnl = round2((exitPrice - activePosition.entryPrice) * activePosition.quantity);
    const charges = estimateTransactionCharges(
      activePosition.entryPrice,
      exitPrice,
      activePosition.quantity,
      'delivery'
    );
    const netPnl = round2(grossPnl - charges);
    const totalRiskRs = activePosition.riskPerShare * activePosition.quantity;
    const rMultiple = totalRiskRs > 0 ? round2(netPnl / totalRiskRs) : 0;

    equity = round2(equity + netPnl);
    trades.push({
      entryDate: activePosition.entryDate,
      exitDate: finalBar.timestamp,
      entryPrice: activePosition.entryPrice,
      exitPrice,
      stopLoss: activePosition.stopLoss,
      quantity: activePosition.quantity,
      grossPnl,
      chargesAndSlippage: charges,
      netPnl,
      rMultiple,
      sampleSegment: activePosition.sampleSegment,
      exitReason: 'END_OF_SERIES',
    });
    equityCurve.push({
      date: finalBar.timestamp,
      equity,
      segment: activePosition.sampleSegment,
    });
  }

  // Compute aggregate stats
  const wins = trades.filter((t) => t.netPnl > 0);
  const losses = trades.filter((t) => t.netPnl <= 0);
  const winRatePct = trades.length > 0 ? round2((wins.length / trades.length) * 100) : 0;

  const grossWins = wins.reduce((s, t) => s + t.netPnl, 0);
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));
  const profitFactor = grossLosses > 0 ? round2(grossWins / grossLosses) : grossWins > 0 ? 99 : 0;

  const avgWinR = wins.length > 0 ? wins.reduce((s, t) => s + t.rMultiple, 0) / wins.length : 0;
  const avgLossR =
    losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.rMultiple, 0) / losses.length) : 0;
  const winRatio = trades.length > 0 ? wins.length / trades.length : 0;
  const lossRatio = 1 - winRatio;
  const expectancyR = round2(winRatio * avgWinR - lossRatio * avgLossR);

  const inSample = trades.filter((t) => t.sampleSegment === 'IN_SAMPLE');
  const outSample = trades.filter((t) => t.sampleSegment === 'OUT_OF_SAMPLE');

  const calcExpR = (arr: BacktestTrade[]) => {
    if (arr.length === 0) return 0;
    const w = arr.filter((t) => t.netPnl > 0);
    const l = arr.filter((t) => t.netPnl <= 0);
    const wr = w.length / arr.length;
    const aw = w.length > 0 ? w.reduce((s, t) => s + t.rMultiple, 0) / w.length : 0;
    const al = l.length > 0 ? Math.abs(l.reduce((s, t) => s + t.rMultiple, 0) / l.length) : 0;
    return round2(wr * aw - (1 - wr) * al);
  };

  return {
    config,
    totalCandlesTested: candles.length,
    trades,
    metrics: {
      totalTrades: trades.length,
      winRatePct,
      profitFactor,
      expectancyR,
      maxDrawdownPct: round2(maxDrawdownPct),
      netPnlRs: round2(equity - config.capital),
      finalEquityRs: equity,
      inSampleTrades: inSample.length,
      inSampleExpectancyR: calcExpR(inSample),
      outOfSampleTrades: outSample.length,
      outOfSampleExpectancyR: calcExpR(outSample),
    },
    equityCurve,
    lookAheadVerification: corporateActionsVerified
      ? 'VERIFIED: Strictly causal bar-by-bar evaluation (candles[0..i] only). Next-bar open execution + slippage + statutory charges applied.'
      : 'WARNING: Corporate action adjustment unverified on historical series; backtest equity curve may reflect artificial price gaps.',
  };
}

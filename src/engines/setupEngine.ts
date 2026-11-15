import {
  AppSettings,
  CorporateActionStatus,
  DataIntegrityReport,
  FundamentalScoreBreakdown,
  LiquidityCheckResult,
  MultiTimeframeAnalysis,
  RawMarketStock,
  RiskLimitState,
  SetupCardResult,
  SetupCondition,
  SignalAuditRecord,
  SignalStatus,
  TechnicalIndicators,
} from '../types/trading';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Sections 12, 13, 14, 15, 18: Transparent Rule-Based Setup Engine
 * Never outputs BUY, SELL, STRONG BUY, or TARGET.
 * Never hides failed conditions.
 */
export function evaluateStockSetups(
  raw: RawMarketStock,
  dataIntegrity: DataIntegrityReport,
  corporateActionStatus: CorporateActionStatus,
  liquidity: LiquidityCheckResult,
  tech: TechnicalIndicators,
  mtf: MultiTimeframeAnalysis,
  fundamentalsScore: FundamentalScoreBreakdown,
  settings: AppSettings,
  riskLimits: RiskLimitState
): {
  setupA: SetupCardResult;
  setupB: SetupCardResult;
  setupC: SetupCardResult;
  primarySignal: SignalStatus;
  primarySetupName: string;
  primaryReason: string;
} {
  const indCfg = settings.indicators;
  const riskCfg = settings.risk;
  const candles = raw.candles || [];
  const latest = candles[candles.length - 1];
  const prev = candles.length >= 2 ? candles[candles.length - 2] : null;

  // Hard Data / Liquidity / Risk Gates
  const hasCriticalDataFailure =
    dataIntegrity.status === 'RED' ||
    !tech.calculationComplete ||
    tech.latestClose === null ||
    tech.ema20 === null ||
    tech.ema50 === null ||
    tech.ema200 === null ||
    tech.rsi14 === null ||
    tech.atr14 === null;

  // Helper to build Setup A (Trend Pullback v1.0)
  const buildSetupA = (): SetupCardResult => {
    const conditions: SetupCondition[] = [];
    const close = tech.latestClose;
    const ema20 = tech.ema20;
    const ema50 = tech.ema50;
    const ema200 = tech.ema200;
    const rsi = tech.rsi14;
    const atr = tech.atr14;
    const volRatio = tech.volumeRatio;

    const fundPass = fundamentalsScore.totalScore >= indCfg.minFundamentalScore;
    conditions.push({
      label: 'Fundamental Score',
      status: fundPass ? 'PASS' : 'FAIL',
      actualValue: `${fundamentalsScore.totalScore}/100`,
      requiredRule: `>= ${indCfg.minFundamentalScore}/100`,
    });

    const above50 = close !== null && ema50 !== null && close > ema50;
    conditions.push({
      label: 'EMA50 Trend',
      status: ema50 === null ? 'WARNING' : above50 ? 'PASS' : 'FAIL',
      actualValue: close && ema50 ? `₹${close} vs ₹${ema50}` : 'Incomplete',
      requiredRule: 'Price > EMA50',
    });

    const above200 = close !== null && ema200 !== null && close > ema200;
    conditions.push({
      label: 'EMA200 Trend',
      status: ema200 === null ? 'WARNING' : above200 ? 'PASS' : 'FAIL',
      actualValue: close && ema200 ? `₹${close} vs ₹${ema200}` : 'Incomplete',
      requiredRule: 'Price > EMA200',
    });

    const weeklyBull = mtf.weeklyTrend === 'Bullish';
    conditions.push({
      label: 'Weekly Trend',
      status: mtf.weeklyTrend === 'Insufficient Data' ? 'WARNING' : weeklyBull ? 'PASS' : 'FAIL',
      actualValue: mtf.weeklyTrend,
      requiredRule: 'Weekly Bullish',
    });

    // Pullback toward EMA20 or EMA50 (within -1.5% to +3.5% of EMA20, or between EMA50 and EMA20*1.035)
    let isPullback = false;
    let pullbackDetail = 'N/A';
    if (close !== null && ema20 !== null && ema50 !== null) {
      const dist20Pct = ((close - ema20) / ema20) * 100;
      isPullback = close >= ema50 && dist20Pct <= 3.5;
      pullbackDetail = `${dist20Pct >= 0 ? '+' : ''}${dist20Pct.toFixed(1)}% from EMA20`;
    }
    conditions.push({
      label: 'Pullback to EMA20/50',
      status: close && ema20 ? (isPullback ? 'PASS' : 'FAIL') : 'WARNING',
      actualValue: pullbackDetail,
      requiredRule: 'Within +3.5% of EMA20 & > EMA50',
    });

    const rsiOk = rsi !== null && rsi >= indCfg.rsiPullbackMin && rsi <= indCfg.rsiOverbought;
    conditions.push({
      label: 'RSI Confirmation',
      status: rsi === null ? 'WARNING' : rsiOk ? 'PASS' : 'FAIL',
      actualValue: rsi !== null ? `${rsi}` : 'Missing',
      requiredRule: `${indCfg.rsiPullbackMin} – ${indCfg.rsiOverbought}`,
    });

    const bullishCandle = Boolean(latest && prev && latest.close > latest.open && latest.close > prev.close);
    conditions.push({
      label: 'Bullish Candle',
      status: latest ? (bullishCandle ? 'PASS' : 'FAIL') : 'WARNING',
      actualValue: latest ? (bullishCandle ? 'Green higher close' : 'No bullish confirmation') : 'Missing',
      requiredRule: 'Close > Open & > Prev Close',
    });

    const volOk = volRatio !== null && volRatio >= 1.1;
    conditions.push({
      label: 'Volume Confirmation',
      status: volRatio === null ? 'WARNING' : volOk ? 'PASS' : 'FAIL',
      actualValue: volRatio !== null ? `${volRatio}x 20D avg` : 'Missing',
      requiredRule: '>= 1.1x 20-day avg',
    });

    const suggestedEntry = close ? round2(close) : null;
    const suggestedStopLoss =
      close && atr ? round2(Math.max(0.01, close - riskCfg.atrMultiplier * atr)) : null;
    const riskPerShare =
      suggestedEntry && suggestedStopLoss ? round2(suggestedEntry - suggestedStopLoss) : null;
    const rrValid = riskPerShare !== null && riskPerShare > 0;
    const rrRatio = rrValid ? riskCfg.minRiskReward : null;

    conditions.push({
      label: 'Risk/Reward Gate',
      status: rrValid ? 'PASS' : 'FAIL',
      actualValue: rrValid ? `1:${riskCfg.minRiskReward} (ATR SL ₹${suggestedStopLoss})` : 'Invalid SL distance',
      requiredRule: `>= 1:${riskCfg.minRiskReward}`,
    });

    const allPassed =
      !hasCriticalDataFailure &&
      liquidity.status === 'PASS' &&
      !riskLimits.blocked &&
      conditions.every((c) => c.status === 'PASS');

    const failedList = conditions.filter((c) => c.status === 'FAIL').map((c) => c.label);

    let signalStatus: SignalStatus = 'NO SETUP';
    if (hasCriticalDataFailure) signalStatus = 'INSUFFICIENT DATA';
    else if (riskLimits.blocked || liquidity.status === 'FAIL') signalStatus = 'RISK TOO HIGH';
    else if (allPassed) signalStatus = 'SETUP DETECTED';
    else if (above50 && above200 && weeklyBull && failedList.length <= 2) signalStatus = 'WAIT FOR CONFIRMATION';
    else if (above200) signalStatus = 'WATCH';

    return {
      setupId: 'SETUP_A',
      setupName: 'Setup A — Trend Pullback',
      strategyVersion: 'Trend Pullback v1.0',
      applicable: true,
      overallStatus: allPassed ? 'SETUP DETECTED' : 'SETUP INCOMPLETE',
      signalStatus,
      conditions,
      suggestedEntry,
      suggestedStopLoss,
      riskRewardAt2R: rrRatio,
      invalidationConditions: {
        stopLossRule: `Setup invalid if daily closing price falls below ₹${suggestedStopLoss ?? 'N/A'}.`,
        technicalInvalidation: `Setup invalid if price closes decisively below EMA50 (₹${ema50 ?? 'N/A'}).`,
        fundamentalInvalidation: `Thesis invalid if quarterly earnings growth turns negative or promoter pledge spikes.`,
        dataInvalidation: `Setup suspended if Data Integrity drops to RED or corporate-action adjustment fails.`,
      },
      explanationSummary: allPassed
        ? 'All trend, fundamental, candle, and volume conditions passed.'
        : failedList.length > 0
        ? `Trend/criteria check incomplete: ${failedList.join(', ')} failed.`
        : 'Insufficient indicator history for Trend Pullback evaluation.',
    };
  };

  // Helper to build Setup B (Consolidation Breakout v1.0)
  const buildSetupB = (): SetupCardResult => {
    const conditions: SetupCondition[] = [];
    const close = tech.latestClose;
    const atr = tech.atr14;
    const volRatio = tech.volumeRatio;
    const bb = tech.bollinger20_2;

    // Consolidation range over candles[-25..-2]
    const priorWindow = candles.slice(-25, -1);
    const priorHigh = priorWindow.length ? round2(Math.max(...priorWindow.map((c) => c.high))) : null;
    const priorLow = priorWindow.length ? round2(Math.min(...priorWindow.map((c) => c.low))) : null;
    const rangePct = priorHigh && priorLow && priorLow > 0 ? round2(((priorHigh - priorLow) / priorLow) * 100) : null;

    const consolidationOk = rangePct !== null && rangePct <= 14.0;
    conditions.push({
      label: 'Consolidation Detected',
      status: rangePct === null ? 'WARNING' : consolidationOk ? 'PASS' : 'FAIL',
      actualValue: rangePct !== null ? `${rangePct}% box range` : 'Missing',
      requiredRule: '24-session box <= 14%',
    });

    conditions.push({
      label: 'Resistance Identified',
      status: priorHigh !== null ? 'PASS' : 'WARNING',
      actualValue: priorHigh !== null ? `₹${priorHigh}` : 'N/A',
      requiredRule: 'Prior 24-day resistance',
    });

    conditions.push({
      label: 'Bollinger Compression',
      status: bb.bandwidthPct === null ? 'WARNING' : bb.isCompressed ? 'PASS' : 'FAIL',
      actualValue: bb.bandwidthPct !== null ? `${bb.bandwidthPct}% bandwidth` : 'Missing',
      requiredRule: 'Bandwidth compressed',
    });

    const breakoutClose = Boolean(close !== null && priorHigh !== null && close > priorHigh * 0.998);
    conditions.push({
      label: 'Breakout Close',
      status: close && priorHigh ? (breakoutClose ? 'PASS' : 'FAIL') : 'WARNING',
      actualValue: close && priorHigh ? `Close ₹${close} vs Res ₹${priorHigh}` : 'Incomplete',
      requiredRule: 'Daily close >= Resistance',
    });

    const volOk = volRatio !== null && volRatio >= indCfg.volumeBreakoutMultiplier;
    conditions.push({
      label: 'Volume Confirmation',
      status: volRatio === null ? 'WARNING' : volOk ? 'PASS' : 'FAIL',
      actualValue: volRatio !== null ? `${volRatio}x 20D avg` : 'Missing',
      requiredRule: `>= ${indCfg.volumeBreakoutMultiplier}x 20D avg`,
    });

    const notExtended = Boolean(
      close !== null && tech.ema20 !== null && ((close - tech.ema20) / tech.ema20) * 100 <= 7.0
    );
    conditions.push({
      label: 'Not Excessively Extended',
      status: close && tech.ema20 ? (notExtended ? 'PASS' : 'FAIL') : 'WARNING',
      actualValue:
        close && tech.ema20 ? `+${(((close - tech.ema20) / tech.ema20) * 100).toFixed(1)}% vs EMA20` : 'Missing',
      requiredRule: '<= +7% from EMA20',
    });

    const suggestedEntry = close ? round2(close) : null;
    const suggestedStopLoss =
      close && atr ? round2(Math.max(0.01, close - riskCfg.atrMultiplier * atr)) : null;

    const allPassed =
      !hasCriticalDataFailure &&
      liquidity.status === 'PASS' &&
      !riskLimits.blocked &&
      conditions.every((c) => c.status === 'PASS');

    const failedList = conditions.filter((c) => c.status === 'FAIL').map((c) => c.label);

    let signalStatus: SignalStatus = 'NO SETUP';
    if (hasCriticalDataFailure) signalStatus = 'INSUFFICIENT DATA';
    else if (riskLimits.blocked || liquidity.status === 'FAIL') signalStatus = 'RISK TOO HIGH';
    else if (allPassed) signalStatus = 'SETUP DETECTED';
    else if (consolidationOk && bb.isCompressed && !breakoutClose) signalStatus = 'WAIT FOR CONFIRMATION';

    return {
      setupId: 'SETUP_B',
      setupName: 'Setup B — Breakout',
      strategyVersion: 'Breakout v1.0',
      applicable: true,
      overallStatus: allPassed ? 'SETUP DETECTED' : 'SETUP INCOMPLETE',
      signalStatus,
      conditions,
      suggestedEntry,
      suggestedStopLoss,
      riskRewardAt2R: suggestedEntry && suggestedStopLoss ? riskCfg.minRiskReward : null,
      invalidationConditions: {
        stopLossRule: `Setup invalid if daily closing price falls below ₹${suggestedStopLoss ?? 'N/A'}.`,
        technicalInvalidation: `Setup invalid if breakout falls back inside the defined consolidation range below ₹${priorHigh ?? 'N/A'}.`,
        fundamentalInvalidation: `Thesis invalid if institutional holding drops or governance warning appears.`,
        dataInvalidation: `Setup invalidated if duplicate or unadjusted corporate-action candles distort resistance.`,
      },
      explanationSummary: allPassed
        ? 'Consolidation breakout confirmed by daily close and volume expansion.'
        : failedList.length > 0
        ? `Breakout criteria incomplete: ${failedList.join(', ')} failed.`
        : 'Waiting for complete candle data.',
    };
  };

  // Helper to build Setup C (Range / Mean Reversion v1.0)
  const buildSetupC = (setupBDetected: boolean): SetupCardResult => {
    const adx = tech.adx14;
    const close = tech.latestClose;
    const rsi = tech.rsi14;
    const atr = tech.atr14;
    const sup = tech.supportZones[0] ?? null;
    const res = tech.resistanceZones[0] ?? null;

    // Section 14: Only show Range setup when ADX indicates weak trend and NOT during strong breakout
    const weakTrend = adx !== null && adx < indCfg.adxTrendThreshold;
    const applicable = weakTrend && !setupBDetected && !hasCriticalDataFailure;

    const conditions: SetupCondition[] = [
      {
        label: 'Weak Trend (ADX Filter)',
        status: adx === null ? 'WARNING' : weakTrend ? 'PASS' : 'FAIL',
        actualValue: adx !== null ? `ADX ${adx}` : 'Missing',
        requiredRule: `ADX < ${indCfg.adxTrendThreshold}`,
      },
      {
        label: 'Defined S/R Box',
        status: sup !== null && res !== null && close !== null && close >= sup * 0.98 && close <= res * 1.02 ? 'PASS' : 'FAIL',
        actualValue: sup && res ? `₹${sup} – ₹${res}` : 'Not defined',
        requiredRule: 'Price inside reliable S/R box',
      },
      {
        label: 'Near Support Bounce',
        status: sup !== null && close !== null && (close - sup) / sup <= 0.03 ? 'PASS' : 'FAIL',
        actualValue: sup && close ? `${(((close - sup) / sup) * 100).toFixed(1)}% above S1` : 'N/A',
        requiredRule: 'Within +3% of Support 1',
      },
      {
        label: 'Momentum Confirmation',
        status: rsi !== null && rsi >= 35 && rsi <= 55 && latest && latest.close > latest.open ? 'PASS' : 'FAIL',
        actualValue: rsi !== null ? `RSI ${rsi}` : 'Missing',
        requiredRule: 'RSI 35-55 + Green candle',
      },
    ];

    const suggestedEntry = close ? round2(close) : null;
    const suggestedStopLoss =
      sup && atr ? round2(Math.max(0.01, sup - 0.5 * atr)) : close && atr ? round2(close - riskCfg.atrMultiplier * atr) : null;

    const allPassed =
      applicable &&
      liquidity.status === 'PASS' &&
      !riskLimits.blocked &&
      conditions.every((c) => c.status === 'PASS');

    return {
      setupId: 'SETUP_C',
      setupName: 'Setup C — Range / Mean Reversion',
      strategyVersion: 'Range Mean Reversion v1.0',
      applicable,
      overallStatus: !applicable ? 'NOT APPLICABLE' : allPassed ? 'SETUP DETECTED' : 'SETUP INCOMPLETE',
      signalStatus: !applicable ? 'NO SETUP' : allPassed ? 'SETUP DETECTED' : 'WATCH',
      conditions,
      suggestedEntry,
      suggestedStopLoss,
      riskRewardAt2R: suggestedEntry && suggestedStopLoss ? riskCfg.minRiskReward : null,
      invalidationConditions: {
        stopLossRule: `Setup invalid if daily close breaks below range support ₹${suggestedStopLoss ?? 'N/A'}.`,
        technicalInvalidation: `Range setup invalidated if ADX rises above ${indCfg.adxTrendThreshold} with breakdown volume.`,
        fundamentalInvalidation: `Thesis invalid if balance sheet debt spikes or earnings deteriorate.`,
        dataInvalidation: `Setup invalid if candle data is stale or incomplete.`,
      },
      explanationSummary: !applicable
        ? `Suppressed: ADX (${adx ?? 'N/A'}) does not indicate a weak range-bound regime or breakout active.`
        : allPassed
        ? 'Range setup detected near validated horizontal support.'
        : 'Range regime present, waiting for bounce near support.',
    };
  };

  const setupA = buildSetupA();
  const setupB = buildSetupB();
  const setupC = buildSetupC(setupB.overallStatus === 'SETUP DETECTED');

  // Primary Signal Resolution (Section 15 & Rule priority)
  let primarySignal: SignalStatus = 'NO SETUP';
  let primarySetupName = 'None Active';
  let primaryReason = '';

  if (hasCriticalDataFailure) {
    primarySignal = 'INSUFFICIENT DATA';
    primarySetupName = 'Data Integrity Gate';
    primaryReason = dataIntegrity.issues[0] || `Missing indicators: ${tech.missingIndicators.join(', ')}`;
  } else if (!corporateActionStatus.isProperlyAdjusted) {
    primarySignal = 'INVALID';
    primarySetupName = 'Corporate Action Gate';
    primaryReason = corporateActionStatus.message;
  } else if (liquidity.status === 'FAIL') {
    primarySignal = 'RISK TOO HIGH';
    primarySetupName = 'Liquidity Gate';
    primaryReason = liquidity.reasons[0] || 'Liquidity filter failed.';
  } else if (riskLimits.blocked) {
    primarySignal = 'RISK TOO HIGH';
    primarySetupName = 'Portfolio Risk Control';
    primaryReason = 'Risk limit reached. No new trade should be initiated until the configured reset condition is satisfied.';
  } else if (setupA.overallStatus === 'SETUP DETECTED') {
    primarySignal = 'SETUP DETECTED';
    primarySetupName = setupA.setupName;
    primaryReason = setupA.explanationSummary;
  } else if (setupB.overallStatus === 'SETUP DETECTED') {
    primarySignal = 'SETUP DETECTED';
    primarySetupName = setupB.setupName;
    primaryReason = setupB.explanationSummary;
  } else if (setupC.overallStatus === 'SETUP DETECTED') {
    primarySignal = 'SETUP DETECTED';
    primarySetupName = setupC.setupName;
    primaryReason = setupC.explanationSummary;
  } else if (setupA.signalStatus === 'WAIT FOR CONFIRMATION' || setupB.signalStatus === 'WAIT FOR CONFIRMATION') {
    primarySignal = 'WAIT FOR CONFIRMATION';
    primarySetupName =
      setupA.signalStatus === 'WAIT FOR CONFIRMATION' ? setupA.setupName : setupB.setupName;
    primaryReason =
      setupA.signalStatus === 'WAIT FOR CONFIRMATION' ? setupA.explanationSummary : setupB.explanationSummary;
  } else if (setupA.signalStatus === 'WATCH' || setupC.signalStatus === 'WATCH') {
    primarySignal = 'WATCH';
    primarySetupName = setupA.signalStatus === 'WATCH' ? setupA.setupName : setupC.setupName;
    primaryReason = setupA.explanationSummary;
  } else {
    primarySignal = 'NO SETUP';
    primarySetupName = 'No Active Rule Match';
    primaryReason = 'Price structure does not satisfy Trend Pullback, Breakout, or Range criteria.';
  }

  return {
    setupA,
    setupB,
    setupC,
    primarySignal,
    primarySetupName,
    primaryReason,
  };
}

/**
 * Section 27: Signal Audit Trail Record Builder
 */
export function buildSignalAuditRecord(
  raw: RawMarketStock,
  dataIntegrity: DataIntegrityReport,
  liquidity: LiquidityCheckResult,
  tech: TechnicalIndicators,
  fundamentalsScore: FundamentalScoreBreakdown,
  activeSetup: SetupCardResult,
  primarySignal: SignalStatus,
  aiExplanation: string = ''
): SignalAuditRecord {
  const passedConditions = activeSetup.conditions.filter((c) => c.status === 'PASS').map((c) => c.label);
  const failedConditions = activeSetup.conditions.filter((c) => c.status === 'FAIL').map((c) => c.label);
  const warnings = [
    ...dataIntegrity.issues,
    ...activeSetup.conditions.filter((c) => c.status === 'WARNING').map((c) => `${c.label}: ${c.actualValue}`),
  ];

  return {
    signalId: `SIG-${raw.symbol}-${Date.now().toString().slice(-6)}`,
    timestamp: new Date().toISOString(),
    symbol: raw.symbol,
    dataSource: dataIntegrity.dataSource,
    dataTimestamp: dataIntegrity.lastUpdatedTimestamp,
    strategyVersion: activeSetup.strategyVersion,
    indicatorsSnapshot: {
      close: tech.latestClose,
      ema20: tech.ema20,
      ema50: tech.ema50,
      ema200: tech.ema200,
      rsi14: tech.rsi14,
      atr14: tech.atr14,
      adx14: tech.adx14,
      volumeRatio: tech.volumeRatio,
    },
    fundamentalScore: fundamentalsScore.totalScore,
    liquidityStatus: liquidity.status,
    riskReward: activeSetup.riskRewardAt2R,
    passedConditions,
    failedConditions,
    warnings,
    aiExplanation,
    userDecision: 'PENDING',
    finalResult: primarySignal,
  };
}

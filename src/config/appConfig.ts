import { AppSettings, StrategyVersion } from '../types/trading';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  tradingStyle: 'Swing',
  preferredSectors: ['Banking & Financials', 'Information Technology', 'Defence & Aerospace', 'Power & Energy'],
  excludedSectors: [],
  aiModelName: 'gemini-4-hydrogen',
  risk: {
    capital: 100000,
    maxRiskPerTradePct: 1.0,
    maxDailyLossPct: 2.0,
    maxWeeklyLossPct: 5.0,
    maxOpenPositions: 4,
    maxSectorExposurePct: 30,
    maxPortfolioExposurePct: 80,
    maxSingleStockExposurePct: 25,
    minRiskReward: 2.0,
    atrMultiplier: 1.5,
  },
  liquidity: {
    minTradingDays: 200,
    minAvgDailyTradedValueCr: 15, // ₹15 Cr minimum average daily turnover
    minAvgVolume: 100000,
    minPrice: 50, // Avoid illiquid penny stocks under ₹50
    maxSpreadPct: 0.5,
    smallcapMinAvgDailyTradedValueCr: 25, // Stricter ₹25 Cr turnover threshold for Small Cap stocks
    smallcapMinAvgVolume: 200000, // Stricter 2L min avg volume for Small Cap stocks
    smallcapMinPrice: 75, // Stricter ₹75 min price for Small Cap stocks
  },
  indicators: {
    emaFast: 20,
    emaMedium: 50,
    emaSlow: 200,
    rsiPeriod: 14,
    rsiPullbackMin: 45,
    rsiOverbought: 75,
    minFundamentalScore: 60,
    volumeBreakoutMultiplier: 1.35,
    adxTrendThreshold: 20,
  },
};

export const STRATEGY_VERSIONS: StrategyVersion[] = [
  {
    id: 'SETUP_A',
    name: 'Trend Pullback',
    version: 'Trend Pullback v1.0',
    dateCreated: '2026-11-01',
    rulesSummary:
      'Fundamental Score >= threshold, Weekly & Daily bullish above EMA50/EMA200, pullback near EMA20/EMA50, bullish confirmation candle, volume confirmation, R:R >= minRiskReward.',
    parameters: {
      emaFast: 20,
      emaMedium: 50,
      emaSlow: 200,
      rsiMin: 45,
      minRR: 2.0,
    },
    notes: 'Core NSE/BSE liquid large/mid-cap swing strategy.',
  },
  {
    id: 'SETUP_B',
    name: 'Consolidation Breakout',
    version: 'Breakout v1.0',
    dateCreated: '2026-11-01',
    rulesSummary:
      'Multi-session consolidation detected, clear resistance level, Bollinger compression, daily close above resistance with volume confirmation, not overextended, R:R >= minRiskReward.',
    parameters: {
      bbPeriod: 20,
      bbStdDev: 2,
      volumeMultiplier: 1.35,
      minRR: 2.0,
    },
    notes: 'Requires closing confirmation; intraday spikes are rejected.',
  },
  {
    id: 'SETUP_C',
    name: 'Range / Mean Reversion',
    version: 'Range Mean Reversion v1.0',
    dateCreated: '2026-11-01',
    rulesSummary:
      'Only active when ADX < 20 (weak trend), price inside defined horizontal support/resistance box, bounce confirmation off support with oversold/neutral RSI.',
    parameters: {
      adxMax: 20,
      rsiRangeLow: 35,
      minRR: 2.0,
    },
    notes: 'Suppressed during strong directional breakouts.',
  },
];

export const COMPLIANCE_NOTICES = [
  'Educational research tool only.',
  'Not investment advice.',
  'Markets involve risk of loss.',
  'Use SEBI-registered brokers.',
];

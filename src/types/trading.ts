export type Exchange = 'NSE' | 'BSE';
export type MarketCapCategory = 'Large Cap' | 'Mid Cap' | 'Small Cap';
export type DataSourceType = 'DemoDataProvider' | 'CSVDataProvider' | 'YahooPrototypeProvider' | 'BrokerAPIProvider';
export type DataIntegrityStatus = 'GREEN' | 'YELLOW' | 'RED';
export type PassFailWarn = 'PASS' | 'FAIL' | 'WARNING';
export type UniverseBucket = 'NIFTY 50' | 'NIFTY MIDCAP 150' | 'NIFTY SMALLCAP 250' | 'CUSTOM';

// Strictly forbidden in SignalStatus: BUY, SELL, STRONG BUY, TARGET
export type SignalStatus =
  | 'SETUP DETECTED'
  | 'WATCH'
  | 'NO SETUP'
  | 'INVALID'
  | 'INSUFFICIENT DATA'
  | 'RISK TOO HIGH'
  | 'WAIT FOR CONFIRMATION';

export interface OHLCVCandle {
  timestamp: string; // ISO date YYYY-MM-DD or YYYY-MM-DDTHH:mm
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CorporateActionRecord {
  date: string;
  type: 'Stock Split' | 'Bonus' | 'Dividend' | 'Rights Issue' | 'Symbol Change' | 'Merger/Demerger';
  details: string;
  adjusted: boolean;
}

export interface CorporateActionStatus {
  hasActions: boolean;
  isProperlyAdjusted: boolean;
  statusLabel: 'VERIFIED_ADJUSTED' | 'UNVERIFIED_WARNING' | 'NO_ACTIONS';
  message: string;
  actions: CorporateActionRecord[];
}

export interface DataSourceMetadata {
  providerName: DataSourceType;
  displayLabel: string;
  status: 'DEMO' | 'DELAYED' | 'IMPORTED' | 'DISCONNECTED';
  lastUpdated: string;
  dataDelay: string;
  isLiveExecutionSuitable: false;
  bannerText: string;
}

export interface DataIntegrityReport {
  symbol: string;
  exchange: Exchange;
  companyName: string;
  dataSource: DataSourceType;
  lastUpdatedTimestamp: string;
  dataInterval: '1D' | '1H' | '15m';
  numberOfCandles: number;
  missingCandles: number;
  duplicateCandles: number;
  ohlcConsistent: boolean;
  ohlcErrors: number;
  corporateActionAdjusted: boolean;
  activeSymbol: boolean;
  dataFreshness: 'FRESH' | 'DELAYED' | 'STALE';
  dataQualityScore: number; // 0 - 100
  status: DataIntegrityStatus;
  issues: string[];
}

export interface LiquidityCheckResult {
  status: PassFailWarn;
  tradingDays: number;
  avgDailyTradedValueCr: number; // in ₹ Crores
  avgVolume: number;
  currentPrice: number;
  estimatedSpreadPct: number | null;
  ruleProfile?: 'STANDARD' | 'STRICT_SMALLCAP';
  strictModeApplied?: boolean;
  reasons: string[];
}

export interface FundamentalInput {
  salesGrowthYoY: number | null; // %
  profitGrowthYoY: number | null; // %
  roe: number | null; // %
  roce: number | null; // %
  operatingMargin: number | null; // %
  netMargin: number | null; // %
  debtToEquity: number | null;
  interestCoverage: number | null;
  operatingCashFlowCr: number | null;
  pe: number | null;
  sectorPe: number | null;
  pb: number | null;
  evEbitda: number | null;
  promoterHolding: number | null; // %
  promoterPledge: number | null; // %
  fiiDiiTrend: 'Accumulating' | 'Stable' | 'Distributing' | null;
  governanceWarnings: string[];
}

export interface FundamentalScoreBreakdown {
  totalScore: number; // 0 - 100
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  missingFields: string[];
  components: {
    growth: { score: number; max: 25; details: string };
    profitability: { score: number; max: 25; details: string };
    balanceSheet: { score: number; max: 20; details: string };
    valuation: { score: number; max: 15; details: string };
    ownershipGovernance: { score: number; max: 15; details: string };
  };
}

export interface TechnicalIndicators {
  latestClose: number | null;
  prevClose: number | null;
  pctChange: number | null;
  latestVolume: number | null;
  avgVolume20: number | null;
  volumeRatio: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  ema20Series: (number | null)[];
  ema50Series: (number | null)[];
  ema200Series: (number | null)[];
  rsi14: number | null;
  rsiSeries: (number | null)[];
  macd: {
    line: number | null;
    signal: number | null;
    histogram: number | null;
    series: { line: number | null; signal: number | null; hist: number | null }[];
  };
  bollinger20_2: {
    upper: number | null;
    middle: number | null;
    lower: number | null;
    bandwidthPct: number | null;
    isCompressed: boolean;
  };
  atr14: number | null;
  adx14: number | null;
  vwap: number | null;
  fibonacci: {
    swingHigh: number;
    swingLow: number;
    retracement382: number;
    retracement500: number;
    retracement618: number;
  } | null;
  supportZones: number[];
  resistanceZones: number[];
  calculationComplete: boolean;
  missingIndicators: string[];
}

export interface MultiTimeframeAnalysis {
  weeklyTrend: 'Bullish' | 'Bearish' | 'Sideways' | 'Insufficient Data';
  dailyTrend: 'Bullish' | 'Bearish' | 'Sideways' | 'Insufficient Data';
  entryTimeframe: string;
  entryStatus: string;
  alignment: PassFailWarn;
  intradayAvailable: boolean;
}

export interface SetupCondition {
  label: string;
  status: PassFailWarn;
  actualValue: string;
  requiredRule: string;
}

export interface SetupCardResult {
  setupId: 'SETUP_A' | 'SETUP_B' | 'SETUP_C';
  setupName: string;
  strategyVersion: string;
  applicable: boolean;
  overallStatus: 'SETUP DETECTED' | 'SETUP INCOMPLETE' | 'NOT APPLICABLE';
  signalStatus: SignalStatus;
  conditions: SetupCondition[];
  suggestedEntry: number | null;
  suggestedStopLoss: number | null;
  riskRewardAt2R: number | null;
  invalidationConditions: {
    stopLossRule: string;
    technicalInvalidation: string;
    fundamentalInvalidation: string;
    dataInvalidation: string;
  };
  explanationSummary: string;
}

export interface RawMarketStock {
  symbol: string;
  exchange: Exchange;
  companyName: string;
  sector: string;
  marketCapCategory: MarketCapCategory;
  universeBuckets?: UniverseBucket[];
  activeSymbol: boolean;
  dataInterval: '1D' | '1H' | '15m';
  lastUpdatedTimestamp: string;
  estimatedSpreadPct: number | null;
  candles: OHLCVCandle[];
  intradayCandles?: OHLCVCandle[];
  corporateActions: CorporateActionRecord[];
  corporateActionsVerified: boolean;
  fundamentals: FundamentalInput;
  isDemoData: boolean;
}

export interface AnalyzedStock {
  raw: RawMarketStock;
  dataIntegrity: DataIntegrityReport;
  corporateActionStatus: CorporateActionStatus;
  liquidity: LiquidityCheckResult;
  technicals: TechnicalIndicators;
  mtf: MultiTimeframeAnalysis;
  fundamentalsScore: FundamentalScoreBreakdown;
  setupA: SetupCardResult;
  setupB: SetupCardResult;
  setupC: SetupCardResult;
  primarySignal: SignalStatus;
  primarySetupName: string;
  primaryReason: string;
}

export interface RiskConfig {
  capital: number;
  maxRiskPerTradePct: number;
  maxDailyLossPct: number;
  maxWeeklyLossPct: number;
  maxOpenPositions: number;
  maxSectorExposurePct: number;
  maxPortfolioExposurePct: number;
  maxSingleStockExposurePct: number;
  minRiskReward: number;
  atrMultiplier: number;
}

export interface LiquidityConfig {
  minTradingDays: number;
  minAvgDailyTradedValueCr: number;
  minAvgVolume: number;
  minPrice: number;
  maxSpreadPct: number;
  smallcapMinAvgDailyTradedValueCr: number;
  smallcapMinAvgVolume: number;
  smallcapMinPrice: number;
}

export interface IndicatorConfig {
  emaFast: number;
  emaMedium: number;
  emaSlow: number;
  rsiPeriod: number;
  rsiPullbackMin: number;
  rsiOverbought: number;
  minFundamentalScore: number;
  volumeBreakoutMultiplier: number;
  adxTrendThreshold: number;
}

export interface StrategyVersion {
  id: string;
  name: string;
  version: string;
  dateCreated: string;
  rulesSummary: string;
  parameters: Record<string, number | string>;
  notes: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  tradingStyle: 'Swing' | 'Positional';
  preferredSectors: string[];
  excludedSectors: string[];
  aiModelName: string;
  risk: RiskConfig;
  liquidity: LiquidityConfig;
  indicators: IndicatorConfig;
}

export interface RiskCalculationResult {
  valid: boolean;
  error?: string;
  riskAmount: number;
  riskPerShare: number;
  quantity: number;
  positionValue: number;
  oneRPrice: number;
  twoRPrice: number;
  threeRPrice: number;
  maxPlannedLoss: number;
  estimatedCharges: number;
  totalCapitalPct: number;
  exceedsSingleStockLimit: boolean;
}

export interface RiskLimitState {
  blocked: boolean;
  reasons: string[];
  dailyLossUsedPct: number;
  weeklyLossUsedPct: number;
  openPositionsCount: number;
  portfolioExposurePct: number;
}

export interface PaperPosition {
  id: string;
  symbol: string;
  exchange: Exchange;
  setupName: string;
  entryDate: string;
  entryPrice: number;
  stopLoss: number;
  quantity: number;
  charges: number;
  status: 'OPEN' | 'CLOSED_SL' | 'CLOSED_MANUAL';
  exitPrice?: number;
  exitDate?: string;
  realizedPnl?: number;
  invalidationCondition: string;
}

export interface TradeJournalEntry {
  tradeId: string;
  date: string;
  symbol: string;
  exchange: Exchange;
  setup: string;
  timeframe: string;
  marketCondition: string;
  fundamentalScore: number;
  technicalStatus: string;
  entry: number;
  stopLoss: number;
  plannedR: number;
  quantity: number;
  riskAmount: number;
  exit: number | null;
  grossPnl: number | null;
  charges: number;
  netPnl: number | null;
  holdingPeriodDays: number | null;
  entryReason: string;
  exitReason: string;
  mistake: string;
  emotion: 'Calm' | 'Disciplined' | 'FOMO' | 'Fear' | 'Revenge' | 'Overconfident';
  ruleFollowed: boolean;
  screenshotRef: string;
  notes: string;
  aiReview: string;
}

export interface PerformanceMetrics {
  totalTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  avgWinRs: number;
  avgLossRs: number;
  avgWinR: number;
  avgLossR: number;
  profitFactor: number;
  expectancyRs: number;
  expectancyR: number;
  averageR: number;
  maxDrawdownRs: number;
  maxDrawdownPct: number;
  largestWinRs: number;
  largestLossRs: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  monthlyPnl: { month: string; netPnl: number; trades: number }[];
  setupWise: { setup: string; trades: number; winRate: number; netPnl: number }[];
  sectorWise: { sector: string; trades: number; netPnl: number }[];
  equityCurve: { tradeIndex: number; date: string; equity: number }[];
}

export interface BacktestConfig {
  symbol: string;
  strategyId: 'SETUP_A' | 'SETUP_B' | 'SETUP_C';
  strategyVersion: string;
  capital: number;
  riskPerTradePct: number;
  slippagePct: number;
  outOfSampleSplitPct: number; // e.g., 70% in-sample, 30% out-of-sample
  dataVersion: string;
}

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  quantity: number;
  grossPnl: number;
  chargesAndSlippage: number;
  netPnl: number;
  rMultiple: number;
  sampleSegment: 'IN_SAMPLE' | 'OUT_OF_SAMPLE';
  exitReason: 'STOP_LOSS' | 'TARGET_2R' | 'TRAILING_EMA20' | 'END_OF_SERIES';
}

export interface BacktestResult {
  config: BacktestConfig;
  totalCandlesTested: number;
  trades: BacktestTrade[];
  metrics: {
    totalTrades: number;
    winRatePct: number;
    profitFactor: number;
    expectancyR: number;
    maxDrawdownPct: number;
    netPnlRs: number;
    finalEquityRs: number;
    inSampleTrades: number;
    inSampleExpectancyR: number;
    outOfSampleTrades: number;
    outOfSampleExpectancyR: number;
  };
  equityCurve: { date: string; equity: number; segment: 'IN_SAMPLE' | 'OUT_OF_SAMPLE' }[];
  lookAheadVerification: string;
}

export interface SignalAuditRecord {
  signalId: string;
  timestamp: string;
  symbol: string;
  dataSource: DataSourceType;
  dataTimestamp: string;
  strategyVersion: string;
  indicatorsSnapshot: {
    close: number | null;
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
    rsi14: number | null;
    atr14: number | null;
    adx14: number | null;
    volumeRatio: number | null;
  };
  fundamentalScore: number;
  liquidityStatus: PassFailWarn;
  riskReward: number | null;
  passedConditions: string[];
  failedConditions: string[];
  warnings: string[];
  aiExplanation: string;
  userDecision: 'PENDING' | 'PAPER_ENTERED' | 'WATCHLISTED' | 'SKIPPED';
  finalResult: SignalStatus;
}

export interface QualityCheckTestResult {
  id: number;
  name: string;
  input: string;
  expectedResult: string;
  actualResult: string;
  status: 'PASS' | 'FAIL';
}

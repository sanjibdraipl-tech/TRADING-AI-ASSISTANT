import React, { useEffect, useMemo, useState } from 'react';
import {
  AnalyzedStock,
  AppSettings,
  DataSourceMetadata,
  DataSourceType,
  PaperPosition,
  RawMarketStock,
  SetupCardResult,
  SignalAuditRecord,
  StrategyVersion,
  TradeJournalEntry,
  UniverseBucket,
} from './types/trading';
import {
  DEFAULT_150_UNIVERSE,
  UniverseConstituentSpec,
} from './data/indianUniverseRegistry';
import {
  COMPLIANCE_NOTICES,
  DEFAULT_APP_SETTINGS,
  STRATEGY_VERSIONS,
} from './config/appConfig';
import {
  BrokerAPIProvider,
  CSVDataProvider,
  DemoDataProvider,
  YahooPrototypeProvider,
} from './data/providers/MarketDataProvider';
import { evaluateCorporateActions, evaluateDataIntegrity } from './engines/dataIntegrityEngine';
import { evaluateLiquidityFilter } from './engines/liquidityEngine';
import { calculateTechnicalIndicators, evaluateMultiTimeframe } from './engines/indicatorEngine';
import { evaluateFundamentalScore } from './engines/fundamentalEngine';
import { estimateTransactionCharges, evaluateRiskControls } from './engines/riskEngine';
import { buildSignalAuditRecord, evaluateStockSetups } from './engines/setupEngine';

import { HomeDashboardView } from './components/HomeDashboardView';
import { WatchlistView } from './components/WatchlistView';
import { StockAnalysisStudio } from './components/StockAnalysisStudio';
import { ScreenerView } from './components/ScreenerView';
import { RiskCalculatorView } from './components/RiskCalculatorView';
import { PaperTradingView } from './components/PaperTradingView';
import { TradeJournalView } from './components/TradeJournalView';
import { PerformanceDashboardView } from './components/PerformanceDashboardView';
import { BacktestView } from './components/BacktestView';
import { AiAnalystView } from './components/AiAnalystView';
import { SettingsAndAuditView } from './components/SettingsAndAuditView';
import { VoiceAssistantView } from './components/VoiceAssistantView';
import { Bot, Mic, Moon, ShieldAlert, Sun } from 'lucide-react';

const NAV_TABS = [
  'HOME',
  'VOICE ASSISTANT',
  'WATCHLIST',
  'STOCK ANALYSIS',
  'SCREENER',
  'FUNDAMENTALS',
  'TECHNICALS',
  'SETUP ENGINE',
  'RISK CALCULATOR',
  'PAPER TRADING',
  'TRADE JOURNAL',
  'PERFORMANCE',
  'BACKTEST',
  'AI ANALYST',
  'SETTINGS',
] as const;

type NavTab = (typeof NAV_TABS)[number];

const INITIAL_SAMPLE_JOURNAL: TradeJournalEntry[] = [
  {
    tradeId: 'TRD-1001',
    date: '2026-09-18',
    symbol: 'ICICIBANK',
    exchange: 'NSE',
    setup: 'Setup A — Trend Pullback',
    timeframe: '1D',
    marketCondition: 'Bullish Above EMA50',
    fundamentalScore: 84,
    technicalStatus: 'PASS',
    entry: 1220,
    stopLoss: 1185,
    plannedR: 2,
    quantity: 28,
    riskAmount: 980,
    exit: 1290,
    grossPnl: 1960,
    charges: 81.4,
    netPnl: 1878.6,
    holdingPeriodDays: 9,
    entryReason: 'Pullback to EMA20 with 1.4x volume confirmation',
    exitReason: '2R milestone reached at resistance zone',
    mistake: 'None',
    emotion: 'Disciplined',
    ruleFollowed: true,
    screenshotRef: 'icici-1d-sep18',
    notes: 'Clean alignment across Weekly & Daily charts.',
    aiReview: '',
  },
  {
    tradeId: 'TRD-1002',
    date: '2026-10-02',
    symbol: 'BEL',
    exchange: 'NSE',
    setup: 'Setup B — Breakout',
    timeframe: '1D',
    marketCondition: 'Bullish Defence Sector',
    fundamentalScore: 82,
    technicalStatus: 'PASS',
    entry: 282,
    stopLoss: 270,
    plannedR: 2,
    quantity: 80,
    riskAmount: 960,
    exit: 306,
    grossPnl: 1920,
    charges: 64.2,
    netPnl: 1855.8,
    holdingPeriodDays: 7,
    entryReason: 'Bollinger squeeze daily close breakout with 1.8x volume',
    exitReason: 'Scaled out at 2R structural level',
    mistake: 'None',
    emotion: 'Calm',
    ruleFollowed: true,
    screenshotRef: 'bel-1d-oct02',
    notes: 'Followed stop-loss discipline throughout consolidation.',
    aiReview: '',
  },
  {
    tradeId: 'TRD-1003',
    date: '2026-10-16',
    symbol: 'TCS',
    exchange: 'NSE',
    setup: 'Setup C — Range / Mean Reversion',
    timeframe: '1D',
    marketCondition: 'Sideways ADX < 20',
    fundamentalScore: 85,
    technicalStatus: 'PASS',
    entry: 4040,
    stopLoss: 3960,
    plannedR: 2,
    quantity: 12,
    riskAmount: 960,
    exit: 3960,
    grossPnl: -960,
    charges: 112.5,
    netPnl: -1072.5,
    holdingPeriodDays: 3,
    entryReason: 'Support bounce near 3980 with RSI 42',
    exitReason: 'Stop-Loss triggered cleanly on weak IT session',
    mistake: 'Entered slightly before closing candle confirmation',
    emotion: 'FOMO',
    ruleFollowed: false,
    screenshotRef: 'tcs-1d-oct16',
    notes: 'Wait for daily close confirmation before entry.',
    aiReview: '',
  },
  {
    tradeId: 'TRD-1004',
    date: '2026-10-29',
    symbol: 'NTPC',
    exchange: 'NSE',
    setup: 'Setup A — Trend Pullback',
    timeframe: '1D',
    marketCondition: 'Bullish Power Utilities',
    fundamentalScore: 76,
    technicalStatus: 'PASS',
    entry: 388,
    stopLoss: 376,
    plannedR: 2,
    quantity: 80,
    riskAmount: 960,
    exit: 412,
    grossPnl: 1920,
    charges: 74.1,
    netPnl: 1845.9,
    holdingPeriodDays: 8,
    entryReason: 'Pullback to rising EMA20 above EMA50 & EMA200',
    exitReason: '2R milestone hit',
    mistake: 'None',
    emotion: 'Disciplined',
    ruleFollowed: true,
    screenshotRef: 'ntpc-1d-oct29',
    notes: 'High liquidity, tight spread.',
    aiReview: '',
  },
];

function loadJsonState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('HOME');
  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = loadJsonState('smart_trader_settings_v2', DEFAULT_APP_SETTINGS);
    return {
      ...DEFAULT_APP_SETTINGS,
      ...loaded,
      risk: { ...DEFAULT_APP_SETTINGS.risk, ...(loaded?.risk || {}) },
      liquidity: { ...DEFAULT_APP_SETTINGS.liquidity, ...(loaded?.liquidity || {}) },
      indicators: { ...DEFAULT_APP_SETTINGS.indicators, ...(loaded?.indicators || {}) },
    };
  });
  const [activeProvider, setActiveProvider] = useState<DataSourceType>('DemoDataProvider');
  const [universeSpecs, setUniverseSpecs] = useState<UniverseConstituentSpec[]>(() =>
    loadJsonState('smart_trader_universe_v2', DEFAULT_150_UNIVERSE)
  );
  const [demoRawStocks, setDemoRawStocks] = useState<RawMarketStock[]>([]);
  const [importedCsvStocks, setImportedCsvStocks] = useState<RawMarketStock[]>(() =>
    loadJsonState('smart_trader_csv_stocks_v2', [])
  );
  const [selectedSymbol, setSelectedSymbol] = useState<string>('RELIANCE');

  const [paperPositions, setPaperPositions] = useState<PaperPosition[]>(() =>
    loadJsonState('smart_trader_paper_v2', [])
  );
  const [journalEntries, setJournalEntries] = useState<TradeJournalEntry[]>(() =>
    loadJsonState('smart_trader_journal_v2', INITIAL_SAMPLE_JOURNAL)
  );
  const [strategyVersions, setStrategyVersions] = useState<StrategyVersion[]>(() =>
    loadJsonState('smart_trader_strategies_v2', STRATEGY_VERSIONS)
  );
  const [signalAuditLog, setSignalAuditLog] = useState<SignalAuditRecord[]>(() =>
    loadJsonState('smart_trader_audit_v2', [])
  );

  const [prefillPaperOrder, setPrefillPaperOrder] = useState<{
    symbol: string;
    setupName: string;
    entryPrice: number;
    stopLoss: number;
    invalidationCondition: string;
  } | null>(null);
  const [aiInitialQuestion, setAiInitialQuestion] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<{
    available: boolean;
    modelName: string;
    message: string;
    supportedModels?: string[];
  }>({
    available: false,
    modelName: settings.aiModelName,
    message: 'Checking Gemini server proxy status...',
  });

  // Sync theme to document root class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    localStorage.setItem('smart_trader_settings_v2', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('smart_trader_paper_v2', JSON.stringify(paperPositions));
  }, [paperPositions]);

  useEffect(() => {
    localStorage.setItem('smart_trader_journal_v2', JSON.stringify(journalEntries));
  }, [journalEntries]);

  useEffect(() => {
    localStorage.setItem('smart_trader_strategies_v2', JSON.stringify(strategyVersions));
  }, [strategyVersions]);

  useEffect(() => {
    localStorage.setItem('smart_trader_audit_v2', JSON.stringify(signalAuditLog));
  }, [signalAuditLog]);

  useEffect(() => {
    localStorage.setItem('smart_trader_csv_stocks_v2', JSON.stringify(importedCsvStocks));
  }, [importedCsvStocks]);

  useEffect(() => {
    localStorage.setItem('smart_trader_universe_v2', JSON.stringify(universeSpecs));
    const demo = new DemoDataProvider(universeSpecs);
    demo.fetchStocks().then((list) => {
      setDemoRawStocks(list);
    });
  }, [universeSpecs]);

  // Load AI availability status on mount
  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((d) => {
        setAiStatus({
          available: Boolean(d.available),
          modelName: d.modelName || settings.aiModelName,
          message: d.message || '',
          supportedModels: Array.isArray(d.supportedModels) ? d.supportedModels : undefined,
        });
      })
      .catch(() => {
        setAiStatus({
          available: false,
          modelName: settings.aiModelName,
          message: 'AI analysis temporarily unavailable. Deterministic technical and risk calculations remain available.',
        });
      });
  }, []);

  const dataSourceMeta: DataSourceMetadata = useMemo(() => {
    if (activeProvider === 'CSVDataProvider') {
      return new CSVDataProvider().getMetadata();
    }
    if (activeProvider === 'YahooPrototypeProvider') {
      return new YahooPrototypeProvider().getMetadata();
    }
    if (activeProvider === 'BrokerAPIProvider') {
      return new BrokerAPIProvider().getMetadata();
    }
    return new DemoDataProvider().getMetadata();
  }, [activeProvider, importedCsvStocks]);

  const activeRawStocks: RawMarketStock[] = useMemo(() => {
    if (activeProvider === 'CSVDataProvider') {
      return importedCsvStocks;
    }
    if (activeProvider === 'YahooPrototypeProvider' || activeProvider === 'BrokerAPIProvider') {
      return [];
    }
    return [...importedCsvStocks, ...demoRawStocks];
  }, [activeProvider, importedCsvStocks, demoRawStocks]);

  // Evaluate Risk Controls Blocker (Section 17)
  const riskLimits = useMemo(
    () =>
      evaluateRiskControls(
        settings.risk,
        journalEntries,
        paperPositions,
        new Date().toISOString().slice(0, 10)
      ),
    [settings.risk, journalEntries, paperPositions]
  );

  // Full Deterministic Pipeline Evaluation for all stocks
  const analyzedStocks: AnalyzedStock[] = useMemo(() => {
    return activeRawStocks.map((raw) => {
      const providerUsed: DataSourceType = raw.isDemoData ? 'DemoDataProvider' : 'CSVDataProvider';
      const dataIntegrity = evaluateDataIntegrity(raw, providerUsed);
      const corporateActionStatus = evaluateCorporateActions(raw);
      const liquidity = evaluateLiquidityFilter(raw, settings.liquidity);
      const technicals = calculateTechnicalIndicators(raw.candles, settings.indicators);
      const mtf = evaluateMultiTimeframe(raw.candles, technicals, raw.intradayCandles);
      const fundamentalsScore = evaluateFundamentalScore(raw.fundamentals);
      const setupResults = evaluateStockSetups(
        raw,
        dataIntegrity,
        corporateActionStatus,
        liquidity,
        technicals,
        mtf,
        fundamentalsScore,
        settings,
        riskLimits
      );

      return {
        raw,
        dataIntegrity,
        corporateActionStatus,
        liquidity,
        technicals,
        mtf,
        fundamentalsScore,
        ...setupResults,
      };
    });
  }, [activeRawStocks, settings, riskLimits]);

  // Seed initial Signal Audit Trail once stocks are analyzed if audit log is empty
  useEffect(() => {
    if (analyzedStocks.length > 0 && signalAuditLog.length === 0) {
      const initialRecords = analyzedStocks.slice(0, 5).map((st) =>
        buildSignalAuditRecord(
          st.raw,
          st.dataIntegrity,
          st.liquidity,
          st.technicals,
          st.fundamentalsScore,
          st.setupA.signalStatus === 'SETUP DETECTED' ? st.setupA : st.setupB,
          st.primarySignal
        )
      );
      setSignalAuditLog(initialRecords);
    }
  }, [analyzedStocks, signalAuditLog.length]);

  const selectedStock = useMemo(() => {
    return analyzedStocks.find((s) => s.raw.symbol === selectedSymbol) || analyzedStocks[0];
  }, [analyzedStocks, selectedSymbol]);

  const handleSelectStockAndAnalyze = (symbol: string) => {
    setSelectedSymbol(symbol);
    setActiveTab('STOCK ANALYSIS');
  };

  const handleSendToPaperTrade = (stock: AnalyzedStock, setup: SetupCardResult) => {
    const entry = setup.suggestedEntry ?? stock.technicals.latestClose ?? 1000;
    const sl = setup.suggestedStopLoss ?? Math.round(entry * 0.97 * 100) / 100;
    setPrefillPaperOrder({
      symbol: stock.raw.symbol,
      setupName: setup.setupName,
      entryPrice: entry,
      stopLoss: sl,
      invalidationCondition: setup.invalidationConditions.stopLossRule,
    });
    const rec = buildSignalAuditRecord(
      stock.raw,
      stock.dataIntegrity,
      stock.liquidity,
      stock.technicals,
      stock.fundamentalsScore,
      setup,
      setup.signalStatus
    );
    rec.userDecision = 'PAPER_ENTERED';
    setSignalAuditLog((prev) => [rec, ...prev].slice(0, 100));
    setActiveTab('PAPER TRADING');
  };

  const handleClosePaperPosition = (
    id: string,
    exitPrice: number,
    closeType: 'CLOSED_SL' | 'CLOSED_MANUAL'
  ) => {
    setPaperPositions((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const totalCharges = estimateTransactionCharges(p.entryPrice, exitPrice, p.quantity, 'delivery');
        const gross = (exitPrice - p.entryPrice) * p.quantity;
        const realizedPnl = Math.round((gross - totalCharges) * 100) / 100;
        return {
          ...p,
          status: closeType,
          exitPrice,
          exitDate: new Date().toISOString().slice(0, 10),
          charges: totalCharges,
          realizedPnl,
        };
      })
    );
  };

  const handleSavePaperToJournal = (pos: PaperPosition, stock?: AnalyzedStock) => {
    const exitPrice = pos.exitPrice ?? pos.entryPrice;
    const grossPnl = Math.round((exitPrice - pos.entryPrice) * pos.quantity * 100) / 100;
    const netPnl = Math.round((grossPnl - pos.charges) * 100) / 100;
    const riskAmount = Math.round(Math.abs(pos.entryPrice - pos.stopLoss) * pos.quantity * 100) / 100;

    const entry: TradeJournalEntry = {
      tradeId: `TRD-${Date.now().toString().slice(-5)}`,
      date: pos.exitDate || pos.entryDate,
      symbol: pos.symbol,
      exchange: pos.exchange,
      setup: pos.setupName,
      timeframe: '1D',
      marketCondition: stock?.mtf.dailyTrend || 'Evaluated',
      fundamentalScore: stock?.fundamentalsScore.totalScore ?? 70,
      technicalStatus: stock?.primarySignal || 'EVALUATED',
      entry: pos.entryPrice,
      stopLoss: pos.stopLoss,
      plannedR: settings.risk.minRiskReward,
      quantity: pos.quantity,
      riskAmount,
      exit: exitPrice,
      grossPnl,
      charges: pos.charges,
      netPnl,
      holdingPeriodDays: 1,
      entryReason: pos.setupName,
      exitReason: pos.status === 'CLOSED_SL' ? 'Stop-Loss simulated' : 'Manual virtual close',
      mistake: 'None',
      emotion: 'Disciplined',
      ruleFollowed: true,
      screenshotRef: 'paper-trade-log',
      notes: pos.invalidationCondition,
      aiReview: '',
    };
    setJournalEntries((prev) => [entry, ...prev]);
  };

  const handleImportParsedCsv = (stock: RawMarketStock) => {
    setImportedCsvStocks((prev) => [stock, ...prev.filter((s) => s.symbol !== stock.symbol)]);
    setSelectedSymbol(stock.symbol);
  };

  const handleImportCsvText = (symbol: string, csvText: string) => {
    try {
      const parsed = CSVDataProvider.parseCsvToStock(csvText, symbol);
      handleImportParsedCsv(parsed);
      setActiveProvider('CSVDataProvider');
    } catch (err) {
      console.error('CSV parse error:', err);
    }
  };

  const studioFocus: 'OVERVIEW' | 'FUNDAMENTALS' | 'TECHNICALS' | 'SETUP ENGINE' =
    activeTab === 'FUNDAMENTALS'
      ? 'FUNDAMENTALS'
      : activeTab === 'TECHNICALS'
      ? 'TECHNICALS'
      : activeTab === 'SETUP ENGINE'
      ? 'SETUP ENGINE'
      : 'OVERVIEW';

  const isStudioTab =
    activeTab === 'STOCK ANALYSIS' ||
    activeTab === 'FUNDAMENTALS' ||
    activeTab === 'TECHNICALS' ||
    activeTab === 'SETUP ENGINE';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Workstation Bar (Section 36) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white font-display font-bold text-sm flex items-center justify-center">
              ST
            </div>
            <div>
              <div className="font-display font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100">
                SMART TRADER AI
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Indian Market Research & Trading Assistant (NSE · BSE)
              </div>
            </div>
          </div>

          {/* Live Workstation Status Indicators */}
          <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono">
            <div className="text-slate-600 dark:text-slate-300">
              DATA: <strong className="text-amber-600 dark:text-amber-400">{dataSourceMeta.status}</strong> · {dataSourceMeta.lastUpdated}
            </div>
            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
              <Bot className={`w-3.5 h-3.5 ${aiStatus.available ? 'text-emerald-500' : 'text-amber-500'}`} />
              AI: {aiStatus.available ? `READY (${aiStatus.modelName})` : 'UNAVAILABLE (MATH ACTIVE)'}
            </div>
            <div
              className={`flex items-center gap-1 font-semibold ${
                riskLimits.blocked ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {riskLimits.blocked && <ShieldAlert className="w-3.5 h-3.5" />}
              RISK: {riskLimits.blocked ? 'BLOCKED' : 'WITHIN LIMITS'}
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('VOICE ASSISTANT')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                activeTab === 'VOICE ASSISTANT'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
              }`}
              title="Open Real-Time Bilingual Voice Assistant"
            >
              <Mic className="w-3.5 h-3.5" />
              Voice AI (বাংলা/EN)
            </button>
            <button
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  theme: prev.theme === 'dark' ? 'light' : 'dark',
                }))
              }
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              title="Toggle Dark / Light theme"
            >
              {settings.theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
          </div>
        </div>

        {/* Section 35 Complete Navigation Bar */}
        <nav className="border-t border-slate-200 dark:border-slate-800/80 bg-slate-100/70 dark:bg-slate-900/70">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 overflow-x-auto py-1.5">
            {NAV_TABS.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-semibold tracking-wide whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {analyzedStocks.length === 0 &&
          (activeTab === 'HOME' || activeTab === 'WATCHLIST' || isStudioTab || activeTab === 'SCREENER') ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 p-6 text-center space-y-3 text-xs">
            <div className="font-bold text-sm text-amber-900 dark:text-amber-100">
              No Market Data Loaded for Active Provider ({activeProvider})
            </div>
            <p className="text-amber-800 dark:text-amber-200 max-w-xl mx-auto">
              {dataSourceMeta.bannerText} Switch back to <strong>DemoDataProvider</strong> or upload an NSE/BSE OHLCV CSV file in Settings to resume deterministic analysis.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setActiveProvider('DemoDataProvider')}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
              >
                Use DemoDataProvider
              </button>
              <button
                onClick={() => setActiveTab('SETTINGS')}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Open Data & CSV Settings
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'HOME' && (
              <HomeDashboardView
                stocks={analyzedStocks}
                dataSourceMeta={dataSourceMeta}
                riskLimits={riskLimits}
                paperPositions={paperPositions}
                journalEntries={journalEntries}
                aiStatus={aiStatus}
                onSelectStock={handleSelectStockAndAnalyze}
                onNavigate={(tab) => setActiveTab(tab as NavTab)}
              />
            )}

            {activeTab === 'VOICE ASSISTANT' && (
              <VoiceAssistantView
                stocks={analyzedStocks}
                dataSourceMeta={dataSourceMeta}
                settings={settings}
                aiStatus={aiStatus}
                onNavigateTab={(tab) => setActiveTab(tab as NavTab)}
                onSelectStock={(symbol) => setSelectedSymbol(symbol)}
                onToggleTheme={(mode) => setSettings((prev) => ({ ...prev, theme: mode }))}
              />
            )}

            {activeTab === 'WATCHLIST' && (
              <WatchlistView
                stocks={analyzedStocks}
                onSelectStock={handleSelectStockAndAnalyze}
                onImportCsvStock={handleImportParsedCsv}
              />
            )}

            {isStudioTab && selectedStock && (
              <StockAnalysisStudio
                stocks={analyzedStocks}
                selectedStock={selectedStock}
                onSelectSymbol={setSelectedSymbol}
                dataSourceMeta={dataSourceMeta}
                settings={settings}
                riskLimits={riskLimits}
                initialFocus={studioFocus}
                onSendToPaperTrade={handleSendToPaperTrade}
                onSendToAiAnalyst={(st) => {
                  setSelectedSymbol(st.raw.symbol);
                  setActiveTab('AI ANALYST');
                }}
              />
            )}

            {activeTab === 'SCREENER' && (
              <ScreenerView
                stocks={analyzedStocks}
                onSelectStock={handleSelectStockAndAnalyze}
              />
            )}

            {activeTab === 'RISK CALCULATOR' && (
              <RiskCalculatorView settings={settings} riskLimits={riskLimits} />
            )}

            {activeTab === 'PAPER TRADING' && (
              <PaperTradingView
                stocks={analyzedStocks}
                settings={settings}
                riskLimits={riskLimits}
                positions={paperPositions}
                prefillOrder={prefillPaperOrder}
                onClearPrefill={() => setPrefillPaperOrder(null)}
                onAddPosition={(pos) => setPaperPositions((prev) => [pos, ...prev])}
                onClosePosition={handleClosePaperPosition}
                onSaveClosedToJournal={handleSavePaperToJournal}
              />
            )}

            {activeTab === 'TRADE JOURNAL' && (
              <TradeJournalView
                entries={journalEntries}
                stocks={analyzedStocks}
                onAddEntry={(e) => setJournalEntries((prev) => [e, ...prev])}
                onDeleteEntry={(id) =>
                  setJournalEntries((prev) => prev.filter((item) => item.tradeId !== id))
                }
                onReviewWithAi={(entry) => {
                  setSelectedSymbol(entry.symbol);
                  setAiInitialQuestion(
                    `Friend, review my ${entry.symbol} trade (${entry.setup}, Entry ₹${entry.entry}, SL ₹${entry.stopLoss}, Exit ₹${entry.exit ?? 'OPEN'}, Net P&L ₹${entry.netPnl ?? 'N/A'}, Rule Followed: ${entry.ruleFollowed ? 'Yes' : 'No'}).`
                  );
                  setActiveTab('AI ANALYST');
                }}
              />
            )}

            {activeTab === 'PERFORMANCE' && (
              <PerformanceDashboardView
                entries={journalEntries}
                startingCapital={settings.risk.capital}
                stocks={analyzedStocks}
              />
            )}

            {activeTab === 'BACKTEST' && (
              <BacktestView
                stocks={analyzedStocks}
                settings={settings}
                strategyVersions={strategyVersions}
              />
            )}

            {activeTab === 'AI ANALYST' && selectedStock && (
              <AiAnalystView
                stocks={analyzedStocks}
                selectedStock={selectedStock}
                onSelectSymbol={setSelectedSymbol}
                settings={settings}
                dataSourceMeta={dataSourceMeta}
                riskLimits={riskLimits}
                journalEntries={journalEntries}
                aiStatus={aiStatus}
                initialQuestion={aiInitialQuestion}
                onClearInitialQuestion={() => setAiInitialQuestion(null)}
              />
            )}

            {activeTab === 'SETTINGS' && (
              <SettingsAndAuditView
                settings={settings}
                onUpdateSettings={setSettings}
                activeProvider={activeProvider}
                onChangeProvider={setActiveProvider}
                onImportCsvStock={handleImportCsvText}
                universeCount={analyzedStocks.length}
                onImportUniverseBucket={(bucket: UniverseBucket, newSpecs: UniverseConstituentSpec[]) => {
                  setUniverseSpecs((prev) => {
                    const remaining = prev
                      .map((item) => ({
                        ...item,
                        buckets: item.buckets.filter((b) => b !== bucket),
                      }))
                      .filter((item) => item.buckets.length > 0);
                    const mergedMap = new Map<string, UniverseConstituentSpec>();
                    for (const item of remaining) mergedMap.set(item.symbol, item);
                    for (const item of newSpecs) {
                      const existing = mergedMap.get(item.symbol);
                      if (existing) {
                        mergedMap.set(item.symbol, {
                          ...existing,
                          buckets: Array.from(new Set([...existing.buckets, ...item.buckets])),
                        });
                      } else {
                        mergedMap.set(item.symbol, item);
                      }
                    }
                    return Array.from(mergedMap.values());
                  });
                }}
                onResetDefaultUniverse={() => setUniverseSpecs(DEFAULT_150_UNIVERSE)}
                strategyVersions={strategyVersions}
                onCreateStrategyVersion={(v) => setStrategyVersions((prev) => [...prev, v])}
                signalAuditLog={signalAuditLog}
                aiStatus={aiStatus}
              />
            )}
          </>
        )}
      </main>

      {/* Section 30 Permanent Compliance Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 px-4 mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="font-semibold text-slate-700 dark:text-slate-300">
            SMART TRADER AI — Indian Equity Research Workstation (NSE · BSE)
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 font-mono">
            {COMPLIANCE_NOTICES.map((notice, idx) => (
              <React.Fragment key={notice}>
                <span>{notice}</span>
                {idx < COMPLIANCE_NOTICES.length - 1 && <span className="text-slate-400">·</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

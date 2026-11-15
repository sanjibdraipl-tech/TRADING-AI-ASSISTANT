import React, { useState } from 'react';
import {
  AppSettings,
  DataSourceType,
  MarketCapCategory,
  QualityCheckTestResult,
  SignalAuditRecord,
  StrategyVersion,
  UniverseBucket,
} from '../types/trading';
import {
  parseUniverseConstituentsCsv,
  UniverseConstituentSpec,
} from '../data/indianUniverseRegistry';
import { runQualityCheckSuite } from '../engines/qualityCheckSuite';
import { exportToCsv, exportToJson } from '../utils/exportUtils';
import {
  CheckCircle2,
  Download,
  FileCode2,
  GitBranch,
  Play,
  Settings,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';

interface SettingsAndAuditViewProps {
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  activeProvider: DataSourceType;
  onChangeProvider: (provider: DataSourceType) => void;
  onImportCsvStock: (symbol: string, csvText: string) => void;
  universeCount: number;
  onImportUniverseBucket: (bucket: UniverseBucket, specs: UniverseConstituentSpec[]) => void;
  onResetDefaultUniverse: () => void;
  strategyVersions: StrategyVersion[];
  onCreateStrategyVersion: (ver: StrategyVersion) => void;
  signalAuditLog: SignalAuditRecord[];
  aiStatus: { available: boolean; modelName: string; message: string };
}

export const SettingsAndAuditView: React.FC<SettingsAndAuditViewProps> = ({
  settings,
  onUpdateSettings,
  activeProvider,
  onChangeProvider,
  onImportCsvStock,
  universeCount,
  onImportUniverseBucket,
  onResetDefaultUniverse,
  strategyVersions,
  onCreateStrategyVersion,
  signalAuditLog,
  aiStatus,
}) => {
  const [subSection, setSubSection] = useState<'SETTINGS' | 'DATA_BROKER' | 'AUDIT_TRAIL' | 'STRATEGY_VC' | 'QA_SUITE'>('SETTINGS');
  const [csvSymbol, setCsvSymbol] = useState('INFY');
  const [csvNotice, setCsvNotice] = useState('');
  const [targetBucket, setTargetBucket] = useState<UniverseBucket>('NIFTY 50');
  const [universeNotice, setUniverseNotice] = useState('');
  const [qaResults, setQaResults] = useState<QualityCheckTestResult[] | null>(null);
  const [runningQa, setRunningQa] = useState(false);

  const handleUniverseCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const cap: MarketCapCategory =
          targetBucket === 'NIFTY 50'
            ? 'Large Cap'
            : targetBucket === 'NIFTY MIDCAP 150'
            ? 'Mid Cap'
            : 'Small Cap';
        const parsed = parseUniverseConstituentsCsv(String(reader.result || ''), targetBucket, cap);
        onImportUniverseBucket(targetBucket, parsed);
        setUniverseNotice(`Updated ${targetBucket} bucket with ${parsed.length} constituents from ${file.name}.`);
      } catch (err: any) {
        setUniverseNotice(err?.message || 'Failed to parse NSE constituent CSV.');
      }
    };
    reader.readAsText(file);
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      onImportCsvStock(csvSymbol || file.name.replace(/\.csv$/i, '').toUpperCase(), content);
      setCsvNotice(`Imported OHLCV CSV for ${csvSymbol || file.name}. Switched active provider view to CSVDataProvider.`);
    };
    reader.readAsText(file);
  };

  const handleRunQaSuite = async () => {
    setRunningQa(true);
    try {
      const res = await runQualityCheckSuite();
      setQaResults(res);
    } finally {
      setRunningQa(false);
    }
  };

  const handleSnapshotStrategy = () => {
    const nextNum = strategyVersions.length + 1;
    onCreateStrategyVersion({
      id: `CUSTOM_V${nextNum}`,
      name: `Custom Rule Snapshot #${nextNum}`,
      version: `Trend Pullback v1.${nextNum - 2}`,
      dateCreated: new Date().toISOString().slice(0, 10),
      rulesSummary: `EMA(${settings.indicators.emaFast}/${settings.indicators.emaMedium}/${settings.indicators.emaSlow}), RSI(${settings.indicators.rsiPullbackMin}-${settings.indicators.rsiOverbought}), Min Fund ${settings.indicators.minFundamentalScore}, Min R:R ${settings.risk.minRiskReward}`,
      parameters: {
        emaFast: settings.indicators.emaFast,
        emaMedium: settings.indicators.emaMedium,
        emaSlow: settings.indicators.emaSlow,
        minFundamentalScore: settings.indicators.minFundamentalScore,
        minRiskReward: settings.risk.minRiskReward,
      },
      notes: 'Immutable parameter snapshot for reproducible audit & backtest verification.',
    });
  };

  const passedCount = qaResults?.filter((r) => r.status === 'PASS').length ?? 0;

  return (
    <div className="space-y-6">
      {/* Navigation Pills -> clean rectangular tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 text-xs">
        {[
          { id: 'SETTINGS', label: 'Trading & Risk Settings', icon: Settings },
          { id: 'DATA_BROKER', label: 'Data Providers, CSV & Broker Roadmap', icon: FileCode2 },
          { id: 'AUDIT_TRAIL', label: `Signal Audit Trail (${signalAuditLog.length})`, icon: ShieldCheck },
          { id: 'STRATEGY_VC', label: `Strategy Versions (${strategyVersions.length})`, icon: GitBranch },
          { id: 'QA_SUITE', label: '20-Case Quality Check Suite', icon: Play },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubSection(tab.id as typeof subSection)}
              className={`px-3.5 py-2 rounded-lg border font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                active
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* SECTION 37: Settings Page */}
      {subSection === 'SETTINGS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">
              Capital & Risk Controls (Sections 16 & 17)
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 mb-1">Capital (₹)</label>
                <input
                  type="number"
                  step={10000}
                  value={settings.risk.capital}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, risk: { ...settings.risk, capital: Number(e.target.value) || 100000 } })
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Risk Per Trade (%)</label>
                <input
                  type="number"
                  step="0.25"
                  value={settings.risk.maxRiskPerTradePct}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      risk: { ...settings.risk, maxRiskPerTradePct: Number(e.target.value) || 1 },
                    })
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Max Daily Loss (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.risk.maxDailyLossPct}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      risk: { ...settings.risk, maxDailyLossPct: Number(e.target.value) || 2 },
                    })
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Max Weekly Loss (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.risk.maxWeeklyLossPct}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      risk: { ...settings.risk, maxWeeklyLossPct: Number(e.target.value) || 5 },
                    })
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Max Open Positions</label>
                <input
                  type="number"
                  min={1}
                  value={settings.risk.maxOpenPositions}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      risk: { ...settings.risk, maxOpenPositions: Number(e.target.value) || 4 },
                    })
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Max Portfolio Exposure (%)</label>
                <input
                  type="number"
                  step="5"
                  value={settings.risk.maxPortfolioExposurePct}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      risk: { ...settings.risk, maxPortfolioExposurePct: Number(e.target.value) || 80 },
                    })
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Minimum R:R Ratio</label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.risk.minRiskReward}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      risk: { ...settings.risk, minRiskReward: Number(e.target.value) || 2 },
                    })
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">ATR Stop-Loss Multiplier</label>
                <input
                  type="number"
                  step="0.25"
                  value={settings.risk.atrMultiplier}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      risk: { ...settings.risk, atrMultiplier: Number(e.target.value) || 1.5 },
                    })
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">
              Liquidity, Indicator & Style Settings (Sections 6, 9, 11)
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 mb-1">Min Trading Days</label>
                <input
                  type="number"
                  value={settings.liquidity.minTradingDays}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      liquidity: { ...settings.liquidity, minTradingDays: Number(e.target.value) || 200 },
                    })
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Min Avg Daily Traded Value (₹ Cr)</label>
                <input
                  type="number"
                  value={settings.liquidity.minAvgDailyTradedValueCr}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      liquidity: { ...settings.liquidity, minAvgDailyTradedValueCr: Number(e.target.value) || 15 },
                    })
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Min Avg Volume</label>
                <input
                  type="number"
                  value={settings.liquidity.minAvgVolume}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      liquidity: { ...settings.liquidity, minAvgVolume: Number(e.target.value) || 100000 },
                    })
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Min Stock Price (₹)</label>
                <input
                  type="number"
                  value={settings.liquidity.minPrice}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      liquidity: { ...settings.liquidity, minPrice: Number(e.target.value) || 50 },
                    })
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Min Fundamental Score</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.indicators.minFundamentalScore}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      indicators: { ...settings.indicators, minFundamentalScore: Number(e.target.value) || 60 },
                    })
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Trading Style</label>
                <select
                  value={settings.tradingStyle}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, tradingStyle: e.target.value as 'Swing' | 'Positional' })
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                >
                  <option value="Swing">Swing</option>
                  <option value="Positional">Positional</option>
                </select>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
              <div className="font-bold text-amber-600 dark:text-amber-400">
                Strict Smallcap 250 Liquidity Filter Thresholds
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1 text-[11px]">Min Turnover (₹ Cr)</label>
                  <input
                    type="number"
                    value={settings.liquidity.smallcapMinAvgDailyTradedValueCr}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        liquidity: { ...settings.liquidity, smallcapMinAvgDailyTradedValueCr: Number(e.target.value) || 25 },
                      })
                    }
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 text-[11px]">Min Avg Vol</label>
                  <input
                    type="number"
                    value={settings.liquidity.smallcapMinAvgVolume}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        liquidity: { ...settings.liquidity, smallcapMinAvgVolume: Number(e.target.value) || 200000 },
                      })
                    }
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 text-[11px]">Min Price (₹)</label>
                  <input
                    type="number"
                    value={settings.liquidity.smallcapMinPrice}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        liquidity: { ...settings.liquidity, smallcapMinPrice: Number(e.target.value) || 75 },
                      })
                    }
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 space-y-1">
              <div className="font-semibold text-slate-800 dark:text-slate-200">Gemini Server-Side Configuration</div>
              <div className="text-slate-500">
                Active Model: <code className="font-mono text-emerald-500">{aiStatus.modelName}</code>
              </div>
              <p className="text-[11px] text-slate-500">
                Configure <code>GEMINI_API_KEY</code> and optional <code>GEMINI_MODEL</code> inside server environment variables (<code>.env</code> / AI Studio Secrets). No API keys are ever stored in browser JS.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4 & 29: Data Providers, CSV Upload & Broker Roadmap */}
      {subSection === 'DATA_BROKER' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Modular MarketDataProvider Architecture (Section 4)
            </h2>
            <div className="space-y-2">
              {(['DemoDataProvider', 'CSVDataProvider', 'YahooPrototypeProvider', 'BrokerAPIProvider'] as DataSourceType[]).map(
                (p) => (
                  <label
                    key={p}
                    className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer ${
                      activeProvider === p
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="provider"
                        checked={activeProvider === p}
                        onChange={() => onChangeProvider(p)}
                      />
                      <div>
                        <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">{p}</div>
                        <div className="text-[11px] text-slate-500">
                          {p === 'DemoDataProvider' && `${universeCount} NSE/BSE 250-candle series (Nifty 50 + Midcap 50 + Smallcap 50)`}
                          {p === 'CSVDataProvider' && 'User-uploaded NSE/BSE OHLCV CSV files'}
                          {p === 'YahooPrototypeProvider' && 'Delayed prototype adapter (returns empty when offline)'}
                          {p === 'BrokerAPIProvider' && 'Phase 1 Read-Only stub (Zerodha Kite / Dhan / Upstox)'}
                        </div>
                      </div>
                    </div>
                  </label>
                )
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
              <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-emerald-500" /> Import Custom OHLCV CSV
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={csvSymbol}
                  onChange={(e) => setCsvSymbol(e.target.value.toUpperCase())}
                  placeholder="Symbol (e.g. INFY)"
                  className="w-32 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
                <input type="file" accept=".csv" onChange={handleCsvFileUpload} className="text-xs" />
              </div>
              <div className="text-[11px] text-slate-500">
                Expected columns: <code>Date,Open,High,Low,Close,Volume</code>. Sorts strictly chronologically and verifies OHLC bounds.
              </div>
              {csvNotice && <div className="text-emerald-600 dark:text-emerald-400 font-medium">{csvNotice}</div>}
            </div>

            {/* Dynamic Index Constituent CSV Updater (Avoids permanent hard-coding on index rebalancing) */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  Update NSE Index Constituents (CSV Rebalance Import)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onResetDefaultUniverse();
                    setUniverseNotice('Restored October/September 2026 baseline 150-stock universe.');
                  }}
                  className="text-[11px] text-slate-500 hover:text-emerald-500 underline cursor-pointer"
                >
                  Reset 150 Baseline
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={targetBucket}
                  onChange={(e) => setTargetBucket(e.target.value as UniverseBucket)}
                  className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                >
                  <option value="NIFTY 50">NIFTY 50</option>
                  <option value="NIFTY MIDCAP 150">NIFTY MIDCAP 150</option>
                  <option value="NIFTY SMALLCAP 250">NIFTY SMALLCAP 250</option>
                </select>
                <input type="file" accept=".csv" onChange={handleUniverseCsvUpload} className="text-xs" />
              </div>
              <p className="text-[11px] text-slate-500">
                Upload official Nifty Indices constituent CSV (<code>Symbol, Company Name, Industry</code>) whenever semi-annual NSE rebalancing occurs.
              </p>
              {universeNotice && <div className="text-emerald-600 dark:text-emerald-400 font-medium">{universeNotice}</div>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Broker Integration Roadmap (Section 29)
            </h2>
            <div className="space-y-3 text-slate-600 dark:text-slate-300">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                <div className="font-bold text-emerald-800 dark:text-emerald-300">Phase 1 (Current MVP): Read-Only Architecture</div>
                <p className="mt-1">
                  Clean adapter interfaces prepared for SEBI-registered Indian brokers (Zerodha Kite, Dhan, Upstox, Angel One). Live automated order execution is intentionally disabled.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div className="font-bold text-slate-800 dark:text-slate-200">Phase 2 (Future): Read-Only Holdings & Quotes</div>
                <p className="mt-1">Server-side OAuth token exchange to read portfolio holdings and delayed/live quotes.</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div className="font-bold text-slate-800 dark:text-slate-200">Phase 3 (Strict Human-in-the-Loop): Manual Confirmation</div>
                <p className="mt-1">Never enable silent or automated trading. User manually reviews and executes via SEBI-registered broker UI.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 27: Signal Audit Trail */}
      {subSection === 'AUDIT_TRAIL' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Signal Audit Trail (Section 27)
              </h2>
              <p className="text-slate-500">Every rule evaluation snapshot recorded with indicators, strategy version, and final status.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  exportToCsv(
                    signalAuditLog.map((s) => ({
                      SignalID: s.signalId,
                      Timestamp: s.timestamp,
                      Symbol: s.symbol,
                      Source: s.dataSource,
                      StrategyVersion: s.strategyVersion,
                      FinalResult: s.finalResult,
                      FundamentalScore: s.fundamentalScore,
                      Liquidity: s.liquidityStatus,
                      UserDecision: s.userDecision,
                    })),
                    'signal_audit_trail.csv',
                    true
                  )
                }
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                onClick={() => exportToJson(signalAuditLog, 'signal_audit_trail.json')}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                JSON
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 pr-3">Signal ID / Time</th>
                  <th className="py-2 px-3">Symbol</th>
                  <th className="py-2 px-3">Strategy Version</th>
                  <th className="py-2 px-3">Snapshot (Close / RSI / EMA20)</th>
                  <th className="py-2 px-3">Passed / Failed Conditions</th>
                  <th className="py-2 pl-3 text-right">Final Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono">
                {signalAuditLog.map((rec) => (
                  <tr key={rec.signalId} className="align-top">
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{rec.signalId}</div>
                      <div className="text-[11px] text-slate-500">{rec.timestamp}</div>
                    </td>
                    <td className="py-2.5 px-3 font-bold">
                      {rec.symbol}
                      <div className="font-sans font-normal text-[11px] text-slate-500">{rec.dataSource}</div>
                    </td>
                    <td className="py-2.5 px-3 font-sans">{rec.strategyVersion}</td>
                    <td className="py-2.5 px-3 text-[11px]">
                      ₹{rec.indicatorsSnapshot.close} · RSI {rec.indicatorsSnapshot.rsi14} · EMA20 ₹{rec.indicatorsSnapshot.ema20}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[11px] max-w-[260px]">
                      <div className="text-emerald-600 dark:text-emerald-400 truncate">
                        Pass ({rec.passedConditions.length}): {rec.passedConditions.join(', ')}
                      </div>
                      {rec.failedConditions.length > 0 && (
                        <div className="text-rose-600 dark:text-rose-400 truncate">
                          Fail ({rec.failedConditions.length}): {rec.failedConditions.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-bold">{rec.finalResult}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 38: Strategy Version Control */}
      {subSection === 'STRATEGY_VC' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Strategy Version Control Registry (Section 38)
              </h2>
              <p className="text-slate-500">Historical versions stay immutable when creating new parameter versions.</p>
            </div>
            <button
              onClick={handleSnapshotStrategy}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
            >
              Create New Version Snapshot
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {strategyVersions.map((sv) => (
              <div key={sv.id} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <strong className="text-slate-900 dark:text-slate-100">{sv.version}</strong>
                  <span className="font-mono text-[11px] text-slate-500">{sv.dateCreated}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">{sv.rulesSummary}</p>
                <div className="text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-800">
                  {Object.entries(sv.parameters)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 43: Automated 20-Case Quality Check Suite */}
      {subSection === 'QA_SUITE' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Final Quality Check Suite (Section 43 — 20 Edge-Case Verification Tests)
              </h2>
              <p className="text-slate-500">
                Tests missing prices, incomplete RSI, missing fundamentals, stale data, illiquidity, corporate actions, zero-SL, look-ahead bias, API key exposure, and expectancy math.
              </p>
            </div>
            <button
              onClick={handleRunQaSuite}
              disabled={runningQa}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              {runningQa ? 'Running 20 Tests...' : 'Run All 20 Verification Tests'}
            </button>
          </div>

          {qaResults && (
            <div className="space-y-3">
              <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                Summary: {passedCount} / {qaResults.length} Tests PASSED
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 px-3">Test Case</th>
                      <th className="py-2 px-3">Input</th>
                      <th className="py-2 px-3">Expected Result</th>
                      <th className="py-2 px-3">Actual Result</th>
                      <th className="py-2 pl-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {qaResults.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 pr-3 font-mono">{r.id}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{r.name}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{r.input}</td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{r.expectedResult}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-200">{r.actualResult}</td>
                        <td className="py-2 pl-3 text-right">
                          <span
                            className={`inline-flex items-center gap-1 font-mono font-bold ${
                              r.status === 'PASS' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {r.status === 'PASS' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

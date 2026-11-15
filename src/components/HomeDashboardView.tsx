import React from 'react';
import {
  AnalyzedStock,
  DataSourceMetadata,
  PaperPosition,
  RiskLimitState,
  TradeJournalEntry,
} from '../types/trading';
import { ArrowRight, AlertTriangle, CheckCircle2, ShieldAlert, Bot, Activity } from 'lucide-react';

interface HomeDashboardViewProps {
  stocks: AnalyzedStock[];
  dataSourceMeta: DataSourceMetadata;
  riskLimits: RiskLimitState;
  paperPositions: PaperPosition[];
  journalEntries: TradeJournalEntry[];
  aiStatus: { available: boolean; modelName: string };
  onSelectStock: (symbol: string) => void;
  onNavigate: (tab: string) => void;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({
  stocks,
  dataSourceMeta,
  riskLimits,
  paperPositions,
  journalEntries,
  aiStatus,
  onSelectStock,
  onNavigate,
}) => {
  const setupCandidates = stocks.filter(
    (s) => s.primarySignal === 'SETUP DETECTED' || s.primarySignal === 'WAIT FOR CONFIRMATION'
  );
  const dataWarnings = stocks.filter((s) => s.dataIntegrity.status !== 'GREEN');
  const openPaper = paperPositions.filter((p) => p.status === 'OPEN');

  // Derive deterministic Nifty-proxy breadth from loaded universe
  const aboveEma50Count = stocks.filter(
    (s) => s.technicals.latestClose !== null && s.technicals.ema50 !== null && s.technicals.latestClose > s.technicals.ema50
  ).length;
  const aboveEma200Count = stocks.filter(
    (s) => s.technicals.latestClose !== null && s.technicals.ema200 !== null && s.technicals.latestClose > s.technicals.ema200
  ).length;

  // Sector strength aggregation
  const sectorStats: Record<string, { count: number; avgPct: number; sumPct: number }> = {};
  stocks.forEach((s) => {
    const sec = s.raw.sector;
    if (!sectorStats[sec]) sectorStats[sec] = { count: 0, avgPct: 0, sumPct: 0 };
    sectorStats[sec].count++;
    sectorStats[sec].sumPct += s.technicals.pctChange || 0;
    sectorStats[sec].avgPct = Math.round((sectorStats[sec].sumPct / sectorStats[sec].count) * 100) / 100;
  });

  const sortedSectors = Object.entries(sectorStats).sort((a, b) => b[1].avgPct - a[1].avgPct);

  return (
    <div className="space-y-6">
      {/* Demo / Delayed Data Transparency Banner (Section 4) */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <span className="font-semibold">{dataSourceMeta.displayLabel}:</span>{' '}
            <span>{dataSourceMeta.bannerText}</span>
          </div>
        </div>
        <span className="font-mono text-[11px] text-amber-700 dark:text-amber-300 shrink-0">
          Updated: {dataSourceMeta.lastUpdated}
        </span>
      </div>

      {/* Primary KPI Grid (Section 36) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Universe Regime & Nifty Breadth</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-display">
            {aboveEma50Count}/{stocks.length} Above EMA50
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {aboveEma200Count}/{stocks.length} above EMA200 · No directional prediction
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Rule-Based Setup Candidates</div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-display tabular-nums">
            {setupCandidates.length} Active / Pending
          </div>
          <button
            onClick={() => onNavigate('SCREENER')}
            className="text-xs text-slate-600 dark:text-slate-300 hover:text-emerald-500 inline-flex items-center gap-1 cursor-pointer"
          >
            Open Screener <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Risk Control Status</div>
          <div className={`text-lg font-bold font-display flex items-center gap-1.5 ${riskLimits.blocked ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {riskLimits.blocked ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {riskLimits.blocked ? 'BLOCKED (LIMIT HIT)' : 'WITHIN LIMITS'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Open Paper: {openPaper.length} · Exposure: {riskLimits.portfolioExposurePct}%
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5">
          <div className="text-xs text-slate-500 dark:text-slate-400">AI Explanation Layer</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-display flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-sky-500" />
            {aiStatus.available ? 'AI Ready' : 'Demo Voice Mode'}
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-mono truncate">
              {aiStatus.available ? aiStatus.modelName : 'Bilingual Voice Ready'}
            </span>
            <button
              onClick={() => onNavigate('VOICE ASSISTANT')}
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
            >
              Voice AI <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Indian Equity Universe Structure & Funnel */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Indian Equity Universe Funnel ({stocks.length} Loaded Equities)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configurable NSE constituent buckets gated by Average Daily Traded Value, Trading Days, Price, Volume, Corporate Actions, and Data Quality.
            </p>
          </div>
          <button
            onClick={() => onNavigate('SETTINGS')}
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer shrink-0"
          >
            Update Index Constituents / Liquidity Rules
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {(['NIFTY 50', 'NIFTY MIDCAP 150', 'NIFTY SMALLCAP 250'] as const).map((bucket) => {
            const bucketStocks = stocks.filter((s) => s.raw.universeBuckets?.includes(bucket));
            const liqPass = bucketStocks.filter((s) => s.liquidity.status === 'PASS').length;
            const setupActive = bucketStocks.filter((s) => s.primarySignal === 'SETUP DETECTED').length;
            const riskLabel =
              bucket === 'NIFTY 50'
                ? 'Core Large Cap (50)'
                : bucket === 'NIFTY MIDCAP 150'
                ? 'Swing Active (50 / 150)'
                : 'Strict Liquidity Gate (50 / 250)';
            return (
              <div
                key={bucket}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 space-y-1.5"
              >
                <div className="font-bold text-slate-900 dark:text-slate-100">{bucket}</div>
                <div className="text-[11px] text-slate-500">{riskLabel}</div>
                <div className="font-mono text-[11px] pt-1 space-y-0.5">
                  <div>
                    Loaded: <strong>{bucketStocks.length}</strong> · Liq PASS:{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400">{liqPass}</strong>
                  </div>
                  <div>
                    Setup Detected: <strong className="text-sky-600 dark:text-sky-400">{setupActive}</strong>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20 p-3.5 space-y-1.5">
            <div className="font-bold text-emerald-800 dark:text-emerald-300">TRADING UNIVERSE PASS</div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
              All Mandatory Gates Cleared
            </div>
            <div className="font-mono text-[11px] pt-1 space-y-0.5 text-slate-700 dark:text-slate-300">
              <div>
                Liquidity PASS: <strong>{stocks.filter((s) => s.liquidity.status === 'PASS').length}</strong>/{stocks.length}
              </div>
              <div>
                Setups Ready: <strong>{stocks.filter((s) => s.primarySignal === 'SETUP DETECTED').length}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Split: Setup Candidates & Sector Strength */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Watchlist Alerts & Setup Candidates */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Setup Candidates & Watchlist Alerts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rule-verified setups evaluated deterministically from OHLCV candles and fundamentals.
              </p>
            </div>
            <button
              onClick={() => onNavigate('WATCHLIST')}
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              View Full Watchlist
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Symbol</th>
                  <th className="py-2 px-3 font-medium">Price</th>
                  <th className="py-2 px-3 font-medium">Liquidity</th>
                  <th className="py-2 px-3 font-medium">Fund.</th>
                  <th className="py-2 px-3 font-medium">Setup Status</th>
                  <th className="py-2 pl-3 text-right font-medium">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono tabular-nums">
                {stocks.slice(0, 7).map((s) => (
                  <tr key={s.raw.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{s.raw.symbol}</div>
                      <div className="font-sans text-[11px] text-slate-500">{s.raw.exchange} · {s.raw.sector}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-900 dark:text-slate-100">₹{s.technicals.latestClose?.toFixed(2) ?? 'N/A'}</div>
                      <div className={(s.technicals.pctChange || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400 text-[11px]' : 'text-rose-600 dark:text-rose-400 text-[11px]'}>
                        {(s.technicals.pctChange || 0) >= 0 ? '+' : ''}{s.technicals.pctChange ?? 0}%
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`font-semibold ${s.liquidity.status === 'PASS' ? 'text-emerald-600 dark:text-emerald-400' : s.liquidity.status === 'WARNING' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {s.liquidity.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                      {s.fundamentalsScore.totalScore}/100
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span
                        className={`text-[11px] font-semibold ${
                          s.primarySignal === 'SETUP DETECTED'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : s.primarySignal === 'WAIT FOR CONFIRMATION' || s.primarySignal === 'WATCH'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {s.primarySignal}
                      </span>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{s.primarySetupName}</div>
                    </td>
                    <td className="py-2.5 pl-3 text-right font-sans">
                      <button
                        onClick={() => onSelectStock(s.raw.symbol)}
                        className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium cursor-pointer"
                      >
                        Analyze
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Sector Strength, Paper Positions & Data Warnings */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Sector Strength (1-Day Demo)</h3>
            <div className="space-y-2 text-xs">
              {sortedSectors.map(([sector, info]) => (
                <div key={sector} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                  <span className="text-slate-700 dark:text-slate-300 truncate pr-2">{sector}</span>
                  <span className={`font-mono font-semibold tabular-nums ${info.avgPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {info.avgPct >= 0 ? '+' : ''}{info.avgPct}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Session Journal & Quality Status</h3>
            <div className="space-y-2 text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span>Logged Journal Trades:</span>
                <strong className="font-mono">{journalEntries.length}</strong>
              </div>
              <div className="flex justify-between">
                <span>Open Paper Positions:</span>
                <strong className="font-mono">{openPaper.length}</strong>
              </div>
              <div className="flex justify-between">
                <span>Data Integrity Warnings:</span>
                <strong className={`font-mono ${dataWarnings.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {dataWarnings.length}
                </strong>
              </div>
            </div>
            <div className="pt-2 flex gap-2">
              <button
                onClick={() => onNavigate('PAPER TRADING')}
                className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium cursor-pointer"
              >
                Paper Trading
              </button>
              <button
                onClick={() => onNavigate('TRADE JOURNAL')}
                className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium cursor-pointer"
              >
                Trade Journal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

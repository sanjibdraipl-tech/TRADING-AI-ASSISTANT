import React, { useState } from 'react';
import { AnalyzedStock, UniverseBucket } from '../types/trading';
import { exportToCsv } from '../utils/exportUtils';
import { Download, Radar } from 'lucide-react';

interface ScreenerViewProps {
  stocks: AnalyzedStock[];
  onSelectStock: (symbol: string) => void;
}

export const ScreenerView: React.FC<ScreenerViewProps> = ({ stocks, onSelectStock }) => {
  const [universeBucket, setUniverseBucket] = useState<'ALL' | UniverseBucket>('ALL');
  const [setupFilter, setSetupFilter] = useState<'ALL' | 'PULLBACK' | 'BREAKOUT' | 'RANGE' | 'LIQUID_FUND'>('ALL');
  const [showAllRows, setShowAllRows] = useState(false);

  const matches = stocks.filter((s) => {
    if (universeBucket !== 'ALL' && !s.raw.universeBuckets?.includes(universeBucket)) return false;
    if (setupFilter === 'PULLBACK') return s.setupA.signalStatus === 'SETUP DETECTED' || s.setupA.signalStatus === 'WAIT FOR CONFIRMATION';
    if (setupFilter === 'BREAKOUT') return s.setupB.signalStatus === 'SETUP DETECTED' || s.setupB.signalStatus === 'WAIT FOR CONFIRMATION';
    if (setupFilter === 'RANGE') return s.setupC.applicable;
    if (setupFilter === 'LIQUID_FUND') return s.liquidity.status === 'PASS' && s.fundamentalsScore.totalScore >= 65;
    return true;
  });

  const handleExport = () => {
    exportToCsv(
      matches.map((s) => ({
        Symbol: s.raw.symbol,
        Exchange: s.raw.exchange,
        Universe: s.raw.universeBuckets?.join(' | ') || '',
        MarketCap: s.raw.marketCapCategory,
        Price: s.technicals.latestClose ?? 'N/A',
        Liquidity: s.liquidity.status,
        LiquidityProfile: s.liquidity.ruleProfile || 'STANDARD',
        AvgTurnoverCr: s.liquidity.avgDailyTradedValueCr,
        DataQuality: s.dataIntegrity.status,
        FundamentalScore: s.fundamentalsScore.totalScore,
        SetupA: s.setupA.signalStatus,
        SetupB: s.setupB.signalStatus,
        SetupC: s.setupC.signalStatus,
        PrimarySignal: s.primarySignal,
        Reason: s.primaryReason,
      })),
      'smart_trader_screener.csv',
      true
    );
  };

  const visibleMatches = showAllRows ? matches : matches.slice(0, 60);

  return (
    <div className="space-y-5 text-xs">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-emerald-500" />
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Rule-Based Stock Screener ({matches.length} Matches)
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                Indian Equity Universe Pipeline: Liquidity Gate (Strict on Smallcap 250) + Data Integrity Gate + Deterministic Setup A/B/C.
              </p>
            </div>
          </div>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Screener CSV
          </button>
        </div>

        {/* Universe Bucket Selector */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 mr-1 font-semibold">Universe:</span>
          {(
            [
              { id: 'ALL', label: `All Universe (${stocks.length})` },
              { id: 'NIFTY 50', label: 'NIFTY 50 (50 Core)' },
              { id: 'NIFTY MIDCAP 150', label: 'NIFTY MIDCAP 150 (Active 50)' },
              { id: 'NIFTY SMALLCAP 250', label: 'NIFTY SMALLCAP 250 (Strict Liq Filter)' },
            ] as const
          ).map((u) => (
            <button
              key={u.id}
              onClick={() => setUniverseBucket(u.id)}
              className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer transition-colors ${
                universeBucket === u.id
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>

        {/* Setup Filter Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'ALL', label: 'All Setups' },
            { id: 'PULLBACK', label: 'Setup A: Trend Pullback' },
            { id: 'BREAKOUT', label: 'Setup B: Breakout' },
            { id: 'RANGE', label: 'Setup C: Range / Mean Reversion' },
            { id: 'LIQUID_FUND', label: 'Liquidity PASS + Fund >= 65' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSetupFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer transition-colors ${
                setupFilter === tab.id
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white border-transparent'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-3 font-semibold">Symbol / Index</th>
                <th className="py-3 px-3 font-semibold text-right">Price</th>
                <th className="py-3 px-3 font-semibold">Data / Liquidity Gate</th>
                <th className="py-3 px-3 font-semibold text-right">Fund. Score</th>
                <th className="py-3 px-3 font-semibold">MTF Align</th>
                <th className="py-3 px-3 font-semibold">Primary Signal</th>
                <th className="py-3 px-3 font-semibold">Rule Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono tabular-nums">
              {visibleMatches.map((s) => (
                <tr
                  key={s.raw.symbol}
                  onClick={() => onSelectStock(s.raw.symbol)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                >
                  <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                    {s.raw.symbol}
                    <span className="block font-sans font-normal text-[11px] text-slate-500">
                      {s.raw.universeBuckets?.join(', ') || s.raw.exchange} · {s.raw.marketCapCategory}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">₹{s.technicals.latestClose?.toFixed(2) ?? 'N/A'}</td>
                  <td className="py-3 px-3 font-sans text-[11px]">
                    <div>
                      <span className={s.dataIntegrity.status === 'GREEN' ? 'text-emerald-500 font-semibold' : 'text-amber-500 font-semibold'}>
                        {s.dataIntegrity.status}
                      </span>{' '}
                      · Liq{' '}
                      <span className={s.liquidity.status === 'PASS' ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                        {s.liquidity.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      ₹{s.liquidity.avgDailyTradedValueCr}Cr {s.liquidity.strictModeApplied ? '(Strict SC)' : ''}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold">{s.fundamentalsScore.totalScore}/100</td>
                  <td className="py-3 px-3 font-sans">{s.mtf.alignment}</td>
                  <td className="py-3 px-3 font-sans font-bold text-slate-900 dark:text-slate-100">{s.primarySignal}</td>
                  <td className="py-3 px-3 font-sans text-slate-600 dark:text-slate-300 max-w-xs">{s.primaryReason}</td>
                </tr>
              ))}
              {visibleMatches.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center font-sans text-slate-500">
                    No stocks currently match this strict deterministic filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {matches.length > 60 && (
          <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
            <span className="text-slate-500">
              Showing {showAllRows ? matches.length : 60} of {matches.length} screened equities
            </span>
            <button
              onClick={() => setShowAllRows((v) => !v)}
              className="px-3 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium cursor-pointer"
            >
              {showAllRows ? 'Show First 60' : `Show All ${matches.length} Rows`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

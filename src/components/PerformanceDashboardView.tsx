import React, { useMemo } from 'react';
import { AnalyzedStock, TradeJournalEntry } from '../types/trading';
import { calculatePerformanceMetrics } from '../engines/journalEngine';
import { exportPrintableReport, exportToCsv, exportToJson } from '../utils/exportUtils';
import { BarChart3, Download, Printer } from 'lucide-react';

interface PerformanceDashboardViewProps {
  entries: TradeJournalEntry[];
  startingCapital: number;
  stocks: AnalyzedStock[];
}

export const PerformanceDashboardView: React.FC<PerformanceDashboardViewProps> = ({
  entries,
  startingCapital,
  stocks,
}) => {
  const sectorLookup = useMemo(() => {
    const map: Record<string, string> = {};
    stocks.forEach((s) => {
      map[s.raw.symbol] = s.raw.sector;
    });
    return map;
  }, [stocks]);

  const metrics = useMemo(
    () => calculatePerformanceMetrics(entries, startingCapital, sectorLookup),
    [entries, startingCapital, sectorLookup]
  );

  // SVG Equity Curve geometry
  const width = 760;
  const height = 210;
  const pad = { top: 18, right: 20, bottom: 26, left: 60 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const eqValues = metrics.equityCurve.map((p) => p.equity);
  const minEq = Math.min(...eqValues, startingCapital) * 0.995;
  const maxEq = Math.max(...eqValues, startingCapital) * 1.005;
  const eqRange = Math.max(1, maxEq - minEq);

  const curvePath = metrics.equityCurve
    .map((pt, idx) => {
      const x =
        pad.left +
        (metrics.equityCurve.length > 1 ? (idx / (metrics.equityCurve.length - 1)) * innerW : innerW / 2);
      const y = pad.top + ((maxEq - pt.equity) / eqRange) * innerH;
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-500" />
            Performance & Expectancy Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Deterministic performance metrics computed from logged closed trades. Past results do not guarantee future returns.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() =>
              exportToCsv(
                metrics.setupWise.map((s) => ({
                  Setup: s.setup,
                  Trades: s.trades,
                  'Win Rate %': s.winRate,
                  'Net P&L (₹)': s.netPnl,
                })),
                'performance_setup_breakdown.csv',
                true
              )
            }
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export Breakdown CSV
          </button>
          <button
            onClick={() => exportToJson(metrics, 'performance_metrics.json')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            JSON
          </button>
          <button
            onClick={exportPrintableReport}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print Report
          </button>
        </div>
      </div>

      {/* Section 24 Exact Expectancy Banner */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-5 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Expectancy Formula: (Win Rate × Average Win) − (Loss Rate × Average Loss)
        </div>
        <div className="flex flex-wrap items-baseline gap-4">
          <span
            className={`text-2xl font-bold font-mono tabular-nums ${
              metrics.expectancyR >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {metrics.expectancyR >= 0 ? '+' : ''}
            {metrics.expectancyR}R per trade
          </span>
          <span className="text-sm font-mono text-slate-700 dark:text-slate-300">
            ({metrics.expectancyRs >= 0 ? '+' : ''}₹{metrics.expectancyRs.toFixed(2)} per trade)
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Across {metrics.closedTrades} closed trade(s), historical net expectancy averages{' '}
          <strong>
            {metrics.expectancyR >= 0 ? '+' : ''}
            {metrics.expectancyR}R
          </strong>{' '}
          (₹{metrics.expectancyRs.toFixed(2)}) per trade after statutory charges. Historical expectancy measures past sample execution and never implies future profitability.
        </p>
      </div>

      {/* Section 23 Full KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <div className="text-slate-500">Closed / Total</div>
          <div className="text-base font-bold font-mono mt-1">
            {metrics.closedTrades} / {metrics.totalTrades}
          </div>
          <div className="text-[11px] text-slate-500">
            {metrics.winningTrades}W · {metrics.losingTrades}L
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <div className="text-slate-500">Win Rate</div>
          <div className="text-base font-bold font-mono mt-1">{metrics.winRatePct}%</div>
          <div className="text-[11px] text-slate-500">Avg R: {metrics.averageR}R</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <div className="text-slate-500">Profit Factor</div>
          <div className="text-base font-bold font-mono mt-1">{metrics.profitFactor}</div>
          <div className="text-[11px] text-slate-500">GrossWin / GrossLoss</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <div className="text-slate-500">Avg Win / Loss</div>
          <div className="text-sm font-bold font-mono mt-1 text-emerald-600 dark:text-emerald-400">
            +₹{metrics.avgWinRs} (+{metrics.avgWinR}R)
          </div>
          <div className="text-[11px] font-mono text-rose-600 dark:text-rose-400">
            -₹{metrics.avgLossRs} (-{metrics.avgLossR}R)
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <div className="text-slate-500">Max Drawdown</div>
          <div className="text-base font-bold font-mono mt-1 text-rose-600 dark:text-rose-400">
            {metrics.maxDrawdownPct}%
          </div>
          <div className="text-[11px] font-mono text-slate-500">₹{metrics.maxDrawdownRs.toFixed(0)}</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <div className="text-slate-500">Streaks & Extremes</div>
          <div className="text-xs font-mono mt-1">
            Win: {metrics.maxConsecutiveWins} · Loss: {metrics.maxConsecutiveLosses}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Best ₹{metrics.largestWinRs} / Worst ₹{metrics.largestLossRs}
          </div>
        </div>
      </div>

      {/* Long-Term Equity Curve SVG */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Equity Curve Progression (₹)</h2>
          <span className="text-xs font-mono text-slate-500">
            Start: ₹{startingCapital.toLocaleString('en-IN')} → Current: ₹
            {(eqValues[eqValues.length - 1] ?? startingCapital).toLocaleString('en-IN')}
          </span>
        </div>
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[540px]">
            <line
              x1={pad.left}
              y1={pad.top + ((maxEq - startingCapital) / eqRange) * innerH}
              x2={width - pad.right}
              y2={pad.top + ((maxEq - startingCapital) / eqRange) * innerH}
              stroke="#64748b"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            {curvePath && <path d={curvePath} fill="none" stroke="#10b981" strokeWidth="2.2" />}
            {metrics.equityCurve.map((pt, idx) => {
              const x =
                pad.left +
                (metrics.equityCurve.length > 1 ? (idx / (metrics.equityCurve.length - 1)) * innerW : innerW / 2);
              const y = pad.top + ((maxEq - pt.equity) / eqRange) * innerH;
              return (
                <circle key={idx} cx={x} cy={y} r="3" fill="#10b981">
                  <title>{`${pt.date}: ₹${pt.equity.toLocaleString('en-IN')}`}</title>
                </circle>
              );
            })}
            <text x={6} y={pad.top + 8} fontSize="10" fill="#94a3b8" className="font-mono">
              ₹{Math.round(maxEq).toLocaleString('en-IN')}
            </text>
            <text x={6} y={height - pad.bottom} fontSize="10" fill="#94a3b8" className="font-mono">
              ₹{Math.round(minEq).toLocaleString('en-IN')}
            </text>
          </svg>
        </div>
      </div>

      {/* Breakdown Tables: Monthly, Setup-wise, Sector-wise */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Monthly Performance</h3>
          <table className="w-full text-left border-collapse font-mono tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-1.5">Month</th>
                <th className="py-1.5">Trades</th>
                <th className="py-1.5 text-right">Net P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {metrics.monthlyPnl.map((m) => (
                <tr key={m.month}>
                  <td className="py-2">{m.month}</td>
                  <td className="py-2">{m.trades}</td>
                  <td className={`py-2 text-right font-semibold ${m.netPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {m.netPnl >= 0 ? '+' : ''}₹{m.netPnl.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Setup-Wise Performance</h3>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-1.5">Setup</th>
                <th className="py-1.5">Win %</th>
                <th className="py-1.5 text-right">Net P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono tabular-nums">
              {metrics.setupWise.map((s) => (
                <tr key={s.setup}>
                  <td className="py-2 font-sans text-slate-800 dark:text-slate-200">{s.setup}</td>
                  <td className="py-2">{s.winRate}% ({s.trades})</td>
                  <td className={`py-2 text-right font-semibold ${s.netPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {s.netPnl >= 0 ? '+' : ''}₹{s.netPnl.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Sector-Wise Performance</h3>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-1.5">Sector</th>
                <th className="py-1.5">Trades</th>
                <th className="py-1.5 text-right">Net P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono tabular-nums">
              {metrics.sectorWise.map((sec) => (
                <tr key={sec.sector}>
                  <td className="py-2 font-sans text-slate-800 dark:text-slate-200">{sec.sector}</td>
                  <td className="py-2">{sec.trades}</td>
                  <td className={`py-2 text-right font-semibold ${sec.netPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {sec.netPnl >= 0 ? '+' : ''}₹{sec.netPnl.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

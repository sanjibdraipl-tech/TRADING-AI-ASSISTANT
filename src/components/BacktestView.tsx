import React, { useMemo, useState } from 'react';
import { AnalyzedStock, AppSettings, StrategyVersion } from '../types/trading';
import { runZeroLookAheadBacktest } from '../engines/backtestEngine';
import { exportToCsv, exportToJson } from '../utils/exportUtils';
import { AlertTriangle, CheckCircle2, Download, History } from 'lucide-react';

interface BacktestViewProps {
  stocks: AnalyzedStock[];
  settings: AppSettings;
  strategyVersions: StrategyVersion[];
}

export const BacktestView: React.FC<BacktestViewProps> = ({
  stocks,
  settings,
  strategyVersions,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(stocks[0]?.raw.symbol || 'RELIANCE');
  const [strategyId, setStrategyId] = useState<'SETUP_A' | 'SETUP_B' | 'SETUP_C'>('SETUP_A');
  const [capital, setCapital] = useState<number>(settings.risk.capital);
  const [riskPct, setRiskPct] = useState<number>(settings.risk.maxRiskPerTradePct);
  const [slippagePct, setSlippagePct] = useState<number>(0.05);
  const [inSampleSplitPct, setInSampleSplitPct] = useState<number>(70);

  const selectedStock = stocks.find((s) => s.raw.symbol === selectedSymbol) || stocks[0];
  const activeStrategy = strategyVersions.find((v) => v.id === strategyId) || strategyVersions[0];

  const result = useMemo(() => {
    if (!selectedStock) return null;
    return runZeroLookAheadBacktest(
      selectedStock.raw.candles,
      {
        symbol: selectedStock.raw.symbol,
        strategyId,
        strategyVersion: activeStrategy?.version || strategyId,
        capital,
        riskPerTradePct: riskPct,
        slippagePct,
        outOfSampleSplitPct: inSampleSplitPct,
        dataVersion: selectedStock.dataIntegrity.dataSource,
      },
      settings.indicators,
      selectedStock.raw.corporateActionsVerified
    );
  }, [selectedStock, strategyId, activeStrategy, capital, riskPct, slippagePct, inSampleSplitPct, settings.indicators]);

  // SVG Equity Curve geometry
  const width = 760;
  const height = 200;
  const pad = { top: 18, right: 20, bottom: 26, left: 60 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const eqPoints = result?.equityCurve.length
    ? [{ date: 'Start', equity: capital, segment: 'IN_SAMPLE' as const }, ...result.equityCurve]
    : [{ date: 'Start', equity: capital, segment: 'IN_SAMPLE' as const }];
  const minEq = Math.min(...eqPoints.map((p) => p.equity)) * 0.995;
  const maxEq = Math.max(...eqPoints.map((p) => p.equity)) * 1.005;
  const eqRange = Math.max(1, maxEq - minEq);

  const eqPath = eqPoints
    .map((pt, idx) => {
      const x = pad.left + (eqPoints.length > 1 ? (idx / (eqPoints.length - 1)) * innerW : innerW / 2);
      const y = pad.top + ((maxEq - pt.equity) / eqRange) * innerH;
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="space-y-6">
      {/* Strict Zero-Look-Ahead & Anti-Guarantee Banner (Sections 25 & 26) */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-100">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <strong>Historical Simulation Only:</strong> Never interpret backtest results as guaranteed future performance. Slippage, Indian delivery STT/charges, and strictly causal candle slicing are enforced.
          </div>
        </div>
      </div>

      {/* Parameter Control Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-500" />
              Zero-Look-Ahead Backtest Workbench
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evaluates `candles[0..i]` strictly bar-by-bar, executes on `candles[i+1].open`, and splits In-Sample vs Out-of-Sample.
            </p>
          </div>
          {result && (
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() =>
                  exportToCsv(
                    result.trades.map((t) => ({
                      EntryDate: t.entryDate,
                      ExitDate: t.exitDate,
                      Segment: t.sampleSegment,
                      EntryPrice: t.entryPrice,
                      ExitPrice: t.exitPrice,
                      StopLoss: t.stopLoss,
                      Qty: t.quantity,
                      GrossPnl: t.grossPnl,
                      ChargesSlippage: t.chargesAndSlippage,
                      NetPnl: t.netPnl,
                      RMultiple: t.rMultiple,
                      ExitReason: t.exitReason,
                    })),
                    `backtest_${selectedSymbol}_${strategyId}.csv`,
                    true
                  )
                }
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                onClick={() => exportToJson(result, `backtest_${selectedSymbol}_${strategyId}.json`)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                JSON
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 mb-1">Stock</label>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 font-mono"
            >
              {stocks.map((s) => (
                <option key={s.raw.symbol} value={s.raw.symbol}>
                  {s.raw.symbol} ({s.raw.candles.length} bars)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-500 mb-1">Strategy Version</label>
            <select
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value as 'SETUP_A' | 'SETUP_B' | 'SETUP_C')}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2"
            >
              {strategyVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-500 mb-1">Initial Capital (₹)</label>
            <input
              type="number"
              min={10000}
              step={10000}
              value={capital}
              onChange={(e) => setCapital(Math.max(10000, Number(e.target.value) || 100000))}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">Risk/Trade (%)</label>
            <input
              type="number"
              step="0.25"
              min="0.25"
              max="3"
              value={riskPct}
              onChange={(e) => setRiskPct(Number(e.target.value) || 1)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">Slippage (%)</label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={slippagePct}
              onChange={(e) => setSlippagePct(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">In-Sample Split (%)</label>
            <input
              type="number"
              min="50"
              max="90"
              step="5"
              value={inSampleSplitPct}
              onChange={(e) => setInSampleSplitPct(Number(e.target.value) || 70)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 font-mono"
            />
          </div>
        </div>

        {result && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{result.lookAheadVerification}</span>
          </div>
        )}
      </div>

      {result && (
        <>
          {/* KPI Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
              <div className="text-slate-500">Total Trades</div>
              <div className="text-base font-bold font-mono mt-1">{result.metrics.totalTrades}</div>
              <div className="text-[11px] text-slate-500">{result.totalCandlesTested} bars</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
              <div className="text-slate-500">Win Rate</div>
              <div className="text-base font-bold font-mono mt-1">{result.metrics.winRatePct}%</div>
              <div className="text-[11px] text-slate-500">PF: {result.metrics.profitFactor}</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
              <div className="text-slate-500">Expectancy (R)</div>
              <div className={`text-base font-bold font-mono mt-1 ${result.metrics.expectancyR >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {result.metrics.expectancyR >= 0 ? '+' : ''}{result.metrics.expectancyR}R
              </div>
              <div className="text-[11px] text-slate-500">Net of charges</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
              <div className="text-slate-500">Net P&L</div>
              <div className={`text-base font-bold font-mono mt-1 ${result.metrics.netPnlRs >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {result.metrics.netPnlRs >= 0 ? '+' : ''}₹{result.metrics.netPnlRs.toFixed(0)}
              </div>
              <div className="text-[11px] text-slate-500">Final ₹{result.metrics.finalEquityRs.toFixed(0)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
              <div className="text-slate-500">Max Drawdown</div>
              <div className="text-base font-bold font-mono mt-1 text-rose-600 dark:text-rose-400">
                {result.metrics.maxDrawdownPct}%
              </div>
              <div className="text-[11px] text-slate-500">Peak-to-valley</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
              <div className="text-slate-500">In-Sample ({inSampleSplitPct}%)</div>
              <div className="text-base font-bold font-mono mt-1">
                {result.metrics.inSampleExpectancyR >= 0 ? '+' : ''}{result.metrics.inSampleExpectancyR}R
              </div>
              <div className="text-[11px] text-slate-500">{result.metrics.inSampleTrades} trades</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
              <div className="text-slate-500">Out-of-Sample ({100 - inSampleSplitPct}%)</div>
              <div className="text-base font-bold font-mono mt-1">
                {result.metrics.outOfSampleExpectancyR >= 0 ? '+' : ''}{result.metrics.outOfSampleExpectancyR}R
              </div>
              <div className="text-[11px] text-slate-500">{result.metrics.outOfSampleTrades} trades</div>
            </div>
          </div>

          {/* Equity Curve */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Backtest Equity Curve — {selectedStock.raw.symbol} ({activeStrategy?.version})
            </h2>
            <div className="w-full overflow-x-auto">
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[540px]">
                <line
                  x1={pad.left}
                  y1={pad.top + ((maxEq - capital) / eqRange) * innerH}
                  x2={width - pad.right}
                  y2={pad.top + ((maxEq - capital) / eqRange) * innerH}
                  stroke="#64748b"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                {eqPath && <path d={eqPath} fill="none" stroke="#0ea5e9" strokeWidth="2.2" />}
                {eqPoints.map((pt, idx) => {
                  const x = pad.left + (eqPoints.length > 1 ? (idx / (eqPoints.length - 1)) * innerW : innerW / 2);
                  const y = pad.top + ((maxEq - pt.equity) / eqRange) * innerH;
                  return (
                    <circle
                      key={idx}
                      cx={x}
                      cy={y}
                      r="3"
                      fill={pt.segment === 'OUT_OF_SAMPLE' ? '#f59e0b' : '#0ea5e9'}
                    >
                      <title>{`${pt.date} (${pt.segment}): ₹${pt.equity.toFixed(0)}`}</title>
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
            <div className="text-[11px] text-slate-500 font-mono">
              Blue points: In-Sample ({inSampleSplitPct}%) · Amber points: Out-of-Sample ({100 - inSampleSplitPct}%)
            </div>
          </div>

          {/* Backtest Trade Log */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Simulated Trade Log ({result.trades.length} trades)
            </h2>
            {result.trades.length === 0 ? (
              <div className="py-4 text-xs text-slate-500">
                No historical triggers matched the strict conditions of {activeStrategy?.version} in this candle window.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-sans">
                      <th className="py-2 pr-3">Segment</th>
                      <th className="py-2 px-3">Entry → Exit Date</th>
                      <th className="py-2 px-3">Entry / SL / Exit</th>
                      <th className="py-2 px-3">Qty</th>
                      <th className="py-2 px-3">Charges+Slip</th>
                      <th className="py-2 px-3">Net P&L</th>
                      <th className="py-2 pl-3 text-right">R / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {result.trades.map((t, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-3 text-[11px]">
                          <span className={t.sampleSegment === 'OUT_OF_SAMPLE' ? 'text-amber-500 font-semibold' : 'text-sky-500'}>
                            {t.sampleSegment}
                          </span>
                        </td>
                        <td className="py-2 px-3">{t.entryDate} → {t.exitDate}</td>
                        <td className="py-2 px-3">₹{t.entryPrice} / ₹{t.stopLoss} / ₹{t.exitPrice}</td>
                        <td className="py-2 px-3">{t.quantity}</td>
                        <td className="py-2 px-3 text-slate-500">₹{t.chargesAndSlippage.toFixed(2)}</td>
                        <td className={`py-2 px-3 font-bold ${t.netPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {t.netPnl >= 0 ? '+' : ''}₹{t.netPnl.toFixed(2)}
                        </td>
                        <td className="py-2 pl-3 text-right">
                          {t.rMultiple >= 0 ? '+' : ''}{t.rMultiple}R · {t.exitReason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

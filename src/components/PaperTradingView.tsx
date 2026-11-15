import React, { useEffect, useState } from 'react';
import {
  AnalyzedStock,
  AppSettings,
  PaperPosition,
  RiskLimitState,
  TradeJournalEntry,
} from '../types/trading';
import { calculateDeterministicRisk, estimateTransactionCharges } from '../engines/riskEngine';
import { AlertTriangle, BookPlus, ShieldAlert, TrendingUp, XCircle } from 'lucide-react';

interface PaperTradingViewProps {
  stocks: AnalyzedStock[];
  settings: AppSettings;
  riskLimits: RiskLimitState;
  positions: PaperPosition[];
  prefillOrder?: {
    symbol: string;
    setupName: string;
    entryPrice: number;
    stopLoss: number;
    invalidationCondition: string;
  } | null;
  onClearPrefill?: () => void;
  onAddPosition: (pos: PaperPosition) => void;
  onClosePosition: (id: string, exitPrice: number, closeType: 'CLOSED_SL' | 'CLOSED_MANUAL') => void;
  onSaveClosedToJournal: (pos: PaperPosition, stock?: AnalyzedStock) => void;
}

export const PaperTradingView: React.FC<PaperTradingViewProps> = ({
  stocks,
  settings,
  riskLimits,
  positions,
  prefillOrder,
  onClearPrefill,
  onAddPosition,
  onClosePosition,
  onSaveClosedToJournal,
}) => {
  const [virtualCapital, setVirtualCapital] = useState<number>(settings.risk.capital);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    prefillOrder?.symbol || stocks[0]?.raw.symbol || 'RELIANCE'
  );
  const [setupName, setSetupName] = useState<string>(prefillOrder?.setupName || 'Setup A: Trend Pullback');
  const [entryPrice, setEntryPrice] = useState<number>(
    prefillOrder?.entryPrice || stocks[0]?.technicals.latestClose || 1000
  );
  const [stopLoss, setStopLoss] = useState<number>(
    prefillOrder?.stopLoss || Math.round(((stocks[0]?.technicals.latestClose || 1000) * 0.97) * 100) / 100
  );
  const [invalidationText, setInvalidationText] = useState<string>(
    prefillOrder?.invalidationCondition || 'Daily close strictly below Stop-Loss or below EMA50.'
  );
  const [manualExitInputs, setManualExitInputs] = useState<Record<string, number>>({});
  const [savedToJournalIds, setSavedToJournalIds] = useState<Record<string, boolean>>({});
  const [formNotice, setFormNotice] = useState<string>('');

  useEffect(() => {
    setVirtualCapital(settings.risk.capital);
  }, [settings.risk.capital]);

  useEffect(() => {
    if (prefillOrder) {
      setSelectedSymbol(prefillOrder.symbol);
      setSetupName(prefillOrder.setupName);
      setEntryPrice(prefillOrder.entryPrice);
      setStopLoss(prefillOrder.stopLoss);
      setInvalidationText(prefillOrder.invalidationCondition);
      setFormNotice(`Prefilled ${prefillOrder.symbol} from ${prefillOrder.setupName}. Review SL & size before virtual entry.`);
      onClearPrefill?.();
    }
  }, [prefillOrder, onClearPrefill]);

  const handleSymbolChange = (sym: string) => {
    setSelectedSymbol(sym);
    const st = stocks.find((s) => s.raw.symbol === sym);
    if (st && st.technicals.latestClose) {
      const atr = st.technicals.atr14 || st.technicals.latestClose * 0.02;
      setEntryPrice(st.technicals.latestClose);
      setStopLoss(Math.round((st.technicals.latestClose - settings.risk.atrMultiplier * atr) * 100) / 100);
      setSetupName(st.primarySetupName || 'Manual Educational Research');
    }
  };

  const selectedStock = stocks.find((s) => s.raw.symbol === selectedSymbol);
  const riskCalc = calculateDeterministicRisk(
    virtualCapital,
    settings.risk.maxRiskPerTradePct,
    entryPrice,
    stopLoss,
    settings.risk.maxSingleStockExposurePct,
    true
  );

  const openPositions = positions.filter((p) => p.status === 'OPEN');
  const closedPositions = positions.filter((p) => p.status !== 'OPEN');

  const deployedCapital = openPositions.reduce((s, p) => s + p.entryPrice * p.quantity, 0);
  const realizedPnlTotal = closedPositions.reduce((s, p) => s + (p.realizedPnl || 0), 0);
  const unrealizedPnlTotal = openPositions.reduce((s, p) => {
    const cur = stocks.find((st) => st.raw.symbol === p.symbol)?.technicals.latestClose ?? p.entryPrice;
    return s + (cur - p.entryPrice) * p.quantity;
  }, 0);
  const currentVirtualEquity = Math.round((virtualCapital + realizedPnlTotal + unrealizedPnlTotal) * 100) / 100;
  const availableCash = Math.round((virtualCapital + realizedPnlTotal - deployedCapital) * 100) / 100;

  const handleVirtualEntry = (e: React.FormEvent) => {
    e.preventDefault();
    setFormNotice('');

    if (riskLimits.blocked) {
      setFormNotice(`Risk limits reached: ${riskLimits.reasons.join(' ')}`);
      return;
    }
    if (!riskCalc.valid || riskCalc.quantity <= 0) {
      setFormNotice(riskCalc.error || 'Calculated quantity is 0 shares. Widen capital or refine Stop-Loss.');
      return;
    }
    if (riskCalc.positionValue > availableCash) {
      setFormNotice(`Insufficient virtual cash (Available ₹${availableCash.toLocaleString('en-IN')}, Required ₹${riskCalc.positionValue.toLocaleString('en-IN')}).`);
      return;
    }

    const pos: PaperPosition = {
      id: `PAPER-${Date.now()}`,
      symbol: selectedSymbol,
      exchange: selectedStock?.raw.exchange || 'NSE',
      setupName,
      entryDate: new Date().toISOString().slice(0, 10),
      entryPrice,
      stopLoss,
      quantity: riskCalc.quantity,
      charges: estimateTransactionCharges(entryPrice, entryPrice, riskCalc.quantity, 'delivery'),
      status: 'OPEN',
      invalidationCondition: invalidationText || `Close below ₹${stopLoss}`,
    };

    onAddPosition(pos);
    setFormNotice(`Recorded virtual position: ${pos.quantity} shares of ${pos.symbol} @ ₹${pos.entryPrice}.`);
  };

  return (
    <div className="space-y-6">
      {/* Prominent PAPER TRADING Disclosure Banner (Section 28) */}
      <div className="rounded-xl border border-sky-500/40 bg-sky-50 dark:bg-sky-950/25 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-xs text-sky-900 dark:text-sky-100">
          <AlertTriangle className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <div>
            <span className="font-bold tracking-wide uppercase">PAPER TRADING MODE (SIMULATION ONLY)</span>
            <span className="mx-1.5 text-sky-500">·</span>
            <span>No live broker connection or real order execution is active. Practice discipline and position sizing safely.</span>
          </div>
        </div>
        <span className="font-mono text-[11px] font-semibold text-sky-700 dark:text-sky-300 shrink-0">
          ZERO REAL MONEY AT RISK
        </span>
      </div>

      {/* Virtual Account Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Starting Virtual Capital</div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-slate-400">₹</span>
            <input
              type="number"
              min={10000}
              step={10000}
              value={virtualCapital}
              onChange={(e) => setVirtualCapital(Math.max(1000, Number(e.target.value) || 0))}
              className="w-full font-mono text-lg font-bold bg-transparent border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Risk/Trade: {settings.risk.maxRiskPerTradePct}%</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Current Virtual Equity</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            ₹{currentVirtualEquity.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Available Cash: ₹{availableCash.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Unrealized Virtual P&L</div>
          <div
            className={`text-xl font-bold font-mono tabular-nums ${
              unrealizedPnlTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {unrealizedPnlTotal >= 0 ? '+' : ''}₹{unrealizedPnlTotal.toFixed(2)}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {openPositions.length} Open Position(s) · Deployed ₹{deployedCapital.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Realized Virtual P&L (Net)</div>
          <div
            className={`text-xl font-bold font-mono tabular-nums ${
              realizedPnlTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {realizedPnlTotal >= 0 ? '+' : ''}₹{realizedPnlTotal.toFixed(2)}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {closedPositions.length} Closed Virtual Trade(s)
          </div>
        </div>
      </div>

      {/* Risk Control Blocker Warning */}
      {riskLimits.blocked && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-50 dark:bg-rose-950/20 p-4 flex items-start gap-3 text-xs text-rose-800 dark:text-rose-200">
          <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Risk Controls Active — New Virtual Entries Blocked</div>
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              {riskLimits.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Main Split: New Virtual Entry Form & Open Positions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleVirtualEntry}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Record Virtual Equity Entry
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Position size is calculated deterministically using your configured risk %.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Stock Symbol</label>
              <select
                value={selectedSymbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
              >
                {stocks.map((s) => (
                  <option key={s.raw.symbol} value={s.raw.symbol}>
                    {s.raw.symbol} ({s.raw.exchange}) — ₹{s.technicals.latestClose?.toFixed(2) ?? 'N/A'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Setup / Strategy Name</label>
              <input
                type="text"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Entry Price (₹)</label>
                <input
                  type="number"
                  step="0.05"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Stop-Loss (₹)</label>
                <input
                  type="number"
                  step="0.05"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">Invalidation Condition</label>
              <input
                type="text"
                value={invalidationText}
                onChange={(e) => setInvalidationText(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Deterministic Sizing Preview */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Calculated Qty:</span>
                <strong className="text-slate-900 dark:text-slate-100">{riskCalc.quantity} shares</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Position Value:</span>
                <span className="text-slate-800 dark:text-slate-200">
                  ₹{riskCalc.positionValue.toLocaleString('en-IN')} ({riskCalc.totalCapitalPct}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Planned Risk:</span>
                <span className="text-rose-600 dark:text-rose-400">₹{riskCalc.maxPlannedLoss.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Est. Statutory Charges:</span>
                <span className="text-slate-700 dark:text-slate-300">₹{riskCalc.estimatedCharges.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">2R Reference Level:</span>
                <span className="text-emerald-600 dark:text-emerald-400">₹{riskCalc.twoRPrice}</span>
              </div>
            </div>

            {formNotice && (
              <div className="text-[11px] rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-amber-800 dark:text-amber-200">
                {formNotice}
              </div>
            )}

            <button
              type="submit"
              disabled={riskLimits.blocked || !riskCalc.valid || riskCalc.quantity <= 0}
              className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-colors cursor-pointer"
            >
              Simulate Virtual Entry (Paper Only)
            </button>
          </div>
        </form>

        {/* Open Virtual Positions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Open Virtual Positions ({openPositions.length})
              </h2>
              <span className="text-xs font-mono text-slate-500">
                Max Allowed: {settings.risk.maxOpenPositions}
              </span>
            </div>

            {openPositions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No open paper positions. Select a rule-verified setup from Stock Analysis or use the form on the left.
              </div>
            ) : (
              <div className="space-y-3">
                {openPositions.map((pos) => {
                  const currentLtp =
                    stocks.find((s) => s.raw.symbol === pos.symbol)?.technicals.latestClose ?? pos.entryPrice;
                  const mtm = Math.round((currentLtp - pos.entryPrice) * pos.quantity * 100) / 100;
                  const manualExitVal = manualExitInputs[pos.id] ?? currentLtp;

                  return (
                    <div
                      key={pos.id}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100 font-mono">
                            {pos.symbol}
                          </span>
                          <span className="mx-1.5 text-slate-400">·</span>
                          <span className="text-slate-600 dark:text-slate-300">{pos.setupName}</span>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Entered {pos.entryDate} · Qty {pos.quantity} · Entry ₹{pos.entryPrice} · SL ₹{pos.stopLoss}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-slate-500 text-[11px]">Demo Mark Price: ₹{currentLtp}</div>
                          <div className={`text-sm font-bold ${mtm >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {mtm >= 0 ? '+' : ''}₹{mtm.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        <strong className="text-slate-700 dark:text-slate-300">Invalidation:</strong> {pos.invalidationCondition}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">Virtual Exit Price ₹:</span>
                          <input
                            type="number"
                            step="0.05"
                            value={manualExitVal}
                            onChange={(e) =>
                              setManualExitInputs((prev) => ({ ...prev, [pos.id]: Number(e.target.value) }))
                            }
                            className="w-24 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onClosePosition(pos.id, pos.stopLoss, 'CLOSED_SL')}
                            className="px-3 py-1.5 rounded border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium cursor-pointer inline-flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Simulate SL Hit (₹{pos.stopLoss})
                          </button>
                          <button
                            onClick={() => onClosePosition(pos.id, manualExitVal, 'CLOSED_MANUAL')}
                            className="px-3 py-1.5 rounded bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 hover:opacity-90 font-semibold cursor-pointer"
                          >
                            Close Virtual Position
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Closed Virtual Trades History */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Closed Virtual Trades ({closedPositions.length})
            </h2>
            {closedPositions.length === 0 ? (
              <div className="py-4 text-xs text-slate-500">No closed virtual trades in this session yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2 pr-3 font-medium">Symbol</th>
                      <th className="py-2 px-3 font-medium">Dates</th>
                      <th className="py-2 px-3 font-medium">Entry / Exit</th>
                      <th className="py-2 px-3 font-medium">Charges</th>
                      <th className="py-2 px-3 font-medium">Net P&L</th>
                      <th className="py-2 pl-3 text-right font-medium">Journal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                    {closedPositions.map((pos) => (
                      <tr key={pos.id}>
                        <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-slate-100">
                          {pos.symbol}
                          <div className="font-sans text-[11px] font-normal text-slate-500">{pos.status}</div>
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                          {pos.entryDate} → {pos.exitDate}
                        </td>
                        <td className="py-2 px-3 text-slate-800 dark:text-slate-200">
                          ₹{pos.entryPrice} → ₹{pos.exitPrice} (Qty {pos.quantity})
                        </td>
                        <td className="py-2 px-3 text-slate-500">₹{pos.charges.toFixed(2)}</td>
                        <td
                          className={`py-2 px-3 font-bold ${
                            (pos.realizedPnl || 0) >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {(pos.realizedPnl || 0) >= 0 ? '+' : ''}₹{(pos.realizedPnl || 0).toFixed(2)}
                        </td>
                        <td className="py-2 pl-3 text-right font-sans">
                          {savedToJournalIds[pos.id] ? (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Saved</span>
                          ) : (
                            <button
                              onClick={() => {
                                onSaveClosedToJournal(pos, stocks.find((s) => s.raw.symbol === pos.symbol));
                                setSavedToJournalIds((prev) => ({ ...prev, [pos.id]: true }));
                              }}
                              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <BookPlus className="w-3 h-3" /> Save to Journal
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { AnalyzedStock, Exchange, TradeJournalEntry } from '../types/trading';
import { estimateTransactionCharges } from '../engines/riskEngine';
import { exportToCsv, exportToJson } from '../utils/exportUtils';
import { BookOpen, Download, Plus, Trash2, X } from 'lucide-react';

interface TradeJournalViewProps {
  entries: TradeJournalEntry[];
  stocks: AnalyzedStock[];
  onAddEntry: (entry: TradeJournalEntry) => void;
  onDeleteEntry: (tradeId: string) => void;
  onReviewWithAi?: (entry: TradeJournalEntry) => void;
}

export const TradeJournalView: React.FC<TradeJournalViewProps> = ({
  entries,
  stocks,
  onAddEntry,
  onDeleteEntry,
  onReviewWithAi,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterRuleFollowed, setFilterRuleFollowed] = useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [searchSymbol, setSearchSymbol] = useState('');

  // Form state matching all 22+ fields of TradeJournalEntry
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    symbol: stocks[0]?.raw.symbol || 'RELIANCE',
    exchange: (stocks[0]?.raw.exchange || 'NSE') as Exchange,
    setup: 'Setup A: Trend Pullback',
    timeframe: '1D',
    marketCondition: 'Bullish Above EMA50',
    fundamentalScore: stocks[0]?.fundamentalsScore.totalScore || 75,
    technicalStatus: 'PASS',
    entry: 1300,
    stopLoss: 1260,
    plannedR: 2,
    quantity: 25,
    exit: 1380 as number | '',
    holdingPeriodDays: 5 as number | '',
    entryReason: 'Pullback to EMA20 with rising volume',
    exitReason: '2R milestone reached',
    mistake: 'None',
    emotion: 'Disciplined' as TradeJournalEntry['emotion'],
    ruleFollowed: true,
    screenshotRef: 'chart-snapshot-1d',
    notes: '',
  });

  const filteredEntries = entries.filter((e) => {
    if (searchSymbol && !e.symbol.toLowerCase().includes(searchSymbol.toLowerCase())) return false;
    if (filterRuleFollowed === 'YES' && !e.ruleFollowed) return false;
    if (filterRuleFollowed === 'NO' && e.ruleFollowed) return false;
    return true;
  });

  const handleSaveNew = (e: React.FormEvent) => {
    e.preventDefault();
    const exitNum = form.exit === '' ? null : Number(form.exit);
    const riskPerShare = Math.max(0.01, Math.abs(form.entry - form.stopLoss));
    const riskAmount = Math.round(riskPerShare * form.quantity * 100) / 100;
    const charges =
      exitNum !== null
        ? estimateTransactionCharges(form.entry, exitNum, form.quantity, 'delivery')
        : estimateTransactionCharges(form.entry, form.entry, form.quantity, 'delivery');
    const grossPnl =
      exitNum !== null ? Math.round((exitNum - form.entry) * form.quantity * 100) / 100 : null;
    const netPnl = grossPnl !== null ? Math.round((grossPnl - charges) * 100) / 100 : null;

    const newEntry: TradeJournalEntry = {
      tradeId: `TRD-${Date.now().toString().slice(-5)}`,
      date: form.date,
      symbol: form.symbol.toUpperCase().trim(),
      exchange: form.exchange,
      setup: form.setup,
      timeframe: form.timeframe,
      marketCondition: form.marketCondition,
      fundamentalScore: Number(form.fundamentalScore),
      technicalStatus: form.technicalStatus,
      entry: Number(form.entry),
      stopLoss: Number(form.stopLoss),
      plannedR: Number(form.plannedR),
      quantity: Number(form.quantity),
      riskAmount,
      exit: exitNum,
      grossPnl,
      charges,
      netPnl,
      holdingPeriodDays: form.holdingPeriodDays === '' ? null : Number(form.holdingPeriodDays),
      entryReason: form.entryReason,
      exitReason: form.exitReason,
      mistake: form.mistake,
      emotion: form.emotion,
      ruleFollowed: form.ruleFollowed,
      screenshotRef: form.screenshotRef,
      notes: form.notes,
      aiReview: '',
    };

    onAddEntry(newEntry);
    setShowAddModal(false);
  };

  const handleExportCsv = (excelBom: boolean) => {
    const rows = entries.map((e) => ({
      'Trade ID': e.tradeId,
      Date: e.date,
      Symbol: e.symbol,
      Exchange: e.exchange,
      Setup: e.setup,
      Timeframe: e.timeframe,
      'Market Condition': e.marketCondition,
      'Fundamental Score': e.fundamentalScore,
      'Technical Status': e.technicalStatus,
      Entry: e.entry,
      'Stop-Loss': e.stopLoss,
      'Planned R': e.plannedR,
      Quantity: e.quantity,
      'Risk Amount (₹)': e.riskAmount,
      Exit: e.exit ?? '',
      'Gross P&L (₹)': e.grossPnl ?? '',
      'Charges (₹)': e.charges,
      'Net P&L (₹)': e.netPnl ?? '',
      'Holding Period (Days)': e.holdingPeriodDays ?? '',
      'Entry Reason': e.entryReason,
      'Exit Reason': e.exitReason,
      Mistake: e.mistake,
      Emotion: e.emotion,
      'Rule Followed': e.ruleFollowed ? 'Yes' : 'No',
      'Screenshot Ref': e.screenshotRef,
      Notes: e.notes,
    }));
    exportToCsv(rows, `smart_trader_journal_${new Date().toISOString().slice(0, 10)}.csv`, excelBom);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-500" />
              Structured Trading Journal (22-Point Audit Log)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track rule adherence, emotions, statutory charges, R-multiples, and post-trade lessons.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleExportCsv(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={() => handleExportCsv(true)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Excel CSV
            </button>
            <button
              onClick={() => exportToJson(entries, 'smart_trader_journal.json')}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              JSON
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Log Trade
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <input
            type="text"
            placeholder="Filter by symbol (e.g. BEL, ICICIBANK)..."
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value)}
            className="w-60 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-slate-900 dark:text-slate-100"
          />
          <select
            value={filterRuleFollowed}
            onChange={(e) => setFilterRuleFollowed(e.target.value as 'ALL' | 'YES' | 'NO')}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">Rule Followed: All ({entries.length})</option>
            <option value="YES">Rules Followed Only</option>
            <option value="NO">Rule Deviations Only</option>
          </select>
        </div>

        {/* Journal Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-3 font-medium">ID / Date</th>
                <th className="py-2 px-3 font-medium">Symbol</th>
                <th className="py-2 px-3 font-medium">Setup & TF</th>
                <th className="py-2 px-3 font-medium">Entry / SL / Exit</th>
                <th className="py-2 px-3 font-medium">Qty / Risk</th>
                <th className="py-2 px-3 font-medium">Net P&L (R)</th>
                <th className="py-2 px-3 font-medium">Emotion & Rule</th>
                <th className="py-2 px-3 font-medium">Entry / Exit Reason & Mistake</th>
                <th className="py-2 pl-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredEntries.map((t) => {
                const realizedR =
                  t.netPnl !== null && t.riskAmount > 0 ? Math.round((t.netPnl / t.riskAmount) * 100) / 100 : null;
                return (
                  <tr key={t.tradeId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 align-top">
                    <td className="py-3 pr-3 font-mono whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{t.tradeId}</div>
                      <div className="text-[11px] text-slate-500">{t.date}</div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900 dark:text-slate-100">{t.symbol}</div>
                      <div className="text-[11px] text-slate-500">
                        {t.exchange} · Fund {t.fundamentalScore}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{t.setup}</div>
                      <div className="text-[11px] text-slate-500">
                        {t.timeframe} · {t.marketCondition}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                      <div>In: ₹{t.entry} · SL: ₹{t.stopLoss}</div>
                      <div className="text-[11px] text-slate-500">
                        Out: {t.exit !== null ? `₹${t.exit}` : 'OPEN'} ({t.holdingPeriodDays ?? 0}d)
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                      <div>{t.quantity} sh</div>
                      <div className="text-[11px] text-slate-500">Risk ₹{t.riskAmount} · Chg ₹{t.charges}</div>
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                      {t.netPnl !== null ? (
                        <>
                          <div className={`font-bold ${t.netPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {t.netPnl >= 0 ? '+' : ''}₹{t.netPnl.toFixed(2)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {realizedR !== null ? `${realizedR >= 0 ? '+' : ''}${realizedR}R` : ''}
                          </div>
                        </>
                      ) : (
                        <span className="text-amber-500">OPEN</span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="text-slate-800 dark:text-slate-200">{t.emotion}</div>
                      <div className={`text-[11px] font-semibold ${t.ruleFollowed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {t.ruleFollowed ? 'Rule Followed' : 'Rule Broken'}
                      </div>
                    </td>
                    <td className="py-3 px-3 max-w-[260px]">
                      <div className="text-slate-700 dark:text-slate-300 truncate" title={t.entryReason}>
                        <strong>In:</strong> {t.entryReason}
                      </div>
                      <div className="text-slate-500 truncate" title={t.exitReason}>
                        <strong>Out:</strong> {t.exitReason}
                      </div>
                      {t.mistake && t.mistake !== 'None' && (
                        <div className="text-rose-600 dark:text-rose-400 text-[11px]">
                          <strong>Lesson:</strong> {t.mistake}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pl-3 text-right whitespace-nowrap space-x-1">
                      {onReviewWithAi && (
                        <button
                          onClick={() => onReviewWithAi(t)}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] cursor-pointer"
                        >
                          AI Review
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteEntry(t.tradeId)}
                        className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="Delete trade entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Trade Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveNew}
            className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Log Trade to Journal</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-500 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Symbol</label>
                <input
                  type="text"
                  required
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Exchange</label>
                <select
                  value={form.exchange}
                  onChange={(e) => setForm({ ...form, exchange: e.target.value as Exchange })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                >
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-500 mb-1">Setup</label>
                <input
                  type="text"
                  value={form.setup}
                  onChange={(e) => setForm({ ...form, setup: e.target.value })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Timeframe</label>
                <input
                  type="text"
                  value={form.timeframe}
                  onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Market Condition</label>
                <input
                  type="text"
                  value={form.marketCondition}
                  onChange={(e) => setForm({ ...form, marketCondition: e.target.value })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-slate-500 mb-1">Entry (₹)</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  value={form.entry}
                  onChange={(e) => setForm({ ...form, entry: Number(e.target.value) })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Stop-Loss (₹)</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  value={form.stopLoss}
                  onChange={(e) => setForm({ ...form, stopLoss: Number(e.target.value) })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Exit (₹)</label>
                <input
                  type="number"
                  step="0.05"
                  value={form.exit}
                  onChange={(e) => setForm({ ...form, exit: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Hold Days</label>
                <input
                  type="number"
                  min="0"
                  value={form.holdingPeriodDays}
                  onChange={(e) =>
                    setForm({ ...form, holdingPeriodDays: e.target.value === '' ? '' : Number(e.target.value) })
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-500 mb-1">Emotion State</label>
                <select
                  value={form.emotion}
                  onChange={(e) => setForm({ ...form, emotion: e.target.value as TradeJournalEntry['emotion'] })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                >
                  <option value="Disciplined">Disciplined</option>
                  <option value="Calm">Calm</option>
                  <option value="FOMO">FOMO</option>
                  <option value="Fear">Fear</option>
                  <option value="Revenge">Revenge</option>
                  <option value="Overconfident">Overconfident</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Fundamental Score</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.fundamentalScore}
                  onChange={(e) => setForm({ ...form, fundamentalScore: Number(e.target.value) })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div className="flex items-end pb-1.5">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.ruleFollowed}
                    onChange={(e) => setForm({ ...form, ruleFollowed: e.target.checked })}
                  />
                  <span className="font-medium text-slate-800 dark:text-slate-200">Followed Written Rules</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 mb-1">Entry Reason</label>
                <input
                  type="text"
                  value={form.entryReason}
                  onChange={(e) => setForm({ ...form, entryReason: e.target.value })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Exit Reason</label>
                <input
                  type="text"
                  value={form.exitReason}
                  onChange={(e) => setForm({ ...form, exitReason: e.target.value })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 mb-1">Mistake / Lesson</label>
                <input
                  type="text"
                  value={form.mistake}
                  onChange={(e) => setForm({ ...form, mistake: e.target.value })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Notes / Chart Reference</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
              >
                Save Journal Entry
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

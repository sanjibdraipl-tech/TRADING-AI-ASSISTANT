import React, { useState, useEffect } from 'react';
import {
  AnalyzedStock,
  AppSettings,
  DataSourceMetadata,
  RiskLimitState,
  SetupCardResult,
} from '../types/trading';
import { StockChart } from './StockChart';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  ShieldAlert,
  XCircle,
  Play,
} from 'lucide-react';

interface StockAnalysisStudioProps {
  stocks: AnalyzedStock[];
  selectedStock: AnalyzedStock;
  onSelectSymbol: (symbol: string) => void;
  dataSourceMeta: DataSourceMetadata;
  settings: AppSettings;
  riskLimits: RiskLimitState;
  initialFocus?: 'OVERVIEW' | 'FUNDAMENTALS' | 'TECHNICALS' | 'SETUP ENGINE';
  onSendToPaperTrade: (stock: AnalyzedStock, setup: SetupCardResult) => void;
  onSendToAiAnalyst: (stock: AnalyzedStock) => void;
}

export const StockAnalysisStudio: React.FC<StockAnalysisStudioProps> = ({
  stocks,
  selectedStock,
  onSelectSymbol,
  dataSourceMeta,
  riskLimits,
  initialFocus = 'OVERVIEW',
  onSendToPaperTrade,
  onSendToAiAnalyst,
}) => {
  const [subTab, setSubTab] = useState<'OVERVIEW' | 'FUNDAMENTALS' | 'TECHNICALS' | 'SETUP ENGINE'>(
    initialFocus
  );

  useEffect(() => {
    setSubTab(initialFocus);
  }, [initialFocus]);

  const {
    raw,
    dataIntegrity,
    corporateActionStatus,
    liquidity,
    technicals,
    mtf,
    fundamentalsScore,
    setupA,
    setupB,
    setupC,
    primarySignal,
    primaryReason,
  } = selectedStock;

  const statusBadgeClass = (st: 'PASS' | 'FAIL' | 'WARNING') =>
    st === 'PASS'
      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
      : st === 'WARNING'
      ? 'text-amber-600 dark:text-amber-400 font-semibold'
      : 'text-rose-600 dark:text-rose-400 font-semibold';

  const renderSetupCard = (setup: SetupCardResult) => (
    <div
      key={setup.setupId}
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{setup.setupName}</h3>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Strategy Version: {setup.strategyVersion}
          </div>
        </div>
        <div className="text-right">
          <div
            className={`text-xs font-bold font-mono ${
              setup.signalStatus === 'SETUP DETECTED'
                ? 'text-emerald-600 dark:text-emerald-400'
                : setup.signalStatus === 'WAIT FOR CONFIRMATION' || setup.signalStatus === 'WATCH'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {setup.signalStatus} ({setup.overallStatus})
          </div>
          {setup.suggestedEntry && setup.suggestedStopLoss && (
            <div className="text-[11px] text-slate-500 font-mono">
              Ref Entry ₹{setup.suggestedEntry} · ATR SL ₹{setup.suggestedStopLoss}
            </div>
          )}
        </div>
      </div>

      {/* Transparent Condition Checklist (Never hides failed conditions) */}
      <div className="space-y-1.5 text-xs">
        {setup.conditions.map((c, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0 gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              {c.status === 'PASS' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : c.status === 'WARNING' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              )}
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{c.label}</span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">({c.requiredRule})</span>
            </div>
            <div className="flex items-center gap-3 shrink-0 font-mono">
              <span className="text-slate-600 dark:text-slate-300 text-[11px]">{c.actualValue}</span>
              <span className={statusBadgeClass(c.status)}>{c.status}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
        <div>
          <strong className="text-slate-900 dark:text-slate-100">Rule Summary:</strong> {setup.explanationSummary}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 pt-1 border-t border-slate-200 dark:border-slate-800">
          <div><strong>Stop-Loss Invalidation:</strong> {setup.invalidationConditions.stopLossRule}</div>
          <div><strong>Technical Invalidation:</strong> {setup.invalidationConditions.technicalInvalidation}</div>
          <div><strong>Fundamental Invalidation:</strong> {setup.invalidationConditions.fundamentalInvalidation}</div>
          <div><strong>Data Invalidation:</strong> {setup.invalidationConditions.dataInvalidation}</div>
        </div>
      </div>

      {setup.suggestedEntry && setup.suggestedStopLoss && !riskLimits.blocked && liquidity.status !== 'FAIL' && dataIntegrity.status !== 'RED' && (
        <div className="flex justify-end">
          <button
            onClick={() => onSendToPaperTrade(selectedStock, setup)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs font-semibold cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Simulate in Paper Trading
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stock Selector & Sub-Tab Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={raw.symbol}
            onChange={(e) => onSelectSymbol(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-sm text-slate-900 dark:text-slate-100 cursor-pointer"
          >
            {stocks.map((s) => (
              <option key={s.raw.symbol} value={s.raw.symbol}>
                {s.raw.symbol} ({s.raw.exchange}) — {s.raw.companyName}
              </option>
            ))}
          </select>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-800 dark:text-slate-200">{raw.sector}</span>
            <span className="mx-1.5">·</span>
            <span>{raw.marketCapCategory}</span>
            <span className="mx-1.5">·</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              ₹{technicals.latestClose?.toFixed(2) ?? 'N/A'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
            {(['OVERVIEW', 'FUNDAMENTALS', 'TECHNICALS', 'SETUP ENGINE'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSubTab(t)}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  subTab === t
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={() => onSendToAiAnalyst(selectedStock)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold hover:opacity-90 cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" />
            Explain JSON with Gemini
          </button>
        </div>
      </div>

      {/* Primary Signal & Risk Blocker Banner */}
      {riskLimits.blocked && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-50 dark:bg-rose-950/20 px-4 py-3 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <div>
            <strong>BLOCK NEW SETUPS:</strong> Risk limit reached. No new trade should be initiated until the configured reset condition is satisfied.
            <span className="block mt-0.5 font-mono text-[11px]">{riskLimits.reasons.join(' | ')}</span>
          </div>
        </div>
      )}

      {/* Critical Incomplete Data Warning (Section 5) */}
      {(dataIntegrity.status === 'RED' || !technicals.calculationComplete) && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-50 dark:bg-rose-950/20 px-4 py-3 text-xs text-rose-800 dark:text-rose-200">
          <strong>Data Incomplete / Insufficient:</strong> Friend, the indicator or candle series is incomplete (
          {technicals.missingIndicators.join(', ') || dataIntegrity.issues.join(', ')}), so I cannot give a confident technical interpretation.
        </div>
      )}

      {/* OVERVIEW SUBTAB: Chart + Data Integrity + Liquidity + Corporate Actions + MTF */}
      {subTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Interactive Chart */}
          <StockChart symbol={raw.symbol} candles={raw.candles} technicals={technicals} />

          {/* Section 5: Data Integrity Panel + Section 6: Liquidity + Section 7: Corporate Actions + Section 10: Multi-Timeframe */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            {/* Section 5: Data Integrity Panel */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 text-sm">
                  <Database className="w-4 h-4 text-sky-500" />
                  Section 5: Data Integrity Panel
                </div>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                    dataIntegrity.status === 'GREEN'
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                      : dataIntegrity.status === 'YELLOW'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                      : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {dataIntegrity.status} ({dataIntegrity.dataQualityScore}/100)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between"><span className="text-slate-500 font-sans">Symbol / Exchange:</span><span>{dataIntegrity.symbol} ({dataIntegrity.exchange})</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-sans">Data Source:</span><span>{dataIntegrity.dataSource}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-sans">Interval:</span><span>{dataIntegrity.dataInterval}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-sans">Candles:</span><span>{dataIntegrity.numberOfCandles}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-sans">Missing / Dupes:</span><span>{dataIntegrity.missingCandles} / {dataIntegrity.duplicateCandles}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-sans">OHLC Consistent:</span><span>{dataIntegrity.ohlcConsistent ? 'YES' : `NO (${dataIntegrity.ohlcErrors})`}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-sans">CA Adjusted:</span><span>{dataIntegrity.corporateActionAdjusted ? 'YES' : 'UNVERIFIED'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-sans">Active / Freshness:</span><span>{dataIntegrity.activeSymbol ? 'ACTIVE' : 'INACTIVE'} · {dataIntegrity.dataFreshness}</span></div>
              </div>

              <div className="text-[11px] text-slate-500 font-mono pt-1 border-t border-slate-100 dark:border-slate-800">
                Last Updated: {dataIntegrity.lastUpdatedTimestamp} · {dataSourceMeta.dataDelay}
              </div>

              {dataIntegrity.issues.length > 0 && (
                <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-[11px]">
                  {dataIntegrity.issues.join(' ')}
                </div>
              )}
            </div>

            {/* Sections 6, 7, 10: Liquidity, Corporate Action & Multi-Timeframe */}
            <div className="space-y-4">
              {/* Section 6: Liquidity Filter */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100">Section 6: Liquidity Filter</span>
                  <span className={statusBadgeClass(liquidity.status)}>LIQUIDITY: {liquidity.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  <div>History: <strong>{liquidity.tradingDays}d</strong></div>
                  <div>Avg Val: <strong>₹{liquidity.avgDailyTradedValueCr} Cr</strong></div>
                  <div>Avg Vol: <strong>{(liquidity.avgVolume / 100000).toFixed(2)}L</strong></div>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{liquidity.reasons.join(' ')}</div>
              </div>

              {/* Section 7: Corporate Action Engine */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100">Section 7: Corporate Action Status</span>
                  <span className={`font-mono font-semibold text-[11px] ${corporateActionStatus.isProperlyAdjusted ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {corporateActionStatus.statusLabel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{corporateActionStatus.message}</p>
              </div>

              {/* Section 10: Multi-Timeframe Alignment */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100">Section 10: Multi-Timeframe Analysis</span>
                  <span className={statusBadgeClass(mtf.alignment)}>ALIGNMENT: {mtf.alignment}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div><span className="text-slate-500 block">Weekly Trend</span><strong>{mtf.weeklyTrend}</strong></div>
                  <div><span className="text-slate-500 block">Daily Trend</span><strong>{mtf.dailyTrend}</strong></div>
                  <div><span className="text-slate-500 block">{mtf.entryTimeframe}</span><strong>{mtf.entryStatus}</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Signal Summary */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">Rule-Based Signal Engine Verdict (No BUY/SELL Labels)</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
                {primarySignal}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">{primaryReason}</p>
            </div>
            <button
              onClick={() => setSubTab('SETUP ENGINE')}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold shrink-0 cursor-pointer"
            >
              Inspect All Setup Conditions
            </button>
          </div>
        </div>
      )}

      {/* FUNDAMENTALS SUBTAB (Section 11) */}
      {subTab === 'FUNDAMENTALS' && (
        <div className="space-y-5 text-xs">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Section 11: Fundamental Score Engine
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Missing fields are marked N/A and never fabricated; confidence scales accordingly.
                </p>
              </div>
              <div className="text-right font-mono">
                <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  FUNDAMENTAL SCORE: {fundamentalsScore.totalScore}/100
                </div>
                <div className="text-[11px] text-slate-500">
                  Confidence: <strong>{fundamentalsScore.confidence}</strong>
                  {fundamentalsScore.missingFields.length > 0 && ` (${fundamentalsScore.missingFields.length} N/A fields)`}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {Object.entries(fundamentalsScore.components).map(([key, comp]) => (
                <div key={key} className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {comp.score}/{comp.max}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${(comp.score / comp.max) * 100}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono leading-relaxed">
                    {comp.details}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TECHNICALS SUBTAB (Section 9) */}
      {subTab === 'TECHNICALS' && (
        <div className="space-y-6 text-xs">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Section 9: Deterministic Technical Indicator Matrix
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 font-mono tabular-nums">
              {[
                { label: 'Latest Close', val: technicals.latestClose !== null ? `₹${technicals.latestClose}` : 'N/A' },
                { label: 'EMA 20', val: technicals.ema20 !== null ? `₹${technicals.ema20}` : 'N/A' },
                { label: 'EMA 50', val: technicals.ema50 !== null ? `₹${technicals.ema50}` : 'N/A' },
                { label: 'EMA 200', val: technicals.ema200 !== null ? `₹${technicals.ema200}` : 'N/A' },
                { label: 'RSI (14)', val: technicals.rsi14 ?? 'N/A' },
                { label: 'MACD (12,26,9)', val: technicals.macd.line !== null ? `${technicals.macd.line} / ${technicals.macd.signal}` : 'N/A' },
                { label: 'Bollinger (20,2)', val: technicals.bollinger20_2.upper ? `₹${technicals.bollinger20_2.lower} – ₹${technicals.bollinger20_2.upper}` : 'N/A' },
                { label: 'ATR (14)', val: technicals.atr14 !== null ? `₹${technicals.atr14}` : 'N/A' },
                { label: 'ADX (14)', val: technicals.adx14 ?? 'N/A' },
                { label: 'Volume Ratio (20D)', val: technicals.volumeRatio !== null ? `${technicals.volumeRatio}x` : 'N/A' },
                { label: 'VWAP (Intraday)', val: technicals.vwap !== null ? `₹${technicals.vwap}` : 'Unavailable (EOD)' },
                { label: 'Support Zones', val: technicals.supportZones.length ? technicals.supportZones.map((z) => `₹${z}`).join(', ') : 'N/A' },
                { label: 'Resistance Zones', val: technicals.resistanceZones.length ? technicals.resistanceZones.map((z) => `₹${z}`).join(', ') : 'N/A' },
                { label: 'Fib 38.2% / 50% / 61.8%', val: technicals.fibonacci ? `₹${technicals.fibonacci.retracement382} / ₹${technicals.fibonacci.retracement500} / ₹${technicals.fibonacci.retracement618}` : 'N/A' },
                { label: 'BB Compression', val: technicals.bollinger20_2.isCompressed ? 'COMPRESSED' : 'NORMAL' },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                  <div className="font-sans text-[11px] text-slate-500">{item.label}</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 mt-1 text-xs">{item.val}</div>
                </div>
              ))}
            </div>
          </div>

          <StockChart symbol={raw.symbol} candles={raw.candles} technicals={technicals} />
        </div>
      )}

      {/* SETUP ENGINE SUBTAB (Sections 12, 13, 14, 15, 18) */}
      {subTab === 'SETUP ENGINE' && (
        <div className="space-y-5">
          {renderSetupCard(setupA)}
          {renderSetupCard(setupB)}
          {renderSetupCard(setupC)}
        </div>
      )}
    </div>
  );
};

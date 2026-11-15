import React, { useMemo, useState } from 'react';
import {
  AnalyzedStock,
  AppSettings,
  DataSourceMetadata,
  RiskLimitState,
  TradeJournalEntry,
} from '../types/trading';
import { AlertTriangle, Bot, ChevronDown, ChevronUp, Send, Sparkles } from 'lucide-react';

interface AiAnalystViewProps {
  stocks: AnalyzedStock[];
  selectedStock: AnalyzedStock;
  onSelectSymbol: (symbol: string) => void;
  settings: AppSettings;
  dataSourceMeta: DataSourceMetadata;
  riskLimits: RiskLimitState;
  journalEntries: TradeJournalEntry[];
  aiStatus: { available: boolean; modelName: string; message: string };
  initialQuestion?: string | null;
  onClearInitialQuestion?: () => void;
}

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
  timestamp: string;
}

export const AiAnalystView: React.FC<AiAnalystViewProps> = ({
  stocks,
  selectedStock,
  onSelectSymbol,
  settings,
  dataSourceMeta,
  riskLimits,
  journalEntries,
  aiStatus,
  initialQuestion,
  onClearInitialQuestion,
}) => {
  const [structuredReport, setStructuredReport] = useState<string>('');
  const [reportError, setReportError] = useState<string>('');
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [showJsonInspector, setShowJsonInspector] = useState<boolean>(false);

  const [chatInput, setChatInput] = useState<string>(initialQuestion || '');
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: "Friend, let's analyse the setup step by step. All technical indicators, liquidity checks, and risk numbers below are computed deterministically by the application—ask me anything about them!",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  // Section 19: Exact Structured Input JSON to Gemini (never lets AI invent numbers)
  const structuredPayload = useMemo(() => {
    const activeSetup =
      selectedStock.setupA.signalStatus === 'SETUP DETECTED'
        ? selectedStock.setupA
        : selectedStock.setupB.signalStatus === 'SETUP DETECTED'
        ? selectedStock.setupB
        : selectedStock.setupC.signalStatus === 'SETUP DETECTED'
        ? selectedStock.setupC
        : selectedStock.setupA;

    return {
      symbol: selectedStock.raw.symbol,
      exchange: selectedStock.raw.exchange,
      company_name: selectedStock.raw.companyName,
      sector: selectedStock.raw.sector,
      market_cap_category: selectedStock.raw.marketCapCategory,
      data_source: dataSourceMeta.displayLabel,
      data_quality: `${selectedStock.dataIntegrity.status} (${selectedStock.dataIntegrity.dataQualityScore}/100)`,
      data_integrity: {
        number_of_candles: selectedStock.dataIntegrity.numberOfCandles,
        missing_candles: selectedStock.dataIntegrity.missingCandles,
        duplicate_candles: selectedStock.dataIntegrity.duplicateCandles,
        ohlc_consistent: selectedStock.dataIntegrity.ohlcConsistent,
        corporate_action_adjusted: selectedStock.corporateActionStatus.isProperlyAdjusted,
        corporate_action_note: selectedStock.corporateActionStatus.message,
        freshness: selectedStock.dataIntegrity.dataFreshness,
        issues: selectedStock.dataIntegrity.issues,
      },
      liquidity_status: selectedStock.liquidity.status,
      liquidity_details: {
        avg_daily_traded_value_cr: selectedStock.liquidity.avgDailyTradedValueCr,
        avg_volume: selectedStock.liquidity.avgVolume,
        reasons: selectedStock.liquidity.reasons,
      },
      price: selectedStock.technicals.latestClose,
      pct_change: selectedStock.technicals.pctChange,
      ema20: selectedStock.technicals.ema20,
      ema50: selectedStock.technicals.ema50,
      ema200: selectedStock.technicals.ema200,
      rsi: selectedStock.technicals.rsi14,
      macd: selectedStock.technicals.macd.line,
      macd_signal: selectedStock.technicals.macd.signal,
      atr: selectedStock.technicals.atr14,
      adx14: selectedStock.technicals.adx14,
      volume_ratio: selectedStock.technicals.volumeRatio,
      weekly_trend: selectedStock.mtf.weeklyTrend,
      daily_trend: selectedStock.mtf.dailyTrend,
      entry_timeframe: selectedStock.mtf.entryTimeframe,
      trend_alignment: selectedStock.mtf.alignment,
      fundamental_score: selectedStock.fundamentalsScore.totalScore,
      fundamental_confidence: selectedStock.fundamentalsScore.confidence,
      fundamental_missing_fields: selectedStock.fundamentalsScore.missingFields,
      fundamental_breakdown: selectedStock.fundamentalsScore.components,
      setup_status: selectedStock.primarySignal,
      setup_name: activeSetup.setupName,
      failed_conditions: activeSetup.conditions
        .filter((c) => c.status !== 'PASS')
        .map((c) => `${c.label}: ${c.status} (Actual: ${c.actualValue}, Required: ${c.requiredRule})`),
      passed_conditions: activeSetup.conditions
        .filter((c) => c.status === 'PASS')
        .map((c) => `${c.label}: PASS (${c.actualValue})`),
      risk_reward: activeSetup.riskRewardAt2R,
      risk_limit_blocked: riskLimits.blocked,
      risk_limit_reasons: riskLimits.reasons,
      invalidation_condition: activeSetup.invalidationConditions,
      user_risk_limits: {
        capital: settings.risk.capital,
        max_risk_per_trade_pct: settings.risk.maxRiskPerTradePct,
        min_risk_reward: settings.risk.minRiskReward,
        trading_style: settings.tradingStyle,
      },
    };
  }, [selectedStock, dataSourceMeta, riskLimits, settings]);

  const handleGenerateStructuredExplanation = async () => {
    setLoadingReport(true);
    setReportError('');
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredPayload }),
      });
      const data = await res.json();
      if (!res.ok || data.unavailable) {
        setReportError(
          data.error || 'AI analysis temporarily unavailable. Deterministic technical and risk calculations remain available.'
        );
      } else {
        setStructuredReport(data.text);
      }
    } catch {
      setReportError('AI analysis temporarily unavailable. Deterministic technical and risk calculations remain available.');
    } finally {
      setLoadingReport(false);
    }
  };

  const sendChatMessage = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed) return;
    if (initialQuestion) onClearInitialQuestion?.();

    setChatError('');
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: trimmed, timestamp: new Date().toLocaleTimeString() },
    ]);
    setChatInput('');
    setLoadingChat(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          appContextJson: {
            selectedStock: structuredPayload,
            watchlistSummary: stocks.map((s) => ({
              symbol: s.raw.symbol,
              price: s.technicals.latestClose,
              rsi14: s.technicals.rsi14,
              fundamentalScore: s.fundamentalsScore.totalScore,
              liquidity: s.liquidity.status,
              signal: s.primarySignal,
              reason: s.primaryReason,
            })),
            recentJournalTrades: journalEntries.slice(0, 20),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.unavailable) {
        setChatError(
          data.error || 'AI analysis temporarily unavailable. Deterministic technical and risk calculations remain available.'
        );
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: data.text, timestamp: new Date().toLocaleTimeString() },
        ]);
      }
    } catch {
      setChatError('AI analysis temporarily unavailable. Deterministic technical and risk calculations remain available.');
    } finally {
      setLoadingChat(false);
    }
  };

  const starterPrompts = [
    'Friend, explain this setup step by step.',
    'Friend, why did this stock fail or pass the filter?',
    'Friend, explain RSI and EMA alignment here in simple language.',
    'Friend, what is the exact risk and invalidation in this setup?',
    'Friend, review my recent journal trades for discipline and mistakes.',
  ];

  return (
    <div className="space-y-6">
      {/* AI Configuration & Graceful Availability Disclosure (Section 3 & 19) */}
      <div
        className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
          aiStatus.available
            ? 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100'
            : 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-100'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {aiStatus.available ? (
            <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <div>
            <strong>Gemini Explanation Layer (Server-Side Proxy):</strong> {aiStatus.message}
          </div>
        </div>
        <span className="font-mono text-[11px] shrink-0">Model: {aiStatus.modelName}</span>
      </div>

      {/* Stock Context Selector + JSON Inspector */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Active Stock Context:</label>
            <select
              value={selectedStock.raw.symbol}
              onChange={(e) => onSelectSymbol(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono font-bold"
            >
              {stocks.map((s) => (
                <option key={s.raw.symbol} value={s.raw.symbol}>
                  {s.raw.symbol} ({s.primarySignal})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowJsonInspector((v) => !v)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs inline-flex items-center gap-1 cursor-pointer"
            >
              {showJsonInspector ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Inspect Deterministic Input JSON
            </button>
            <button
              onClick={handleGenerateStructuredExplanation}
              disabled={loadingReport}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {loadingReport ? 'Analyzing JSON...' : 'Generate Structured Explanation'}
            </button>
          </div>
        </div>

        {showJsonInspector && (
          <pre className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-[11px] font-mono overflow-x-auto max-h-64 text-slate-700 dark:text-slate-300">
            {JSON.stringify(structuredPayload, null, 2)}
          </pre>
        )}
      </div>

      {/* Main Split: Section 39 Structured Report & Section 21 Interactive Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Structured Research Output (Section 39) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Structured AI Explanation (Section 39 Format)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Separates verified facts from educational interpretation. Never modifies deterministic numbers or outputs BUY/SELL.
            </p>
          </div>

          {reportError && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200">
              {reportError}
            </div>
          )}

          {structuredReport ? (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-xs whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200 font-sans max-h-[520px] overflow-y-auto">
              {structuredReport}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <p>Click <strong>"Generate Structured Explanation"</strong> to receive Gemini's Section 39 breakdown of {selectedStock.raw.symbol}.</p>
              <p className="font-mono text-[11px]">
                Pre-computed summary: {selectedStock.primarySignal} · Liquidity {selectedStock.liquidity.status} · Fund {selectedStock.fundamentalsScore.totalScore}/100
              </p>
            </div>
          )}
        </div>

        {/* Friendly Conversation Assistant (Section 21) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              AI Research Partner (Conversation Mode)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ask natural questions grounded strictly in your verified watchlist, stock, and journal JSON.
            </p>
          </div>

          {/* Messages */}
          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`rounded-lg p-3 whitespace-pre-wrap ${
                  m.role === 'assistant'
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                    : 'bg-emerald-600 text-white ml-8'
                }`}
              >
                <div className="text-[10px] opacity-70 mb-1 font-mono">
                  {m.role === 'assistant' ? 'SMART TRADER AI' : 'YOU'} · {m.timestamp}
                </div>
                {m.text}
              </div>
            ))}
            {loadingChat && (
              <div className="rounded-lg p-3 bg-slate-100 dark:bg-slate-800/60 text-slate-500 font-mono text-[11px]">
                Reviewing deterministic JSON and formulating explanation...
              </div>
            )}
          </div>

          {chatError && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200">
              {chatError}
            </div>
          )}

          {/* Quick Starter Prompts */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {starterPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendChatMessage(p)}
                  disabled={loadingChat}
                  className="text-[11px] px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {p}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendChatMessage(chatInput);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask your research partner (e.g. Friend, why did this setup pass or fail?)..."
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={loadingChat || !chatInput.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Ask
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

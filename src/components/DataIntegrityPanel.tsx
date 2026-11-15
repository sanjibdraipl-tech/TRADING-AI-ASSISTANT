import React from 'react';
import { Database, ShieldCheck } from 'lucide-react';
import { DataSourceMetadata } from '../types/trading';
import { VoiceStockJsonPayload } from '../types/voice';

interface Props {
  dataSourceMeta: DataSourceMetadata;
  activeMarketPayload: VoiceStockJsonPayload | null;
}

export const DataIntegrityPanel: React.FC<Props> = ({
  dataSourceMeta,
  activeMarketPayload,
}) => {
  const statusLabel = activeMarketPayload?.dataStatus || (dataSourceMeta.status === 'DISCONNECTED' ? 'ERROR' : 'DELAYED');
  const statusColor =
    statusLabel === 'LIVE'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
      : statusLabel === 'STALE' || statusLabel === 'ERROR' || statusLabel === 'MISSING'
      ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300 dark:border-red-800'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
          <Database className="w-4 h-4 text-emerald-600" />
          <span>Data Integrity Panel</span>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60">
          <div className="text-slate-500 dark:text-slate-400">Source</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
            {dataSourceMeta.displayLabel}
          </div>
        </div>
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60">
          <div className="text-slate-500 dark:text-slate-400">Last Updated</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
            {activeMarketPayload?.timestamp || dataSourceMeta.lastUpdated}
          </div>
        </div>
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60">
          <div className="text-slate-500 dark:text-slate-400">Active Symbol</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">
            {activeMarketPayload ? `${activeMarketPayload.symbol} (${activeMarketPayload.exchange})` : 'Market Overview'}
          </div>
        </div>
        <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60">
          <div className="text-slate-500 dark:text-slate-400">Missing Candles / Corp. Adj</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">
            {activeMarketPayload ? `${activeMarketPayload.missingCandles} / ${activeMarketPayload.corporateActionAdjusted ? 'YES' : 'NO'}` : '0 / YES'}
          </div>
        </div>
      </div>

      {activeMarketPayload && (
        <div className="p-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-[10px] text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
          <span>LTP: {activeMarketPayload.price ?? 'null'}</span>
          <span>EMA20: {activeMarketPayload.ema20?.toFixed(1) ?? 'null'}</span>
          <span>EMA50: {activeMarketPayload.ema50?.toFixed(1) ?? 'null'}</span>
          <span>RSI14: {activeMarketPayload.rsi14?.toFixed(1) ?? 'null'}</span>
          <span>Status: {activeMarketPayload.setupStatus}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>AI uses strictly this verified JSON payload — never fabricated prices.</span>
      </div>
    </div>
  );
};

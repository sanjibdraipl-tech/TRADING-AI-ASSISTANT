import React, { useMemo, useState } from 'react';
import { AnalyzedStock, Exchange, UniverseBucket } from '../types/trading';
import { CSVDataProvider } from '../data/providers/MarketDataProvider';
import { exportToCsv, exportToJson } from '../utils/exportUtils';
import { Download, Search, Upload, AlertCircle } from 'lucide-react';

interface WatchlistViewProps {
  stocks: AnalyzedStock[];
  onSelectStock: (symbol: string) => void;
  onImportCsvStock: (stock: ReturnType<typeof CSVDataProvider.parseCsvToStock>) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  stocks,
  onSelectStock,
  onImportCsvStock,
}) => {
  const [search, setSearch] = useState('');
  const [universeFilter, setUniverseFilter] = useState<'ALL' | UniverseBucket>('ALL');
  const [exchangeFilter, setExchangeFilter] = useState<'ALL' | Exchange>('ALL');
  const [capFilter, setCapFilter] = useState<'ALL' | 'Large Cap' | 'Mid Cap' | 'Small Cap'>('ALL');
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');
  const [minFundFilter, setMinFundFilter] = useState<number>(0);
  const [rsiFilter, setRsiFilter] = useState<'ALL' | 'BELOW_40' | '40_70' | 'ABOVE_70'>('ALL');
  const [emaTrendFilter, setEmaTrendFilter] = useState<'ALL' | 'ABOVE_200' | 'BULL_STACK'>('ALL');
  const [volFilter, setVolFilter] = useState<'ALL' | 'HIGH_VOL'>('ALL');
  const [liqFilter, setLiqFilter] = useState<'ALL' | 'PASS' | 'FAIL'>('ALL');
  const [setupFilter, setSetupFilter] = useState<'ALL' | 'SETUP_DETECTED' | 'WATCH_WAIT'>('ALL');
  const [showAllRows, setShowAllRows] = useState<boolean>(false);

  // CSV Import Modal state
  const [showImport, setShowImport] = useState(false);
  const [csvSymbol, setCsvSymbol] = useState('MYSTOCK');
  const [csvExchange, setCsvExchange] = useState<Exchange>('NSE');
  const [csvError, setCsvError] = useState<string | null>(null);

  const sectors = useMemo(() => Array.from(new Set(stocks.map((s) => s.raw.sector))), [stocks]);

  const filtered = useMemo(() => {
    return stocks.filter((s) => {
      if (
        search &&
        !s.raw.symbol.toLowerCase().includes(search.toLowerCase()) &&
        !s.raw.companyName.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (universeFilter !== 'ALL' && !s.raw.universeBuckets?.includes(universeFilter)) return false;
      if (exchangeFilter !== 'ALL' && s.raw.exchange !== exchangeFilter) return false;
      if (capFilter !== 'ALL' && s.raw.marketCapCategory !== capFilter) return false;
      if (sectorFilter !== 'ALL' && s.raw.sector !== sectorFilter) return false;
      if (s.fundamentalsScore.totalScore < minFundFilter) return false;

      const rsi = s.technicals.rsi14;
      if (rsiFilter === 'BELOW_40' && (rsi === null || rsi >= 40)) return false;
      if (rsiFilter === '40_70' && (rsi === null || rsi < 40 || rsi > 70)) return false;
      if (rsiFilter === 'ABOVE_70' && (rsi === null || rsi <= 70)) return false;

      const { latestClose, ema20, ema50, ema200 } = s.technicals;
      if (emaTrendFilter === 'ABOVE_200' && (!latestClose || !ema200 || latestClose <= ema200)) return false;
      if (
        emaTrendFilter === 'BULL_STACK' &&
        (!latestClose || !ema20 || !ema50 || !ema200 || !(latestClose > ema20 && ema20 > ema50 && ema50 > ema200))
      ) {
        return false;
      }

      if (volFilter === 'HIGH_VOL' && (s.technicals.volumeRatio === null || s.technicals.volumeRatio < 1.2)) return false;
      if (liqFilter !== 'ALL' && s.liquidity.status !== liqFilter) return false;
      if (setupFilter === 'SETUP_DETECTED' && s.primarySignal !== 'SETUP DETECTED') return false;
      if (
        setupFilter === 'WATCH_WAIT' &&
        s.primarySignal !== 'WATCH' &&
        s.primarySignal !== 'WAIT FOR CONFIRMATION'
      ) {
        return false;
      }

      return true;
    });
  }, [
    stocks,
    search,
    universeFilter,
    exchangeFilter,
    capFilter,
    sectorFilter,
    minFundFilter,
    rsiFilter,
    emaTrendFilter,
    volFilter,
    liqFilter,
    setupFilter,
  ]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = CSVDataProvider.parseCsvToStock(text, csvSymbol, csvExchange);
        onImportCsvStock(parsed);
        setShowImport(false);
      } catch (err: any) {
        setCsvError(err?.message || 'Failed to parse CSV.');
      }
    };
    reader.readAsText(file);
  };

  const buildExportRows = () =>
    filtered.map((s) => ({
      Symbol: s.raw.symbol,
      Exchange: s.raw.exchange,
      Company: s.raw.companyName,
      Sector: s.raw.sector,
      MarketCapCategory: s.raw.marketCapCategory,
      CurrentPrice: s.technicals.latestClose ?? 'N/A',
      PctChange: s.technicals.pctChange ?? 'N/A',
      Volume: s.technicals.latestVolume ?? 'N/A',
      VolumeRatio: s.technicals.volumeRatio ?? 'N/A',
      RSI14: s.technicals.rsi14 ?? 'N/A',
      EMA20: s.technicals.ema20 ?? 'N/A',
      EMA50: s.technicals.ema50 ?? 'N/A',
      EMA200: s.technicals.ema200 ?? 'N/A',
      FundamentalScore: s.fundamentalsScore.totalScore,
      LiquidityStatus: s.liquidity.status,
      DataQuality: s.dataIntegrity.status,
      SetupStatus: s.primarySignal,
    }));

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Stock Watchlist ({filtered.length} of {stocks.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All indicators computed deterministically in-browser. Import verified CSV OHLCV data anytime.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setShowImport(!showImport)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Import CSV OHLCV
            </button>
            <button
              onClick={() => exportToCsv(buildExportRows(), 'smart_trader_watchlist.csv', true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Excel CSV
            </button>
            <button
              onClick={() => exportToJson(buildExportRows(), 'smart_trader_watchlist.json')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium cursor-pointer"
            >
              Export JSON
            </button>
          </div>
        </div>

        {/* Optional CSV Importer Drawer */}
        {showImport && (
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 space-y-3 text-xs">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              Import CSVDataProvider File (Columns: Date, Open, High, Low, Close, Volume)
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={csvSymbol}
                onChange={(e) => setCsvSymbol(e.target.value.toUpperCase())}
                placeholder="Symbol (e.g. INFY)"
                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
              />
              <select
                value={csvExchange}
                onChange={(e) => setCsvExchange(e.target.value as Exchange)}
                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="text-xs text-slate-600 dark:text-slate-300"
              />
            </div>
            {csvError && (
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{csvError}</span>
              </div>
            )}
          </div>
        )}

        {/* Filter Bar (Section 8) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 text-xs">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbol..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={universeFilter}
            onChange={(e) => setUniverseFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium"
          >
            <option value="ALL">Index: All ({stocks.length})</option>
            <option value="NIFTY 50">NIFTY 50 (Core 50)</option>
            <option value="NIFTY MIDCAP 150">NIFTY MIDCAP 150 (Active 50)</option>
            <option value="NIFTY SMALLCAP 250">NIFTY SMALLCAP 250 (Starter 50)</option>
          </select>

          <select
            value={exchangeFilter}
            onChange={(e) => setExchangeFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="ALL">Exchange: All</option>
            <option value="NSE">NSE Only</option>
            <option value="BSE">BSE Only</option>
          </select>

          <select
            value={capFilter}
            onChange={(e) => setCapFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="ALL">Cap: All</option>
            <option value="Large Cap">Large Cap</option>
            <option value="Mid Cap">Mid Cap</option>
            <option value="Small Cap">Small Cap</option>
          </select>

          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="ALL">Sector: All</option>
            {sectors.map((sec) => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>

          <select
            value={emaTrendFilter}
            onChange={(e) => setEmaTrendFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="ALL">EMA Trend: All</option>
            <option value="ABOVE_200">Above EMA200</option>
            <option value="BULL_STACK">Bullish (C &gt; 20 &gt; 50 &gt; 200)</option>
          </select>

          <select
            value={setupFilter}
            onChange={(e) => setSetupFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="ALL">Setup: All</option>
            <option value="SETUP_DETECTED">SETUP DETECTED</option>
            <option value="WATCH_WAIT">WATCH / WAIT</option>
          </select>

          <select
            value={rsiFilter}
            onChange={(e) => setRsiFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="ALL">RSI: All</option>
            <option value="BELOW_40">RSI &lt; 40</option>
            <option value="40_70">RSI 40–70</option>
            <option value="ABOVE_70">RSI &gt; 70</option>
          </select>

          <select
            value={volFilter}
            onChange={(e) => setVolFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="ALL">Volume: All</option>
            <option value="HIGH_VOL">Vol Ratio &gt;= 1.2x</option>
          </select>

          <select
            value={liqFilter}
            onChange={(e) => setLiqFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value="ALL">Liquidity: All</option>
            <option value="PASS">PASS Only</option>
            <option value="FAIL">FAIL Only</option>
          </select>

          <select
            value={minFundFilter}
            onChange={(e) => setMinFundFilter(Number(e.target.value))}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          >
            <option value={0}>Fund. Score: All</option>
            <option value={60}>Fund. Score &gt;= 60</option>
            <option value={75}>Fund. Score &gt;= 75</option>
          </select>
        </div>
      </div>

      {/* Watchlist Table (Section 8 exact fields) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-3 font-semibold">Symbol / Exchange</th>
                <th className="py-3 px-3 font-semibold">Sector / Cap</th>
                <th className="py-3 px-3 font-semibold text-right">Price (₹)</th>
                <th className="py-3 px-3 font-semibold text-right">% Chg</th>
                <th className="py-3 px-3 font-semibold text-right">Vol / Ratio</th>
                <th className="py-3 px-3 font-semibold text-right">RSI</th>
                <th className="py-3 px-3 font-semibold text-right">EMA 20 / 50 / 200</th>
                <th className="py-3 px-3 font-semibold text-right">Fund.</th>
                <th className="py-3 px-3 font-semibold">Risk / Liq</th>
                <th className="py-3 px-3 font-semibold">Setup Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono tabular-nums">
              {(showAllRows ? filtered : filtered.slice(0, 50)).map((s) => {
                const t = s.technicals;
                return (
                  <tr
                    key={s.raw.symbol}
                    onClick={() => onSelectStock(s.raw.symbol)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{s.raw.symbol}</div>
                      <div className="font-sans text-[11px] text-slate-500 truncate max-w-[160px]">
                        {s.raw.exchange} · {s.raw.universeBuckets?.join(', ') || s.raw.companyName}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <div className="text-slate-700 dark:text-slate-300">{s.raw.sector}</div>
                      <div className="text-[11px] text-slate-500">{s.raw.marketCapCategory}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                      {t.latestClose !== null ? `₹${t.latestClose.toFixed(2)}` : 'N/A'}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-semibold ${
                        (t.pctChange || 0) >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {t.pctChange !== null ? `${t.pctChange >= 0 ? '+' : ''}${t.pctChange}%` : 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                      <div>{t.latestVolume !== null ? `${(t.latestVolume / 100000).toFixed(1)}L` : 'N/A'}</div>
                      <div className="text-[11px] text-slate-500">{t.volumeRatio !== null ? `${t.volumeRatio}x` : 'N/A'}</div>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-800 dark:text-slate-200">
                      {t.rsi14 ?? 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-right text-[11px] text-slate-600 dark:text-slate-400">
                      {t.ema20?.toFixed(0) ?? 'N/A'} / {t.ema50?.toFixed(0) ?? 'N/A'} / {t.ema200?.toFixed(0) ?? 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                      {s.fundamentalsScore.totalScore}/100
                    </td>
                    <td className="py-3 px-3 font-sans text-[11px]">
                      <div
                        className={`font-semibold ${
                          s.liquidity.status === 'PASS'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : s.liquidity.status === 'WARNING'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        Liq: {s.liquidity.status} {s.liquidity.strictModeApplied ? '(Strict SC)' : ''}
                      </div>
                      <div className="text-slate-500">Data: {s.dataIntegrity.status}</div>
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <span
                        className={`font-bold text-[11px] ${
                          s.primarySignal === 'SETUP DETECTED'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : s.primarySignal === 'WAIT FOR CONFIRMATION' || s.primarySignal === 'WATCH'
                            ? 'text-amber-600 dark:text-amber-400'
                            : s.primarySignal === 'RISK TOO HIGH' || s.primarySignal === 'INVALID'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {s.primarySignal}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 50 && (
          <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-950/60">
            <span className="text-slate-500">
              Showing {showAllRows ? filtered.length : 50} of {filtered.length} matching stocks
            </span>
            <button
              onClick={() => setShowAllRows((v) => !v)}
              className="px-3 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium cursor-pointer"
            >
              {showAllRows ? 'Show First 50' : `Show All ${filtered.length} Rows`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

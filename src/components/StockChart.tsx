import React, { useMemo, useState } from 'react';
import { TechnicalIndicators, OHLCVCandle } from '../types/trading';

interface StockChartProps {
  symbol: string;
  candles: OHLCVCandle[];
  technicals: TechnicalIndicators;
}

export const StockChart: React.FC<StockChartProps> = ({ symbol, candles, technicals }) => {
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showEma200, setShowEma200] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [showSR, setShowSR] = useState(true);
  const [subMode, setSubMode] = useState<'volume' | 'rsi' | 'macd'>('volume');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Display trailing 90 sessions for crisp readability
  const visibleCount = Math.min(90, candles.length);
  const offset = Math.max(0, candles.length - visibleCount);
  const visibleCandles = useMemo(() => candles.slice(offset), [candles, offset]);

  const width = 920;
  const mainH = 300;
  const subH = 100;
  const pad = { top: 18, right: 68, bottom: 20, left: 12 };
  const innerW = width - pad.left - pad.right;

  const { minP, maxP, maxVol } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    let mv = 1;
    visibleCandles.forEach((c, idx) => {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (c.volume > mv) mv = c.volume;
      const gi = offset + idx;
      const e200 = technicals.ema200Series[gi];
      if (showEma200 && e200 !== null && e200 !== undefined) {
        if (e200 < min) min = e200;
        if (e200 > max) max = e200;
      }
    });
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { minP: 0, maxP: 100, maxVol: 1 };
    }
    const buf = (max - min) * 0.06 || 5;
    return { minP: min - buf, maxP: max + buf, maxVol: mv };
  }, [visibleCandles, offset, technicals.ema200Series, showEma200]);

  if (visibleCandles.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
        No price candles available for {symbol}.
      </div>
    );
  }

  const slotW = innerW / visibleCandles.length;
  const bodyW = Math.max(2.5, slotW * 0.62);
  const pRange = maxP - minP || 1;
  const getY = (p: number) => pad.top + (1 - (p - minP) / pRange) * (mainH - pad.top - pad.bottom);
  const getX = (i: number) => pad.left + i * slotW + slotW / 2;

  const buildPolyline = (series: (number | null)[]) =>
    visibleCandles
      .map((_, i) => {
        const val = series[offset + i];
        if (val === null || val === undefined) return null;
        return `${getX(i).toFixed(1)},${getY(val).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(' ');

  const activeCandle = hoverIdx !== null ? visibleCandles[hoverIdx] : visibleCandles[visibleCandles.length - 1];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-[11px]">
          <span className="font-sans font-semibold text-slate-600 dark:text-slate-300">
            {symbol} · {activeCandle.timestamp}
          </span>
          <span>O <strong className="text-slate-900 dark:text-slate-100">₹{activeCandle.open.toFixed(2)}</strong></span>
          <span>H <strong className="text-slate-900 dark:text-slate-100">₹{activeCandle.high.toFixed(2)}</strong></span>
          <span>L <strong className="text-slate-900 dark:text-slate-100">₹{activeCandle.low.toFixed(2)}</strong></span>
          <span>
            C{' '}
            <strong className={activeCandle.close >= activeCandle.open ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
              ₹{activeCandle.close.toFixed(2)}
            </strong>
          </span>
          <span className="text-slate-500">Vol {(activeCandle.volume / 100000).toFixed(2)}L</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { label: 'EMA20', active: showEma20, toggle: () => setShowEma20(!showEma20), color: 'text-sky-600 dark:text-sky-400' },
            { label: 'EMA50', active: showEma50, toggle: () => setShowEma50(!showEma50), color: 'text-amber-600 dark:text-amber-400' },
            { label: 'EMA200', active: showEma200, toggle: () => setShowEma200(!showEma200), color: 'text-violet-600 dark:text-violet-400' },
            { label: 'S/R Zones', active: showSR, toggle: () => setShowSR(!showSR), color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'BB(20,2)', active: showBB, toggle: () => setShowBB(!showBB), color: 'text-cyan-600 dark:text-cyan-400' },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.toggle}
              className={`px-2 py-1 rounded text-[11px] font-mono font-medium border transition-colors cursor-pointer ${
                btn.active
                  ? `bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 ${btn.color}`
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {btn.label}
            </button>
          ))}

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

          <div className="flex bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-md">
            {(['volume', 'rsi', 'macd'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSubMode(m)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium uppercase cursor-pointer transition-colors ${
                  subMode === m
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${mainH + subH}`}
          className="w-full h-auto min-w-[680px] block select-none"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Price Grid Lines */}
          {[0.2, 0.4, 0.6, 0.8].map((pct, i) => {
            const y = pad.top + pct * (mainH - pad.top - pad.bottom);
            const val = maxP - pct * pRange;
            return (
              <g key={i}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={width - pad.right}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeDasharray="3 3"
                />
                <text x={width - pad.right + 6} y={y + 3} className="fill-slate-400 font-mono text-[10px]">
                  ₹{val.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Support / Resistance Horizontal Lines */}
          {showSR && (
            <g>
              {technicals.resistanceZones.slice(0, 2).map((r, i) => {
                const y = getY(r);
                if (y < pad.top || y > mainH - pad.bottom) return null;
                return (
                  <g key={`r-${i}`}>
                    <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#f43f5e" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
                    <text x={width - pad.right + 6} y={y + 3} className="fill-rose-500 font-mono text-[9px] font-semibold">
                      R{i + 1} ₹{r.toFixed(0)}
                    </text>
                  </g>
                );
              })}
              {technicals.supportZones.slice(0, 2).map((s, i) => {
                const y = getY(s);
                if (y < pad.top || y > mainH - pad.bottom) return null;
                return (
                  <g key={`s-${i}`}>
                    <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#10b981" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
                    <text x={width - pad.right + 6} y={y + 3} className="fill-emerald-500 font-mono text-[9px] font-semibold">
                      S{i + 1} ₹{s.toFixed(0)}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Bollinger Reference Levels */}
          {showBB && technicals.bollinger20_2.upper && technicals.bollinger20_2.lower && (
            <g>
              <line
                x1={pad.left}
                y1={getY(technicals.bollinger20_2.upper)}
                x2={width - pad.right}
                y2={getY(technicals.bollinger20_2.upper)}
                stroke="#06b6d4"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <line
                x1={pad.left}
                y1={getY(technicals.bollinger20_2.lower)}
                x2={width - pad.right}
                y2={getY(technicals.bollinger20_2.lower)}
                stroke="#06b6d4"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            </g>
          )}

          {/* EMAs */}
          {showEma200 && <polyline fill="none" stroke="#8b5cf6" strokeWidth="1.5" points={buildPolyline(technicals.ema200Series)} opacity="0.85" />}
          {showEma50 && <polyline fill="none" stroke="#f59e0b" strokeWidth="1.5" points={buildPolyline(technicals.ema50Series)} opacity="0.9" />}
          {showEma20 && <polyline fill="none" stroke="#0ea5e9" strokeWidth="1.5" points={buildPolyline(technicals.ema20Series)} opacity="0.95" />}

          {/* Candlesticks */}
          {visibleCandles.map((c, i) => {
            const x = getX(i);
            const up = c.close >= c.open;
            const color = up ? '#10b981' : '#f43f5e';
            const top = Math.min(getY(c.open), getY(c.close));
            const h = Math.max(1.8, Math.abs(getY(c.close) - getY(c.open)));

            return (
              <g key={c.timestamp} onMouseEnter={() => setHoverIdx(i)} className="cursor-crosshair">
                <line x1={x} y1={getY(c.high)} x2={x} y2={getY(c.low)} stroke={color} strokeWidth="1.1" />
                <rect x={x - bodyW / 2} y={top} width={bodyW} height={h} fill={color} rx="0.5" />
              </g>
            );
          })}

          {/* Separator */}
          <line x1={pad.left} y1={mainH} x2={width - pad.right} y2={mainH} className="stroke-slate-200 dark:stroke-slate-800" />

          {/* Subchart */}
          {subMode === 'volume' && (
            <g transform={`translate(0, ${mainH})`}>
              <text x={pad.left + 4} y={14} className="fill-slate-400 font-mono text-[9px]">
                VOLUME · 20D AVG: {technicals.avgVolume20 ? (technicals.avgVolume20 / 100000).toFixed(2) + 'L' : 'N/A'}
              </text>
              {visibleCandles.map((c, i) => {
                const bh = (c.volume / maxVol) * (subH - 22);
                return (
                  <rect
                    key={`v-${i}`}
                    x={getX(i) - bodyW / 2}
                    y={subH - 6 - bh}
                    width={bodyW}
                    height={Math.max(1, bh)}
                    fill={c.close >= c.open ? '#10b981' : '#f43f5e'}
                    opacity={hoverIdx === i ? 1 : 0.6}
                  />
                );
              })}
            </g>
          )}

          {subMode === 'rsi' && (
            <g transform={`translate(0, ${mainH})`}>
              <line x1={pad.left} y1={24} x2={width - pad.right} y2={24} stroke="#f43f5e" strokeDasharray="2 2" strokeWidth="0.8" />
              <text x={width - pad.right + 6} y={27} className="fill-rose-400 font-mono text-[9px]">70</text>
              <line x1={pad.left} y1={subH - 20} x2={width - pad.right} y2={subH - 20} stroke="#10b981" strokeDasharray="2 2" strokeWidth="0.8" />
              <text x={width - pad.right + 6} y={subH - 17} className="fill-emerald-400 font-mono text-[9px]">30</text>
              <text x={pad.left + 4} y={13} className="fill-indigo-400 font-mono text-[9px]">
                RSI (14): {technicals.rsi14 ?? 'N/A'}
              </text>
              <polyline
                fill="none"
                stroke="#6366f1"
                strokeWidth="1.5"
                points={visibleCandles
                  .map((_, i) => {
                    const r = technicals.rsiSeries[offset + i];
                    if (r === null || r === undefined) return null;
                    const y = 12 + ((100 - r) / 100) * (subH - 20);
                    return `${getX(i).toFixed(1)},${y.toFixed(1)}`;
                  })
                  .filter(Boolean)
                  .join(' ')}
              />
            </g>
          )}

          {subMode === 'macd' && (
            <g transform={`translate(0, ${mainH})`}>
              <line x1={pad.left} y1={subH / 2 + 4} x2={width - pad.right} y2={subH / 2 + 4} className="stroke-slate-300 dark:stroke-slate-700" />
              <text x={pad.left + 4} y={13} className="fill-sky-400 font-mono text-[9px]">
                MACD (12,26,9): {technicals.macd.line ?? 'N/A'} | Sig: {technicals.macd.signal ?? 'N/A'}
              </text>
              {(() => {
                const hists = visibleCandles.map((_, i) => technicals.macd.series[offset + i]?.hist ?? 0);
                const maxH = Math.max(1, ...hists.map(Math.abs));
                return hists.map((h, i) => {
                  const barH = (Math.abs(h) / maxH) * (subH / 2 - 14);
                  const y = h >= 0 ? subH / 2 + 4 - barH : subH / 2 + 4;
                  return (
                    <rect
                      key={`m-${i}`}
                      x={getX(i) - bodyW / 2}
                      y={y}
                      width={bodyW}
                      height={Math.max(1, barH)}
                      fill={h >= 0 ? '#0ea5e9' : '#f43f5e'}
                      opacity="0.75"
                    />
                  );
                });
              })()}
            </g>
          )}

          {hoverIdx !== null && (
            <line
              x1={getX(hoverIdx)}
              y1={pad.top}
              x2={getX(hoverIdx)}
              y2={mainH + subH - 6}
              className="stroke-slate-400"
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
          )}
        </svg>
      </div>
    </div>
  );
};

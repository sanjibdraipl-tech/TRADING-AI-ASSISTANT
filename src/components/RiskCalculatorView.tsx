import React, { useState } from 'react';
import { AppSettings, RiskLimitState } from '../types/trading';
import { calculateDeterministicRisk } from '../engines/riskEngine';
import { Calculator, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface RiskCalculatorViewProps {
  settings: AppSettings;
  riskLimits: RiskLimitState;
}

export const RiskCalculatorView: React.FC<RiskCalculatorViewProps> = ({ settings, riskLimits }) => {
  const [capital, setCapital] = useState(settings.risk.capital);
  const [riskPct, setRiskPct] = useState(settings.risk.maxRiskPerTradePct);
  const [entry, setEntry] = useState(1250);
  const [stopLoss, setStopLoss] = useState(1210);
  const [includeCharges, setIncludeCharges] = useState(true);

  const calc = calculateDeterministicRisk(
    capital,
    riskPct,
    entry,
    stopLoss,
    settings.risk.maxSingleStockExposurePct,
    includeCharges
  );

  return (
    <div className="space-y-6 text-xs">
      {/* Section 17 Risk Controls Blocker Banner */}
      <div
        className={`rounded-xl border p-4 flex items-start gap-3 ${
          riskLimits.blocked
            ? 'border-rose-500/40 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200'
            : 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200'
        }`}
      >
        {riskLimits.blocked ? (
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
        )}
        <div className="space-y-1">
          <div className="font-bold text-sm">
            {riskLimits.blocked
              ? 'BLOCK NEW SETUPS: Risk limit reached. No new trade should be initiated until the configured reset condition is satisfied.'
              : 'Section 17 Risk Controls: ACTIVE & WITHIN SAFE BOUNDARIES'}
          </div>
          <div className="font-mono text-[11px] flex flex-wrap gap-4">
            <span>Daily Loss Used: {riskLimits.dailyLossUsedPct}% / {settings.risk.maxDailyLossPct}%</span>
            <span>Weekly Loss Used: {riskLimits.weeklyLossUsedPct}% / {settings.risk.maxWeeklyLossPct}%</span>
            <span>Open Positions: {riskLimits.openPositionsCount} / {settings.risk.maxOpenPositions}</span>
            <span>Portfolio Exposure: {riskLimits.portfolioExposurePct}% / {settings.risk.maxPortfolioExposurePct}%</span>
          </div>
          {riskLimits.reasons.length > 0 && (
            <div className="font-mono text-[11px] font-semibold">{riskLimits.reasons.join(' | ')}</div>
          )}
        </div>
      </div>

      {/* Section 16 Dedicated Risk Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Calculator className="w-5 h-5 text-emerald-500" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Section 16: Deterministic Risk Calculator
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                Quantity = floor((Capital × Risk %) ÷ |Entry − Stop Loss|). Never increased by AI confidence.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Trading Capital (₹)</label>
              <input
                type="number"
                value={capital}
                onChange={(e) => setCapital(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Risk Per Trade (%)</label>
              <input
                type="number"
                step="0.25"
                value={riskPct}
                onChange={(e) => setRiskPct(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Entry Price (₹)</label>
              <input
                type="number"
                step="0.5"
                value={entry}
                onChange={(e) => setEntry(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Stop-Loss Price (₹)</label>
              <input
                type="number"
                step="0.5"
                value={stopLoss}
                onChange={(e) => setStopLoss(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={includeCharges}
              onChange={(e) => setIncludeCharges(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>Include estimated Indian delivery brokerage/STT/exchange/GST/stamp charges</span>
          </label>
        </div>

        {/* Outputs */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-3">
            Calculated Position & R-Multiple Ladder
          </h3>

          {!calc.valid ? (
            <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-medium">
              {calc.error}
            </div>
          ) : (
            <div className="space-y-3 font-mono tabular-nums">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="font-sans text-[11px] text-slate-500">Valid Whole Quantity</div>
                  <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {calc.quantity} shares
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="font-sans text-[11px] text-slate-500">Position Value</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    ₹{calc.positionValue.toLocaleString('en-IN')}
                  </div>
                  <div className="font-sans text-[10px] text-slate-500">{calc.totalCapitalPct}% of capital</div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs pt-2">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-sans text-slate-500">Risk Budget ({riskPct}%):</span>
                  <span className="font-semibold">₹{calc.riskAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-sans text-slate-500">Risk Per Share:</span>
                  <span className="font-semibold text-rose-500">₹{calc.riskPerShare.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-sans text-slate-500">Maximum Planned Loss:</span>
                  <span className="font-semibold text-rose-500">₹{calc.maxPlannedLoss.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-sans text-slate-500">Estimated Transaction Costs (2R roundtrip):</span>
                  <span className="font-semibold">₹{calc.estimatedCharges.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-sans text-slate-500">1R / 2R / 3R Price Levels:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{calc.oneRPrice} / ₹{calc.twoRPrice} / ₹{calc.threeRPrice}
                  </span>
                </div>
              </div>

              {calc.exceedsSingleStockLimit && (
                <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-sans text-[11px]">
                  Warning: Position value ({calc.totalCapitalPct}%) exceeds configured max single-stock exposure ({settings.risk.maxSingleStockExposurePct}%).
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import { FundamentalInput, FundamentalScoreBreakdown } from '../types/trading';

/**
 * Section 11: Fundamental Score Engine (100 Points Total)
 * Growth: 25 | Profitability: 25 | Balance Sheet: 20 | Valuation: 15 | Ownership/Governance: 15
 * Never invents missing fundamentals; marks missing fields as N/A and lowers confidence.
 */
export function evaluateFundamentalScore(f: FundamentalInput): FundamentalScoreBreakdown {
  const missingFields: string[] = [];

  // 1. Growth (25 pts): Sales growth (12.5) + Profit growth (12.5)
  let growthScore = 0;
  const salesText = f.salesGrowthYoY === null ? 'N/A' : `${f.salesGrowthYoY}%`;
  const profitText = f.profitGrowthYoY === null ? 'N/A' : `${f.profitGrowthYoY}%`;

  if (f.salesGrowthYoY === null) missingFields.push('Sales Growth YoY');
  else {
    if (f.salesGrowthYoY >= 15) growthScore += 12.5;
    else if (f.salesGrowthYoY >= 10) growthScore += 10;
    else if (f.salesGrowthYoY >= 5) growthScore += 7;
    else if (f.salesGrowthYoY > 0) growthScore += 4;
  }

  if (f.profitGrowthYoY === null) missingFields.push('Profit Growth YoY');
  else {
    if (f.profitGrowthYoY >= 18) growthScore += 12.5;
    else if (f.profitGrowthYoY >= 12) growthScore += 10;
    else if (f.profitGrowthYoY >= 5) growthScore += 7;
    else if (f.profitGrowthYoY > 0) growthScore += 4;
  }

  // 2. Profitability (25 pts): ROE (8) + ROCE (8) + Operating Margin (5) + Net Margin (4)
  let profScore = 0;
  if (f.roe === null) missingFields.push('ROE');
  else profScore += f.roe >= 20 ? 8 : f.roe >= 15 ? 6 : f.roe >= 10 ? 4 : f.roe > 0 ? 2 : 0;

  if (f.roce === null) missingFields.push('ROCE');
  else profScore += f.roce >= 22 ? 8 : f.roce >= 15 ? 6 : f.roce >= 10 ? 4 : f.roce > 0 ? 2 : 0;

  if (f.operatingMargin === null) missingFields.push('Operating Margin');
  else profScore += f.operatingMargin >= 20 ? 5 : f.operatingMargin >= 12 ? 3.5 : f.operatingMargin > 5 ? 2 : 0;

  if (f.netMargin === null) missingFields.push('Net Margin');
  else profScore += f.netMargin >= 15 ? 4 : f.netMargin >= 8 ? 3 : f.netMargin > 3 ? 1.5 : 0;

  // 3. Balance Sheet (20 pts): Debt/Equity (8) + Interest Coverage (6) + Operating Cash Flow (6)
  let bsScore = 0;
  if (f.debtToEquity === null) missingFields.push('Debt/Equity');
  else bsScore += f.debtToEquity <= 0.2 ? 8 : f.debtToEquity <= 0.6 ? 6 : f.debtToEquity <= 1.0 ? 4 : 1;

  if (f.interestCoverage === null) missingFields.push('Interest Coverage');
  else bsScore += f.interestCoverage >= 8 ? 6 : f.interestCoverage >= 4 ? 4.5 : f.interestCoverage >= 2 ? 2.5 : 0;

  if (f.operatingCashFlowCr === null) missingFields.push('Operating Cash Flow');
  else bsScore += f.operatingCashFlowCr > 1000 ? 6 : f.operatingCashFlowCr > 0 ? 4 : 0;

  // 4. Valuation (15 pts): P/E vs Sector (6) + P/B (4.5) + EV/EBITDA (4.5)
  let valScore = 0;
  if (f.pe === null || f.sectorPe === null) {
    if (f.pe === null) missingFields.push('P/E');
    if (f.sectorPe === null) missingFields.push('Sector P/E');
  } else if (f.pe > 0) {
    const ratio = f.pe / f.sectorPe;
    valScore += ratio <= 0.9 ? 6 : ratio <= 1.15 ? 4.5 : ratio <= 1.4 ? 2.5 : 1;
  }

  if (f.pb === null) missingFields.push('P/B');
  else valScore += f.pb <= 3 ? 4.5 : f.pb <= 6 ? 3 : f.pb <= 10 ? 1.5 : 0.5;

  if (f.evEbitda === null) missingFields.push('EV/EBITDA');
  else valScore += f.evEbitda <= 14 ? 4.5 : f.evEbitda <= 22 ? 3 : 1.5;

  // 5. Ownership / Governance (15 pts): Promoter Holding (5) + Pledge (5) + FII/DII Trend (5)
  let govScore = 0;
  if (f.promoterHolding === null) missingFields.push('Promoter Holding');
  else {
    // Widely held blue-chips (0% promoter like HDFC Bank / L&T) should not be penalized if institutional governance is strong
    if (f.promoterHolding === 0 && f.fiiDiiTrend !== null) govScore += 4.5;
    else govScore += f.promoterHolding >= 50 ? 5 : f.promoterHolding >= 30 ? 4 : 2.5;
  }

  if (f.promoterPledge === null) missingFields.push('Promoter Pledge');
  else govScore += f.promoterPledge === 0 ? 5 : f.promoterPledge <= 5 ? 3 : 0;

  if (f.fiiDiiTrend === null) missingFields.push('FII/DII Trend');
  else govScore += f.fiiDiiTrend === 'Accumulating' ? 5 : f.fiiDiiTrend === 'Stable' ? 3.5 : 1;

  if (f.governanceWarnings.length > 0) {
    govScore = Math.max(0, govScore - f.governanceWarnings.length * 3);
  }

  const totalScore = Math.round(growthScore + profScore + bsScore + valScore + govScore);

  let confidence: FundamentalScoreBreakdown['confidence'] = 'HIGH';
  if (missingFields.length >= 5) confidence = 'LOW';
  else if (missingFields.length >= 2) confidence = 'MEDIUM';

  return {
    totalScore: Math.max(0, Math.min(100, totalScore)),
    confidence,
    missingFields,
    components: {
      growth: {
        score: Math.round(growthScore * 10) / 10,
        max: 25,
        details: `Sales YoY: ${salesText} · Profit YoY: ${profitText}`,
      },
      profitability: {
        score: Math.round(profScore * 10) / 10,
        max: 25,
        details: `ROE: ${f.roe ?? 'N/A'}% · ROCE: ${f.roce ?? 'N/A'}% · OPM: ${f.operatingMargin ?? 'N/A'}%`,
      },
      balanceSheet: {
        score: Math.round(bsScore * 10) / 10,
        max: 20,
        details: `D/E: ${f.debtToEquity ?? 'N/A'} · Int Cov: ${f.interestCoverage ?? 'N/A'}x · CFO: ${f.operatingCashFlowCr !== null ? `₹${f.operatingCashFlowCr} Cr` : 'N/A'}`,
      },
      valuation: {
        score: Math.round(valScore * 10) / 10,
        max: 15,
        details: `P/E: ${f.pe ?? 'N/A'} (Sec: ${f.sectorPe ?? 'N/A'}) · P/B: ${f.pb ?? 'N/A'} · EV/EBITDA: ${f.evEbitda ?? 'N/A'}`,
      },
      ownershipGovernance: {
        score: Math.round(govScore * 10) / 10,
        max: 15,
        details: `Promoter: ${f.promoterHolding ?? 'N/A'}% · Pledge: ${f.promoterPledge ?? 'N/A'}% · Inst: ${f.fiiDiiTrend ?? 'N/A'}`,
      },
    },
  };
}

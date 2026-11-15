import {
  DataSourceMetadata,
  DataSourceType,
  Exchange,
  FundamentalInput,
  OHLCVCandle,
  RawMarketStock,
} from '../../types/trading';
import {
  DEFAULT_150_UNIVERSE,
  UniverseConstituentSpec,
  UniversePatternStyle,
} from '../indianUniverseRegistry';

export interface MarketDataProvider {
  readonly providerType: DataSourceType;
  getMetadata(): DataSourceMetadata;
  fetchStocks(): Promise<RawMarketStock[]>;
}

function seededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function buildTradingDateSeries(sessions: number, endDateStr: string = '2026-11-14'): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${endDateStr}T00:00:00Z`);
  while (dates.length < sessions) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  dates.reverse();
  return dates;
}

function buildDeterministicOHLCV(
  seed: number,
  dates: string[],
  startPrice: number,
  avgVol: number,
  style: UniversePatternStyle
): OHLCVCandle[] {
  const rand = seededRandom(seed);
  const sessions = dates.length;
  const candles: OHLCVCandle[] = [];

  let price = startPrice;
  for (let i = 0; i < sessions; i++) {
    const progress = i / sessions;
    const isLast = i === sessions - 1;
    const tailOffset = sessions - 1 - i;

    let drift = 0.0008;
    let volMult = 0.85 + rand() * 0.45;
    let dailyMove = (rand() - 0.48) * 0.018;

    if (style === 'pullback_setup') {
      if (tailOffset > 8) {
        drift = 0.0014;
      } else if (tailOffset >= 2) {
        drift = -0.0045;
        dailyMove = -0.003 - rand() * 0.004;
        volMult = 0.72 + rand() * 0.2;
      } else if (tailOffset === 1) {
        drift = 0.001;
        dailyMove = 0.002;
        volMult = 0.9;
      } else if (isLast) {
        drift = 0.016;
        dailyMove = 0.014;
        volMult = 1.48;
      }
    } else if (style === 'breakout_setup') {
      if (tailOffset > 24) {
        drift = 0.0013;
      } else if (tailOffset >= 1) {
        drift = 0;
        dailyMove = Math.sin(i * 0.9) * 0.005;
        volMult = 0.7 + rand() * 0.25;
      } else if (isLast) {
        drift = 0.028;
        dailyMove = 0.026;
        volMult = 1.85;
      }
    } else if (style === 'range_setup') {
      drift = 0;
      dailyMove = Math.sin(i * 0.35) * 0.009 + (rand() - 0.5) * 0.006;
      if (tailOffset <= 3 && tailOffset >= 1) {
        dailyMove = -0.007;
      } else if (isLast) {
        dailyMove = 0.011;
        volMult = 1.25;
      }
    } else if (style === 'uptrend_extended') {
      drift = progress > 0.85 ? 0.004 : 0.0012;
      if (isLast) {
        dailyMove = -0.004;
        volMult = 0.85;
      }
    } else if (style === 'sideways_weak') {
      drift = -0.0002;
      dailyMove = (rand() - 0.52) * 0.014;
    }

    const open = Math.round(price * (1 + (rand() - 0.5) * 0.004) * 100) / 100;
    let close = Math.round(open * (1 + drift + dailyMove) * 100) / 100;
    if (isLast && (style === 'pullback_setup' || style === 'breakout_setup' || style === 'range_setup')) {
      close = Math.round(open * (1 + Math.max(0.011, dailyMove)) * 100) / 100;
    }

    const wickUp = Math.abs(rand() * 0.007) * open;
    const wickDown = Math.abs(rand() * 0.007) * open;
    const high = Math.round((Math.max(open, close) + wickUp) * 100) / 100;
    const low = Math.round(Math.max(1, Math.min(open, close) - wickDown) * 100) / 100;
    const volume = Math.round(avgVol * volMult);

    candles.push({
      timestamp: dates[i],
      open,
      high,
      low,
      close,
      volume,
    });
    price = close;
  }

  return candles;
}

function buildIntradaySample(lastClose: number, avgVol: number): OHLCVCandle[] {
  const times = ['09:15', '10:15', '11:15', '12:15', '13:15', '14:15', '15:15'];
  let p = lastClose * 0.992;
  return times.map((t, idx) => {
    const open = Math.round(p * 100) / 100;
    const close = idx === times.length - 1 ? lastClose : Math.round((p + lastClose * 0.0012) * 100) / 100;
    const high = Math.round(Math.max(open, close) * 1.003 * 100) / 100;
    const low = Math.round(Math.min(open, close) * 0.997 * 100) / 100;
    p = close;
    return {
      timestamp: `2026-11-14T${t}:00+05:30`,
      open,
      high,
      low,
      close,
      volume: Math.round((avgVol / 7) * (idx === 0 || idx === 6 ? 1.4 : 0.85)),
    };
  });
}

function hashSymbolSeed(symbol: string, index: number): number {
  let h = (index + 1) * 137;
  for (let i = 0; i < symbol.length; i++) {
    h = (h * 31 + symbol.charCodeAt(i)) % 100000;
  }
  return Math.max(101, h);
}

const FLAGSHIP_FUNDAMENTALS: Record<string, FundamentalInput> = {
  RELIANCE: {
    salesGrowthYoY: 11.4, profitGrowthYoY: 9.8, roe: 10.2, roce: 11.5, operatingMargin: 17.8, netMargin: 9.1,
    debtToEquity: 0.42, interestCoverage: 6.8, operatingCashFlowCr: 142500, pe: 25.4, sectorPe: 22.1, pb: 2.3,
    evEbitda: 13.8, promoterHolding: 50.27, promoterPledge: 0, fiiDiiTrend: 'Accumulating', governanceWarnings: [],
  },
  HDFCBANK: {
    salesGrowthYoY: 16.8, profitGrowthYoY: 15.2, roe: 16.4, roce: 15.8, operatingMargin: 41.2, netMargin: 23.5,
    debtToEquity: 0.92, interestCoverage: 2.6, operatingCashFlowCr: 89000, pe: 18.6, sectorPe: 17.4, pb: 2.65,
    evEbitda: 11.4, promoterHolding: 0, promoterPledge: 0, fiiDiiTrend: 'Accumulating', governanceWarnings: [],
  },
  ICICIBANK: {
    salesGrowthYoY: 18.1, profitGrowthYoY: 19.4, roe: 18.7, roce: 17.9, operatingMargin: 42.5, netMargin: 24.8,
    debtToEquity: 0.85, interestCoverage: 2.9, operatingCashFlowCr: 74500, pe: 19.2, sectorPe: 17.4, pb: 3.1,
    evEbitda: 12.1, promoterHolding: 0, promoterPledge: 0, fiiDiiTrend: 'Accumulating', governanceWarnings: [],
  },
  TCS: {
    salesGrowthYoY: 5.6, profitGrowthYoY: 6.8, roe: 48.6, roce: 59.2, operatingMargin: 26.2, netMargin: 19.8,
    debtToEquity: 0.0, interestCoverage: 95.0, operatingCashFlowCr: 46200, pe: 29.8, sectorPe: 31.2, pb: 14.2,
    evEbitda: 20.5, promoterHolding: 71.77, promoterPledge: 0, fiiDiiTrend: 'Stable', governanceWarnings: [],
  },
  BEL: {
    salesGrowthYoY: 16.4, profitGrowthYoY: 24.2, roe: 26.5, roce: 35.8, operatingMargin: 25.4, netMargin: 19.5,
    debtToEquity: 0.0, interestCoverage: 115.0, operatingCashFlowCr: 5600, pe: 42.0, sectorPe: 46.0, pb: 11.2,
    evEbitda: 27.4, promoterHolding: 51.14, promoterPledge: 0, fiiDiiTrend: 'Accumulating', governanceWarnings: [],
  },
  ITC: {
    salesGrowthYoY: 7.4, profitGrowthYoY: 5.8, roe: 28.2, roce: 36.4, operatingMargin: 35.1, netMargin: 27.4,
    debtToEquity: 0.0, interestCoverage: 110.0, operatingCashFlowCr: 18900, pe: 27.4, sectorPe: 41.0, pb: 8.1,
    evEbitda: 18.6, promoterHolding: 0, promoterPledge: 0, fiiDiiTrend: 'Stable', governanceWarnings: [],
  },
};

function buildDeterministicFundamentals(spec: UniverseConstituentSpec, seed: number): FundamentalInput {
  if (FLAGSHIP_FUNDAMENTALS[spec.symbol]) {
    return FLAGSHIP_FUNDAMENTALS[spec.symbol];
  }
  const rand = seededRandom(seed + 77);
  const isStrong = spec.style === 'pullback_setup' || spec.style === 'breakout_setup' || spec.style === 'uptrend_extended';
  const isBank = spec.sector === 'Banking & Financials';
  const isWeak = spec.style === 'sideways_weak';

  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    salesGrowthYoY: round1((isStrong ? 12 : isWeak ? 4 : 8) + rand() * 12),
    profitGrowthYoY: round1((isStrong ? 14 : isWeak ? 2 : 9) + rand() * 16),
    roe: round1((isStrong ? 16 : isWeak ? 8.5 : 13) + rand() * 12),
    roce: round1((isStrong ? 18 : isWeak ? 9.5 : 14) + rand() * 14),
    operatingMargin: round1((isBank ? 32 : 14) + rand() * 15),
    netMargin: round1((isBank ? 18 : 8) + rand() * 10),
    debtToEquity: isBank ? round1(0.75 + rand() * 0.45) : round1(isWeak ? 0.5 + rand() * 0.8 : rand() * 0.42),
    interestCoverage: isBank ? round1(2.2 + rand() * 1.4) : round1(5 + rand() * 25),
    operatingCashFlowCr: Math.round((spec.cap === 'Large Cap' ? 12000 : spec.cap === 'Mid Cap' ? 2400 : 650) * (0.6 + rand())),
    pe: round1(16 + rand() * 26),
    sectorPe: round1(20 + rand() * 16),
    pb: round1(2.1 + rand() * 5.2),
    evEbitda: round1(11 + rand() * 16),
    promoterHolding: round1(35 + rand() * 35),
    promoterPledge: isWeak && rand() > 0.65 ? round1(rand() * 12) : 0,
    fiiDiiTrend: isStrong ? 'Accumulating' : isWeak ? 'Distributing' : 'Stable',
    governanceWarnings: [],
  };
}

/**
 * Section 4 & 42: DemoDataProvider
 * Loads the 150-stock Indian Equity Universe (50 Nifty 50 + 50 Midcap + 50 Smallcap)
 * plus BSE cross-listing sample, configurable via customConstituents.
 */
export class DemoDataProvider implements MarketDataProvider {
  readonly providerType: DataSourceType = 'DemoDataProvider';
  private constituents: UniverseConstituentSpec[];

  constructor(customConstituents?: UniverseConstituentSpec[]) {
    this.constituents = customConstituents && customConstituents.length > 0
      ? customConstituents
      : DEFAULT_150_UNIVERSE;
  }

  getMetadata(): DataSourceMetadata {
    return {
      providerName: 'DemoDataProvider',
      displayLabel: 'DEMO DATA (Simulated NSE/BSE 150-Stock Universe)',
      status: 'DEMO',
      lastUpdated: '2026-11-14 15:30:00 IST',
      dataDelay: 'Simulated Historical Dataset (Oct 2026 Universe)',
      isLiveExecutionSuitable: false,
      bannerText: 'Demo / delayed / imported data — not suitable for live execution.',
    };
  }

  async fetchStocks(): Promise<RawMarketStock[]> {
    const tradingDates = buildTradingDateSeries(250, '2026-11-14');

    const stocks: RawMarketStock[] = this.constituents.map((spec, idx) => {
      const seed = hashSymbolSeed(spec.symbol, idx);
      const candles = buildDeterministicOHLCV(seed, tradingDates, spec.basePrice, spec.avgVol, spec.style);
      const lastClose = candles[candles.length - 1].close;
      const withIntraday = spec.symbol === 'RELIANCE' || spec.symbol === 'HDFCBANK' || spec.symbol === 'BEL';

      return {
        symbol: spec.symbol,
        exchange: 'NSE',
        companyName: spec.companyName,
        sector: spec.sector,
        marketCapCategory: spec.cap,
        universeBuckets: spec.buckets,
        activeSymbol: true,
        dataInterval: '1D',
        lastUpdatedTimestamp: '2026-11-14T15:30:00+05:30',
        estimatedSpreadPct: spec.cap === 'Small Cap' ? 0.14 : spec.cap === 'Mid Cap' ? 0.07 : 0.04,
        candles,
        intradayCandles: withIntraday ? buildIntradaySample(lastClose, spec.avgVol) : undefined,
        corporateActions:
          spec.symbol === 'RELIANCE'
            ? [{ date: '2024-10-28', type: 'Bonus', details: '1:1 Bonus Issue (Adjusted)', adjusted: true }]
            : spec.symbol === 'ITC'
            ? [{ date: '2026-01-06', type: 'Merger/Demerger', details: 'ITC Hotels Demerger (Adjusted)', adjusted: true }]
            : [],
        corporateActionsVerified: true,
        fundamentals: buildDeterministicFundamentals(spec, seed),
        isDemoData: true,
      };
    });

    // Include BSE cross-listing sample for BSE filter coverage
    const tataPowerBseCandles = buildDeterministicOHLCV(1010, tradingDates, 365, 1850000, 'pullback_setup');
    stocks.push({
      symbol: 'TATAPOWER-BSE',
      exchange: 'BSE',
      companyName: 'Tata Power Company Ltd (BSE Sample)',
      sector: 'Power & Energy',
      marketCapCategory: 'Mid Cap',
      universeBuckets: ['NIFTY MIDCAP 150'],
      activeSymbol: true,
      dataInterval: '1D',
      lastUpdatedTimestamp: '2026-11-14T15:30:00+05:30',
      estimatedSpreadPct: 0.06,
      candles: tataPowerBseCandles,
      corporateActions: [],
      corporateActionsVerified: true,
      fundamentals: buildDeterministicFundamentals(
        {
          symbol: 'TATAPOWER-BSE',
          companyName: 'Tata Power Company Ltd',
          sector: 'Power & Energy',
          cap: 'Mid Cap',
          buckets: ['NIFTY MIDCAP 150'],
          basePrice: 365,
          avgVol: 1850000,
          style: 'pullback_setup',
        },
        1010
      ),
      isDemoData: true,
    });

    return stocks;
  }
}

/**
 * Section 4: CSVDataProvider
 * Parses standard NSE/BSE historical CSV (Date,Open,High,Low,Close,Volume) into a validated RawMarketStock.
 */
export class CSVDataProvider implements MarketDataProvider {
  readonly providerType: DataSourceType = 'CSVDataProvider';
  private customStocks: RawMarketStock[] = [];

  getMetadata(): DataSourceMetadata {
    return {
      providerName: 'CSVDataProvider',
      displayLabel: 'IMPORTED CSV (User Supplied OHLCV)',
      status: 'IMPORTED',
      lastUpdated: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
      dataDelay: 'Static Imported File',
      isLiveExecutionSuitable: false,
      bannerText: 'Demo / delayed / imported data — not suitable for live execution.',
    };
  }

  static parseCsvToStock(
    csvText: string,
    symbol: string,
    exchange: Exchange = 'NSE',
    companyName?: string
  ): RawMarketStock {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new Error('CSV must contain a header row and at least one OHLCV row.');
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const dateIdx = headers.findIndex((h) => h.includes('date') || h.includes('time'));
    const openIdx = headers.findIndex((h) => h === 'open');
    const highIdx = headers.findIndex((h) => h === 'high');
    const lowIdx = headers.findIndex((h) => h === 'low');
    const closeIdx = headers.findIndex((h) => h === 'close' || h.includes('ltp'));
    const volIdx = headers.findIndex((h) => h.includes('vol'));

    if ([dateIdx, openIdx, highIdx, lowIdx, closeIdx, volIdx].some((idx) => idx === -1)) {
      throw new Error('CSV header must include Date, Open, High, Low, Close, Volume columns.');
    }

    const candles: OHLCVCandle[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (cols.length < 6) continue;
      candles.push({
        timestamp: cols[dateIdx],
        open: Number(cols[openIdx]),
        high: Number(cols[highIdx]),
        low: Number(cols[lowIdx]),
        close: Number(cols[closeIdx]),
        volume: Number(cols[volIdx]),
      });
    }

    candles.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return {
      symbol: symbol.toUpperCase().trim(),
      exchange,
      companyName: companyName || `${symbol.toUpperCase()} (CSV Imported)`,
      sector: 'Imported Equity',
      marketCapCategory: 'Large Cap',
      universeBuckets: ['CUSTOM'],
      activeSymbol: true,
      dataInterval: '1D',
      lastUpdatedTimestamp: candles[candles.length - 1]?.timestamp || new Date().toISOString(),
      estimatedSpreadPct: null,
      candles,
      corporateActions: [],
      corporateActionsVerified: false,
      fundamentals: {
        salesGrowthYoY: null,
        profitGrowthYoY: null,
        roe: null,
        roce: null,
        operatingMargin: null,
        netMargin: null,
        debtToEquity: null,
        interestCoverage: null,
        operatingCashFlowCr: null,
        pe: null,
        sectorPe: null,
        pb: null,
        evEbitda: null,
        promoterHolding: null,
        promoterPledge: null,
        fiiDiiTrend: null,
        governanceWarnings: [],
      },
      isDemoData: false,
    };
  }

  addImportedStock(stock: RawMarketStock) {
    this.customStocks = [stock, ...this.customStocks.filter((s) => s.symbol !== stock.symbol)];
  }

  async fetchStocks(): Promise<RawMarketStock[]> {
    return this.customStocks;
  }
}

export class YahooPrototypeProvider implements MarketDataProvider {
  readonly providerType: DataSourceType = 'YahooPrototypeProvider';

  getMetadata(): DataSourceMetadata {
    return {
      providerName: 'YahooPrototypeProvider',
      displayLabel: 'YAHOO PROTOTYPE (Delayed EOD Adapter)',
      status: 'DELAYED',
      lastUpdated: 'Not Connected',
      dataDelay: '15+ Min Delayed / EOD Prototype',
      isLiveExecutionSuitable: false,
      bannerText: 'Demo / delayed / imported data — not suitable for live execution.',
    };
  }

  async fetchStocks(): Promise<RawMarketStock[]> {
    return [];
  }
}

export class BrokerAPIProvider implements MarketDataProvider {
  readonly providerType: DataSourceType = 'BrokerAPIProvider';

  getMetadata(): DataSourceMetadata {
    return {
      providerName: 'BrokerAPIProvider',
      displayLabel: 'BROKER API (Phase 1 Read-Only Disconnected)',
      status: 'DISCONNECTED',
      lastUpdated: 'N/A',
      dataDelay: 'Disconnected — Phase 1 Safety Lock',
      isLiveExecutionSuitable: false,
      bannerText: 'Demo / delayed / imported data — not suitable for live execution.',
    };
  }

  async fetchStocks(): Promise<RawMarketStock[]> {
    return [];
  }
}

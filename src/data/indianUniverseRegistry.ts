import { MarketCapCategory, UniverseBucket } from '../types/trading';

export type UniversePatternStyle =
  | 'pullback_setup'
  | 'breakout_setup'
  | 'range_setup'
  | 'uptrend_extended'
  | 'sideways_weak';

export interface UniverseConstituentSpec {
  symbol: string;
  companyName: string;
  sector: string;
  cap: MarketCapCategory;
  buckets: UniverseBucket[];
  basePrice: number;
  avgVol: number;
  style: UniversePatternStyle;
}

export const UNIVERSE_ARCHITECTURE_METADATA = {
  lastReferenceNote: 'October 2026 / September 2026 NSE Nifty Indices constituent baseline (configurable & CSV-updatable)',
  nifty50CountOfficial: 50,
  midcap150CountOfficial: 150,
  smallcap250CountOfficial: 250,
  mvpTotalTarget: 150,
};

// 1. NIFTY 50 — 50 Core Large-Cap Stocks
export const DEFAULT_NIFTY_50_LIST: UniverseConstituentSpec[] = [
  { symbol: 'HDFCBANK', companyName: 'HDFC Bank Ltd', sector: 'Banking & Financials', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 1340, avgVol: 14500000, style: 'pullback_setup' },
  { symbol: 'ICICIBANK', companyName: 'ICICI Bank Ltd', sector: 'Banking & Financials', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 980, avgVol: 11200000, style: 'breakout_setup' },
  { symbol: 'RELIANCE', companyName: 'Reliance Industries Ltd', sector: 'Power & Energy', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 2210, avgVol: 6200000, style: 'pullback_setup' },
  { symbol: 'BHARTIARTL', companyName: 'Bharti Airtel Ltd', sector: 'Telecom', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 1380, avgVol: 5400000, style: 'uptrend_extended' },
  { symbol: 'LT', companyName: 'Larsen & Toubro Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 2890, avgVol: 2400000, style: 'uptrend_extended' },
  { symbol: 'SBIN', companyName: 'State Bank of India', sector: 'Banking & Financials', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 685, avgVol: 15600000, style: 'pullback_setup' },
  { symbol: 'INFY', companyName: 'Infosys Ltd', sector: 'Information Technology', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 1520, avgVol: 6800000, style: 'range_setup' },
  { symbol: 'AXISBANK', companyName: 'Axis Bank Ltd', sector: 'Banking & Financials', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 1020, avgVol: 8400000, style: 'pullback_setup' },
  { symbol: 'KOTAKBANK', companyName: 'Kotak Mahindra Bank Ltd', sector: 'Banking & Financials', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 1640, avgVol: 4900000, style: 'range_setup' },
  { symbol: 'M&M', companyName: 'Mahindra & Mahindra Ltd', sector: 'Automobile', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 2420, avgVol: 2700000, style: 'breakout_setup' },
  { symbol: 'ITC', companyName: 'ITC Ltd', sector: 'FMCG', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 485, avgVol: 13800000, style: 'sideways_weak' },
  { symbol: 'TCS', companyName: 'Tata Consultancy Services Ltd', sector: 'Information Technology', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 4050, avgVol: 1950000, style: 'range_setup' },
  { symbol: 'BAJFINANCE', companyName: 'Bajaj Finance Ltd', sector: 'Banking & Financials', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 6450, avgVol: 1100000, style: 'pullback_setup' },
  { symbol: 'HINDUNILVR', companyName: 'Hindustan Unilever Ltd', sector: 'FMCG', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 2460, avgVol: 1650000, style: 'sideways_weak' },
  { symbol: 'MARUTI', companyName: 'Maruti Suzuki India Ltd', sector: 'Automobile', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 10800, avgVol: 520000, style: 'range_setup' },
  { symbol: 'SUNPHARMA', companyName: 'Sun Pharmaceutical Industries Ltd', sector: 'Pharma & Healthcare', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 1580, avgVol: 2200000, style: 'uptrend_extended' },
  { symbol: 'NTPC', companyName: 'NTPC Ltd', sector: 'Power & Energy', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 315, avgVol: 16200000, style: 'pullback_setup' },
  { symbol: 'TITAN', companyName: 'Titan Company Ltd', sector: 'Consumer Discretionary', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 3120, avgVol: 1250000, style: 'range_setup' },
  { symbol: 'ETERNAL', companyName: 'Eternal Ltd', sector: 'Consumer Internet', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 215, avgVol: 32000000, style: 'breakout_setup' },
  { symbol: 'TATASTEEL', companyName: 'Tata Steel Ltd', sector: 'Metals & Mining', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 142, avgVol: 28000000, style: 'sideways_weak' },
  { symbol: 'BEL', companyName: 'Bharat Electronics Ltd', sector: 'Defence & Aerospace', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 210, avgVol: 21500000, style: 'breakout_setup' },
  { symbol: 'SHRIRAMFIN', companyName: 'Shriram Finance Ltd', sector: 'Banking & Financials', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 2560, avgVol: 1400000, style: 'pullback_setup' },
  { symbol: 'ULTRACEMCO', companyName: 'UltraTech Cement Ltd', sector: 'Cement & Materials', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 9850, avgVol: 340000, style: 'range_setup' },
  { symbol: 'HCLTECH', companyName: 'HCL Technologies Ltd', sector: 'Information Technology', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 1490, avgVol: 2900000, style: 'pullback_setup' },
  { symbol: 'POWERGRID', companyName: 'Power Grid Corporation of India Ltd', sector: 'Power & Energy', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 280, avgVol: 14800000, style: 'range_setup' },
  { symbol: 'HINDALCO', companyName: 'Hindalco Industries Ltd', sector: 'Metals & Mining', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 590, avgVol: 6100000, style: 'breakout_setup' },
  { symbol: 'JSWSTEEL', companyName: 'JSW Steel Ltd', sector: 'Metals & Mining', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 860, avgVol: 3400000, style: 'range_setup' },
  { symbol: 'ADANIENT', companyName: 'Adani Enterprises Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 2780, avgVol: 1850000, style: 'sideways_weak' },
  { symbol: 'ADANIPORTS', companyName: 'Adani Ports and SEZ Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 1210, avgVol: 3600000, style: 'pullback_setup' },
  { symbol: 'BAJAJFINSV', companyName: 'Bajaj Finserv Ltd', sector: 'Banking & Financials', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 1590, avgVol: 1750000, style: 'range_setup' },
  { symbol: 'TATAMOTORS', companyName: 'Tata Motors Ltd', sector: 'Automobile', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 840, avgVol: 9800000, style: 'sideways_weak' },
  { symbol: 'TATACONSUM', companyName: 'Tata Consumer Products Ltd', sector: 'FMCG', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 1020, avgVol: 1900000, style: 'range_setup' },
  { symbol: 'ASIANPAINT', companyName: 'Asian Paints Ltd', sector: 'Consumer Discretionary', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 2740, avgVol: 1500000, style: 'sideways_weak' },
  { symbol: 'CIPLA', companyName: 'Cipla Ltd', sector: 'Pharma & Healthcare', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 1410, avgVol: 2100000, style: 'pullback_setup' },
  { symbol: 'DRREDDY', companyName: "Dr. Reddy's Laboratories Ltd", sector: 'Pharma & Healthcare', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 1220, avgVol: 1350000, style: 'range_setup' },
  { symbol: 'EICHERMOT', companyName: 'Eicher Motors Ltd', sector: 'Automobile', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 4450, avgVol: 680000, style: 'uptrend_extended' },
  { symbol: 'GRASIM', companyName: 'Grasim Industries Ltd', sector: 'Cement & Materials', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 2380, avgVol: 920000, style: 'range_setup' },
  { symbol: 'COALINDIA', companyName: 'Coal India Ltd', sector: 'Metals & Mining', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 425, avgVol: 9400000, style: 'pullback_setup' },
  { symbol: 'TECHM', companyName: 'Tech Mahindra Ltd', sector: 'Information Technology', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 1460, avgVol: 2350000, style: 'breakout_setup' },
  { symbol: 'NESTLEIND', companyName: 'Nestle India Ltd', sector: 'FMCG', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 2360, avgVol: 820000, style: 'sideways_weak' },
  { symbol: 'TRENT', companyName: 'Trent Ltd', sector: 'Consumer Discretionary', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 5420, avgVol: 1180000, style: 'uptrend_extended' },
  { symbol: 'APOLLOHOSP', companyName: 'Apollo Hospitals Enterprise Ltd', sector: 'Pharma & Healthcare', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 6320, avgVol: 480000, style: 'pullback_setup' },
  { symbol: 'WIPRO', companyName: 'Wipro Ltd', sector: 'Information Technology', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 495, avgVol: 6800000, style: 'range_setup' },
  { symbol: 'SBILIFE', companyName: 'SBI Life Insurance Company Ltd', sector: 'Banking & Financials', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 1520, avgVol: 1420000, style: 'pullback_setup' },
  { symbol: 'HDFCLIFE', companyName: 'HDFC Life Insurance Company Ltd', sector: 'Banking & Financials', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 665, avgVol: 3900000, style: 'range_setup' },
  { symbol: 'BAJAJ-AUTO', companyName: 'Bajaj Auto Ltd', sector: 'Automobile', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 8650, avgVol: 440000, style: 'uptrend_extended' },
  { symbol: 'HEROMOTOCO', companyName: 'Hero MotoCorp Ltd', sector: 'Automobile', cap: 'Large Cap', buckets: ['NIFTY 50', 'NIFTY MIDCAP 150'], basePrice: 4720, avgVol: 780000, style: 'pullback_setup' },
  { symbol: 'ONGC', companyName: 'Oil and Natural Gas Corporation Ltd', sector: 'Power & Energy', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 268, avgVol: 18500000, style: 'range_setup' },
  { symbol: 'PFC', companyName: 'Power Finance Corporation Ltd', sector: 'Banking & Financials', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 445, avgVol: 9200000, style: 'breakout_setup' },
  { symbol: 'ADANIPOWER', companyName: 'Adani Power Ltd', sector: 'Power & Energy', cap: 'Large Cap', buckets: ['NIFTY 50'], basePrice: 545, avgVol: 7600000, style: 'sideways_weak' },
];

// 2. NIFTY MIDCAP 150 — Recommended 50-Stock Active Swing Universe (Note: HEROMOTOCO merged above)
export const DEFAULT_NIFTY_MIDCAP_50_LIST: UniverseConstituentSpec[] = [
  { symbol: 'BSE', companyName: 'BSE Ltd', sector: 'Capital Markets', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 3420, avgVol: 2450000, style: 'breakout_setup' },
  { symbol: 'FEDERALBNK', companyName: 'The Federal Bank Ltd', sector: 'Banking & Financials', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 178, avgVol: 12400000, style: 'pullback_setup' },
  { symbol: 'MCX', companyName: 'Multi Commodity Exchange of India Ltd', sector: 'Capital Markets', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 4950, avgVol: 820000, style: 'uptrend_extended' },
  { symbol: 'LUPIN', companyName: 'Lupin Ltd', sector: 'Pharma & Healthcare', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 1840, avgVol: 1650000, style: 'pullback_setup' },
  { symbol: 'INDUSTOWER', companyName: 'Indus Towers Ltd', sector: 'Telecom', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 345, avgVol: 11200000, style: 'range_setup' },
  { symbol: 'PERSISTENT', companyName: 'Persistent Systems Ltd', sector: 'Information Technology', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 4820, avgVol: 680000, style: 'breakout_setup' },
  { symbol: 'INDUSINDBK', companyName: 'IndusInd Bank Ltd', sector: 'Banking & Financials', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 1080, avgVol: 7800000, style: 'sideways_weak' },
  { symbol: 'POLICYBZR', companyName: 'PB Fintech Ltd', sector: 'Consumer Internet', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 1540, avgVol: 2150000, style: 'pullback_setup' },
  { symbol: 'SUZLON', companyName: 'Suzlon Energy Ltd', sector: 'Power & Energy', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 62, avgVol: 48000000, style: 'sideways_weak' },
  { symbol: 'AUBANK', companyName: 'AU Small Finance Bank Ltd', sector: 'Banking & Financials', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 625, avgVol: 3200000, style: 'range_setup' },
  { symbol: 'GVT&D', companyName: 'GE Vernova T&D India Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 1620, avgVol: 920000, style: 'uptrend_extended' },
  { symbol: 'BHARATFORG', companyName: 'Bharat Forge Ltd', sector: 'Automobile', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 1380, avgVol: 1280000, style: 'range_setup' },
  { symbol: 'ASHOKLEY', companyName: 'Ashok Leyland Ltd', sector: 'Automobile', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 218, avgVol: 14500000, style: 'pullback_setup' },
  { symbol: 'ICICIGI', companyName: 'ICICI Lombard General Insurance', sector: 'Banking & Financials', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 1840, avgVol: 780000, style: 'pullback_setup' },
  { symbol: 'FORTIS', companyName: 'Fortis Healthcare Ltd', sector: 'Pharma & Healthcare', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 540, avgVol: 2400000, style: 'breakout_setup' },
  { symbol: 'PAYTM', companyName: 'One97 Communications Ltd', sector: 'Consumer Internet', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 710, avgVol: 6500000, style: 'range_setup' },
  { symbol: 'DIXON', companyName: 'Dixon Technologies (India) Ltd', sector: 'Consumer Discretionary', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 12400, avgVol: 340000, style: 'uptrend_extended' },
  { symbol: 'MFSL', companyName: 'Max Financial Services Ltd', sector: 'Banking & Financials', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 1120, avgVol: 1150000, style: 'pullback_setup' },
  { symbol: 'IDFCFIRSTB', companyName: 'IDFC First Bank Ltd', sector: 'Banking & Financials', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 68, avgVol: 28000000, style: 'sideways_weak' },
  { symbol: 'MARICO', companyName: 'Marico Ltd', sector: 'FMCG', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 615, avgVol: 2200000, style: 'range_setup' },
  { symbol: 'LAURUSLABS', companyName: 'Laurus Labs Ltd', sector: 'Pharma & Healthcare', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 485, avgVol: 2900000, style: 'breakout_setup' },
  { symbol: 'COFORGE', companyName: 'Coforge Ltd', sector: 'Information Technology', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 6780, avgVol: 480000, style: 'pullback_setup' },
  { symbol: 'NAUKRI', companyName: 'Info Edge (India) Ltd', sector: 'Consumer Internet', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 7150, avgVol: 380000, style: 'uptrend_extended' },
  { symbol: 'POLYCAB', companyName: 'Polycab India Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 6240, avgVol: 490000, style: 'pullback_setup' },
  { symbol: 'POWERINDIA', companyName: 'Hitachi Energy India Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 11200, avgVol: 140000, style: 'uptrend_extended' },
  { symbol: 'APLAPOLLO', companyName: 'APL Apollo Tubes Ltd', sector: 'Metals & Mining', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 1480, avgVol: 950000, style: 'range_setup' },
  { symbol: 'ALKEM', companyName: 'Alkem Laboratories Ltd', sector: 'Pharma & Healthcare', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 5380, avgVol: 260000, style: 'pullback_setup' },
  { symbol: 'JSWENERGY', companyName: 'JSW Energy Ltd', sector: 'Power & Energy', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 645, avgVol: 3400000, style: 'range_setup' },
  { symbol: 'NMDC', companyName: 'NMDC Ltd', sector: 'Metals & Mining', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 218, avgVol: 12500000, style: 'sideways_weak' },
  { symbol: 'BIOCON', companyName: 'Biocon Ltd', sector: 'Pharma & Healthcare', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 325, avgVol: 4800000, style: 'range_setup' },
  { symbol: 'MPHASIS', companyName: 'Mphasis Ltd', sector: 'Information Technology', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 2680, avgVol: 690000, style: 'pullback_setup' },
  { symbol: 'HAVELLS', companyName: 'Havells India Ltd', sector: 'Consumer Discretionary', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 1640, avgVol: 1150000, style: 'range_setup' },
  { symbol: 'TIINDIA', companyName: 'Tube Investments of India Ltd', sector: 'Automobile', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 3780, avgVol: 390000, style: 'sideways_weak' },
  { symbol: 'KEI', companyName: 'KEI Industries Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 3980, avgVol: 360000, style: 'pullback_setup' },
  { symbol: 'PHOENIXLTD', companyName: 'The Phoenix Mills Ltd', sector: 'Real Estate', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 1590, avgVol: 840000, style: 'breakout_setup' },
  { symbol: 'RECLTD', companyName: 'REC Ltd', sector: 'Banking & Financials', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 495, avgVol: 10500000, style: 'pullback_setup' },
  { symbol: 'INDHOTEL', companyName: 'The Indian Hotels Company Ltd', sector: 'Consumer Discretionary', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 665, avgVol: 4100000, style: 'breakout_setup' },
  { symbol: 'GMRAIRPORT', companyName: 'GMR Airports Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 82, avgVol: 19500000, style: 'range_setup' },
  { symbol: 'SWIGGY', companyName: 'Swiggy Ltd', sector: 'Consumer Internet', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 415, avgVol: 8200000, style: 'pullback_setup' },
  { symbol: 'AUROPHARMA', companyName: 'Aurobindo Pharma Ltd', sector: 'Pharma & Healthcare', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 1290, avgVol: 1450000, style: 'range_setup' },
  { symbol: 'GLENMARK', companyName: 'Glenmark Pharmaceuticals Ltd', sector: 'Pharma & Healthcare', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 1480, avgVol: 1120000, style: 'uptrend_extended' },
  { symbol: 'UPL', companyName: 'UPL Ltd', sector: 'Chemicals', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 535, avgVol: 3100000, style: 'sideways_weak' },
  { symbol: 'TORNTPOWER', companyName: 'Torrent Power Ltd', sector: 'Power & Energy', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 1580, avgVol: 890000, style: 'pullback_setup' },
  { symbol: 'MUTHOOTFIN', companyName: 'Muthoot Finance Ltd', sector: 'Banking & Financials', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 1820, avgVol: 740000, style: 'breakout_setup' },
  { symbol: 'INDIANB', companyName: 'Indian Bank', sector: 'Banking & Financials', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 525, avgVol: 2300000, style: 'pullback_setup' },
  { symbol: 'VOLTAS', companyName: 'Voltas Ltd', sector: 'Consumer Discretionary', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 1560, avgVol: 1750000, style: 'range_setup' },
  { symbol: 'SRF', companyName: 'SRF Ltd', sector: 'Chemicals', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 2290, avgVol: 680000, style: 'sideways_weak' },
  { symbol: 'YESBANK', companyName: 'Yes Bank Ltd', sector: 'Banking & Financials', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 21, avgVol: 85000000, style: 'sideways_weak' },
  { symbol: 'NATIONALUM', companyName: 'National Aluminium Company Ltd', sector: 'Metals & Mining', cap: 'Mid Cap', buckets: ['NIFTY MIDCAP 150'], basePrice: 212, avgVol: 11200000, style: 'breakout_setup' },
];

// 3. NIFTY SMALLCAP 250 — 50-Stock Starter Universe (Strict Smallcap Liquidity Filter Applied)
export const DEFAULT_NIFTY_SMALLCAP_50_LIST: UniverseConstituentSpec[] = [
  { symbol: 'CDSL', companyName: 'Central Depository Services (India) Ltd', sector: 'Capital Markets', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 1420, avgVol: 2800000, style: 'pullback_setup' },
  { symbol: 'ANGELONE', companyName: 'Angel One Ltd', sector: 'Capital Markets', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 2540, avgVol: 1350000, style: 'breakout_setup' },
  { symbol: 'KVB', companyName: 'Karur Vysya Bank Ltd', sector: 'Banking & Financials', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 215, avgVol: 2450000, style: 'pullback_setup' },
  { symbol: 'RBLBANK', companyName: 'RBL Bank Ltd', sector: 'Banking & Financials', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 175, avgVol: 4900000, style: 'sideways_weak' },
  { symbol: 'CUB', companyName: 'City Union Bank Ltd', sector: 'Banking & Financials', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 162, avgVol: 1950000, style: 'range_setup' },
  { symbol: 'DELHIVERY', companyName: 'Delhivery Ltd', sector: 'Logistics', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 355, avgVol: 2100000, style: 'sideways_weak' },
  { symbol: 'SONACOMS', companyName: 'Sona BLW Precision Forgings Ltd', sector: 'Automobile', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 615, avgVol: 1350000, style: 'range_setup' },
  { symbol: 'NAVINFLUOR', companyName: 'Navin Fluorine International Ltd', sector: 'Chemicals', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 3340, avgVol: 190000, style: 'range_setup' },
  { symbol: 'ASTERDM', companyName: 'Aster DM Healthcare Ltd', sector: 'Pharma & Healthcare', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 418, avgVol: 980000, style: 'pullback_setup' },
  { symbol: 'CAMS', companyName: 'Computer Age Management Services Ltd', sector: 'Capital Markets', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 4150, avgVol: 280000, style: 'uptrend_extended' },
  { symbol: 'HINDCOPPER', companyName: 'Hindustan Copper Ltd', sector: 'Metals & Mining', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 265, avgVol: 5800000, style: 'breakout_setup' },
  { symbol: 'IEX', companyName: 'Indian Energy Exchange Ltd', sector: 'Capital Markets', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 178, avgVol: 4400000, style: 'range_setup' },
  { symbol: 'NBCC', companyName: 'NBCC (India) Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 92, avgVol: 14500000, style: 'sideways_weak' },
  { symbol: 'RVNL', companyName: 'Rail Vikas Nigam Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 410, avgVol: 9600000, style: 'pullback_setup' },
  { symbol: 'IRCON', companyName: 'Ircon International Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 198, avgVol: 3600000, style: 'sideways_weak' },
  { symbol: 'IRFC', companyName: 'Indian Railway Finance Corporation Ltd', sector: 'Banking & Financials', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 142, avgVol: 18500000, style: 'range_setup' },
  { symbol: 'RITES', companyName: 'RITES Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 285, avgVol: 820000, style: 'range_setup' },
  { symbol: 'HUDCO', companyName: 'Housing & Urban Development Corp Ltd', sector: 'Banking & Financials', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 215, avgVol: 5200000, style: 'pullback_setup' },
  { symbol: 'MAZDOCK', companyName: 'Mazagon Dock Shipbuilders Ltd', sector: 'Defence & Aerospace', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 3890, avgVol: 940000, style: 'breakout_setup' },
  { symbol: 'COCHINSHIP', companyName: 'Cochin Shipyard Ltd', sector: 'Defence & Aerospace', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 1460, avgVol: 1550000, style: 'pullback_setup' },
  { symbol: 'BDL', companyName: 'Bharat Dynamics Ltd', sector: 'Defence & Aerospace', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 1120, avgVol: 1450000, style: 'pullback_setup' },
  { symbol: 'DATAPATTNS', companyName: 'Data Patterns (India) Ltd', sector: 'Defence & Aerospace', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 2340, avgVol: 320000, style: 'range_setup' },
  { symbol: 'KPITTECH', companyName: 'KPIT Technologies Ltd', sector: 'Information Technology', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 1480, avgVol: 1650000, style: 'pullback_setup' },
  { symbol: 'BLS', companyName: 'BLS International Services Ltd', sector: 'Consumer Internet', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 365, avgVol: 1450000, style: 'breakout_setup' },
  { symbol: 'KAYNES', companyName: 'Kaynes Technology India Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 4950, avgVol: 310000, style: 'uptrend_extended' },
  { symbol: 'CESC', companyName: 'CESC Ltd', sector: 'Power & Energy', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 172, avgVol: 3200000, style: 'pullback_setup' },
  { symbol: 'JSL', companyName: 'Jindal Stainless Ltd', sector: 'Metals & Mining', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 685, avgVol: 780000, style: 'range_setup' },
  { symbol: 'JINDALSAW', companyName: 'Jindal Saw Ltd', sector: 'Metals & Mining', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 285, avgVol: 620000, style: 'sideways_weak' },
  { symbol: 'WELCORP', companyName: 'Welspun Corp Ltd', sector: 'Metals & Mining', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 695, avgVol: 680000, style: 'breakout_setup' },
  { symbol: 'AARTIIND', companyName: 'Aarti Industries Ltd', sector: 'Chemicals', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 465, avgVol: 1350000, style: 'sideways_weak' },
  { symbol: 'GSFC', companyName: 'Gujarat State Fertilizers & Chemicals Ltd', sector: 'Chemicals', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 198, avgVol: 880000, style: 'range_setup' },
  { symbol: 'GUJGASLTD', companyName: 'Gujarat Gas Ltd', sector: 'Power & Energy', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 515, avgVol: 740000, style: 'range_setup' },
  { symbol: 'CCL', companyName: 'CCL Products (India) Ltd', sector: 'FMCG', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 640, avgVol: 240000, style: 'range_setup' },
  { symbol: 'AAVAS', companyName: 'Aavas Financiers Ltd', sector: 'Banking & Financials', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 1620, avgVol: 175000, style: 'sideways_weak' },
  { symbol: 'UTIAMC', companyName: 'UTI Asset Management Company Ltd', sector: 'Capital Markets', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 1120, avgVol: 260000, style: 'pullback_setup' },
  { symbol: 'CREDITACC', companyName: 'CreditAccess Grameen Ltd', sector: 'Banking & Financials', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 980, avgVol: 420000, style: 'sideways_weak' },
  { symbol: 'FIVESTAR', companyName: 'Five-Star Business Finance Ltd', sector: 'Banking & Financials', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 715, avgVol: 650000, style: 'range_setup' },
  { symbol: 'HOMEFIRST', companyName: 'Home First Finance Company India Ltd', sector: 'Banking & Financials', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 1040, avgVol: 280000, style: 'pullback_setup' },
  { symbol: 'KFINTECH', companyName: 'KFin Technologies Ltd', sector: 'Capital Markets', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 940, avgVol: 920000, style: 'breakout_setup' },
  { symbol: 'JYOTHYLAB', companyName: 'Jyothy Labs Ltd', sector: 'FMCG', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 445, avgVol: 480000, style: 'range_setup' },
  { symbol: 'SONATSOFTW', companyName: 'Sonata Software Ltd', sector: 'Information Technology', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 590, avgVol: 640000, style: 'range_setup' },
  { symbol: 'TANLA', companyName: 'Tanla Platforms Ltd', sector: 'Information Technology', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 760, avgVol: 320000, style: 'sideways_weak' },
  { symbol: 'INTELLECT', companyName: 'Intellect Design Arena Ltd', sector: 'Information Technology', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 820, avgVol: 390000, style: 'range_setup' },
  { symbol: 'ENGINERSIN', companyName: 'Engineers India Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 192, avgVol: 1450000, style: 'pullback_setup' },
  { symbol: 'RAILTEL', companyName: 'RailTel Corporation of India Ltd', sector: 'Telecom', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 385, avgVol: 1350000, style: 'range_setup' },
  { symbol: 'TITAGARH', companyName: 'Titagarh Rail Systems Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 1180, avgVol: 890000, style: 'pullback_setup' },
  { symbol: 'JWL', companyName: 'Jupiter Wagons Ltd', sector: 'Infrastructure & Capital Goods', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 465, avgVol: 1100000, style: 'range_setup' },
  { symbol: 'PVRINOX', companyName: 'PVR INOX Ltd', sector: 'Consumer Discretionary', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 1380, avgVol: 290000, style: 'sideways_weak' },
  { symbol: 'UJJIVANSFB', companyName: 'Ujjivan Small Finance Bank Ltd', sector: 'Banking & Financials', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 38, avgVol: 8400000, style: 'sideways_weak' },
  { symbol: 'EQUITASBNK', companyName: 'Equitas Small Finance Bank Ltd', sector: 'Banking & Financials', cap: 'Small Cap', buckets: ['NIFTY SMALLCAP 250'], basePrice: 68, avgVol: 4800000, style: 'sideways_weak' },
];

export const DEFAULT_150_UNIVERSE: UniverseConstituentSpec[] = [
  ...DEFAULT_NIFTY_50_LIST,
  ...DEFAULT_NIFTY_MIDCAP_50_LIST,
  ...DEFAULT_NIFTY_SMALLCAP_50_LIST,
];

/**
 * Parses official NSE Constituent CSV downloads (`Company Name,Industry,Symbol,...`)
 * or custom `Symbol,Company,Sector,Bucket` CSVs so the index universe is never permanently hard-coded.
 */
export function parseUniverseConstituentsCsv(
  csvText: string,
  targetBucket: UniverseBucket,
  targetCap: MarketCapCategory
): UniverseConstituentSpec[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('Constituent CSV must contain a header row and at least one symbol row.');
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const symIdx = headers.findIndex((h) => h.includes('symbol') || h === 'ticker');
  const nameIdx = headers.findIndex((h) => h.includes('company') || h.includes('name'));
  const secIdx = headers.findIndex((h) => h.includes('industry') || h.includes('sector'));

  if (symIdx === -1) {
    throw new Error('CSV header must contain a Symbol column (matching official NSE constituent CSV).');
  }

  const results: UniverseConstituentSpec[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const sym = cols[symIdx]?.toUpperCase();
    if (!sym) continue;
    results.push({
      symbol: sym,
      companyName: nameIdx >= 0 && cols[nameIdx] ? cols[nameIdx] : sym,
      sector: secIdx >= 0 && cols[secIdx] ? cols[secIdx] : 'NSE Constituent',
      cap: targetCap,
      buckets: [targetBucket],
      basePrice: targetCap === 'Large Cap' ? 1200 : targetCap === 'Mid Cap' ? 750 : 380,
      avgVol: targetCap === 'Large Cap' ? 3500000 : targetCap === 'Mid Cap' ? 1500000 : 950000,
      style: 'pullback_setup',
    });
  }

  return results;
}

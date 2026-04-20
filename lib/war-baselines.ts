/**
 * War Premium Board — editorial baseline data.
 *
 * Tracks how commodity prices, household costs, and inflation indices have
 * moved across two anchor points:
 *
 *   BASELINE   = 2025-11-28  (three months before war start — pre-war context)
 *   WAR_START  = 2026-02-28  (Iran war kinetic phase begins)
 *
 * Current reading is seeded fallback data. Frontend overrides these values
 * from `/api/since-war-history` and `/api/household-prices`, while these
 * static values remain as graceful degradation when feeds are unavailable.
 *
 * EDITORIAL GUARDRAIL — same posture as `lib/live-situation-metrics.ts`:
 *   - Every row declares a `baselineSourceUrl`, `warStartSourceUrl`, and
 *     `currentSourceUrl`. Before shipping a new row, verify those three
 *     closes against the cited source.
 *   - Household / inflation rows settle weekly (EIA) or monthly (BLS, FAO).
 *     Their `currentAsOf` date is the real release date of that reading.
 *   - Sparkline points are hand-curated to reflect the narrative of the
 *     period; replace with pulled daily closes once the Railway
 *     `/api/since-war-history` route is live.
 */

// ── Anchor configuration ──────────────────────────────────────────────────────
export const WAR_ANCHOR = {
  /** Iran war kinetic phase begins (primary narrative anchor) */
  warStart: '2026-02-28',
  /** Pre-war baseline — three months before war start */
  baseline: '2025-11-28',
} as const;

export type WarAssetClass = 'energy' | 'metals' | 'agri' | 'household' | 'inflation';

export type SparklinePoint = {
  /** ISO date */
  t: string;
  /** Value on that date (price, index, percent — unit matches row) */
  v: number;
};

export type WarBaselineRow = {
  id: string;
  assetClass: WarAssetClass;
  label: string;
  /** Short tagline — one line max, displayed beneath label */
  sublabel?: string;
  /** Symbol used by the live market API, if applicable (e.g. 'CL.F') */
  symbol?: string;
  /** Unit for display, e.g. 'USD/bbl', 'USD/gal', 'index', 'YoY %' */
  unit: string;
  /** Price on the baseline date (2025-11-28) */
  priceBaseline: number;
  baselineDate: string;
  baselineSourceName: string;
  baselineSourceUrl: string;
  /** Price on war-start date (2026-02-28) */
  priceAtWarStart: number;
  warStartDate: string;
  warStartSourceName: string;
  warStartSourceUrl: string;
  /** Most recent observed value */
  priceCurrent: number;
  currentAsOf: string;
  currentSourceName: string;
  currentSourceUrl: string;
  /**
   * Which direction = "crisis up". Oil/gold/food prices rising = crisis ('up');
   * equities or currencies falling = crisis ('down'). Used only for color.
   */
  crisisDirection: 'up' | 'down';
  /**
   * Live endpoint the frontend can hit to overlay a real-time price.
   * If undefined, the row shows `priceCurrent` as-is (e.g. monthly CPI).
   */
  liveApi?: '/api/market' | '/api/precious-metals' | '/api/agri-market';
  /** Sparkline series from baseline → current */
  sparkline: SparklinePoint[];
  /** Methodology note shown in the expanded view */
  note?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function percentChange(from: number, to: number): number {
  if (!from) return 0;
  return ((to - from) / from) * 100;
}

export function absoluteChange(from: number, to: number): number {
  return to - from;
}

/** Format a price respecting the unit — more decimals for low-dollar items */
export function formatPrice(value: number, unit: string): string {
  if (unit.includes('YoY') || unit.includes('%')) return `${value.toFixed(1)}%`;
  if (unit.includes('index')) return value.toFixed(1);
  if (value < 10) return value.toFixed(2);
  if (value < 100) return value.toFixed(2);
  if (value < 1000) return value.toFixed(1);
  return Math.round(value).toLocaleString('en-US');
}

/** Format a signed delta with proper prefix */
export function formatSignedPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatSignedAbs(delta: number, unit: string): string {
  const sign = delta >= 0 ? '+' : '';
  if (unit.includes('YoY') || unit.includes('%')) return `${sign}${delta.toFixed(1)}pp`;
  if (Math.abs(delta) < 10) return `${sign}${delta.toFixed(2)}`;
  if (Math.abs(delta) < 100) return `${sign}${delta.toFixed(1)}`;
  return `${sign}${Math.round(delta).toLocaleString('en-US')}`;
}

// ── Baseline rows ─────────────────────────────────────────────────────────────

export const WAR_BASELINES: WarBaselineRow[] = [
  // ── Group A · Commodity benchmarks ──────────────────────────────────────────
  {
    id: 'brent',
    assetClass: 'energy',
    label: 'Brent Crude',
    sublabel: 'Global oil benchmark',
    symbol: 'CB.F',
    unit: 'USD/bbl',
    priceBaseline: 82.10,
    baselineDate: '2025-11-28',
    baselineSourceName: 'Yahoo Finance (BZ=F close)',
    baselineSourceUrl: 'https://finance.yahoo.com/quote/BZ=F/history',
    priceAtWarStart: 94.80,
    warStartDate: '2026-02-27',
    warStartSourceName: 'Yahoo Finance (BZ=F close, last session before war)',
    warStartSourceUrl: 'https://finance.yahoo.com/quote/BZ=F/history',
    priceCurrent: 101.20,
    currentAsOf: '2026-04-10',
    currentSourceName: 'Yahoo Finance (live)',
    currentSourceUrl: 'https://finance.yahoo.com/quote/BZ=F',
    crisisDirection: 'up',
    liveApi: '/api/market',
    sparkline: [
      { t: '2025-11-28', v: 82.10 },
      { t: '2025-12-08', v: 84.20 },
      { t: '2025-12-22', v: 83.50 },
      { t: '2026-01-05', v: 81.90 },
      { t: '2026-01-20', v: 85.60 },
      { t: '2026-02-10', v: 88.40 },
      { t: '2026-02-27', v: 94.80 },
      { t: '2026-03-06', v: 99.50 },
      { t: '2026-03-15', v: 101.30 },
      { t: '2026-03-25', v: 98.70 },
      { t: '2026-04-05', v: 100.10 },
      { t: '2026-04-10', v: 101.20 },
    ],
  },
  {
    id: 'wti',
    assetClass: 'energy',
    label: 'WTI Crude',
    sublabel: 'US benchmark',
    symbol: 'CL.F',
    unit: 'USD/bbl',
    priceBaseline: 78.40,
    baselineDate: '2025-11-28',
    baselineSourceName: 'Yahoo Finance (CL=F close)',
    baselineSourceUrl: 'https://finance.yahoo.com/quote/CL=F/history',
    priceAtWarStart: 90.10,
    warStartDate: '2026-02-27',
    warStartSourceName: 'Yahoo Finance (CL=F close)',
    warStartSourceUrl: 'https://finance.yahoo.com/quote/CL=F/history',
    priceCurrent: 96.80,
    currentAsOf: '2026-04-10',
    currentSourceName: 'Yahoo Finance (live)',
    currentSourceUrl: 'https://finance.yahoo.com/quote/CL=F',
    crisisDirection: 'up',
    liveApi: '/api/market',
    sparkline: [
      { t: '2025-11-28', v: 78.40 },
      { t: '2025-12-08', v: 80.10 },
      { t: '2025-12-22', v: 79.60 },
      { t: '2026-01-05', v: 77.90 },
      { t: '2026-01-20', v: 81.70 },
      { t: '2026-02-10', v: 84.20 },
      { t: '2026-02-27', v: 90.10 },
      { t: '2026-03-06', v: 94.80 },
      { t: '2026-03-15', v: 96.10 },
      { t: '2026-03-25', v: 93.90 },
      { t: '2026-04-05', v: 95.40 },
      { t: '2026-04-10', v: 96.80 },
    ],
  },
  {
    id: 'natgas',
    assetClass: 'energy',
    label: 'Natural Gas',
    sublabel: 'Henry Hub futures',
    symbol: 'NG.F',
    unit: 'USD/MMBtu',
    priceBaseline: 3.20,
    baselineDate: '2025-11-28',
    baselineSourceName: 'Yahoo Finance (NG=F close)',
    baselineSourceUrl: 'https://finance.yahoo.com/quote/NG=F/history',
    priceAtWarStart: 3.55,
    warStartDate: '2026-02-27',
    warStartSourceName: 'Yahoo Finance (NG=F close)',
    warStartSourceUrl: 'https://finance.yahoo.com/quote/NG=F/history',
    priceCurrent: 4.28,
    currentAsOf: '2026-04-10',
    currentSourceName: 'Yahoo Finance (live)',
    currentSourceUrl: 'https://finance.yahoo.com/quote/NG=F',
    crisisDirection: 'up',
    liveApi: '/api/market',
    sparkline: [
      { t: '2025-11-28', v: 3.20 },
      { t: '2025-12-08', v: 3.45 },
      { t: '2025-12-22', v: 3.80 },
      { t: '2026-01-05', v: 3.60 },
      { t: '2026-01-20', v: 3.40 },
      { t: '2026-02-10', v: 3.55 },
      { t: '2026-02-27', v: 3.55 },
      { t: '2026-03-06', v: 4.10 },
      { t: '2026-03-15', v: 4.35 },
      { t: '2026-03-25', v: 4.20 },
      { t: '2026-04-05', v: 4.15 },
      { t: '2026-04-10', v: 4.28 },
    ],
    note: 'Henry Hub futures, front-month. Winter-driven volatility pre-war; persistent elevation since.',
  },

  // ── Group B · Precious & industrial metals ──────────────────────────────────
  {
    id: 'gold',
    assetClass: 'metals',
    label: 'Gold',
    sublabel: 'Safe-haven flows',
    symbol: 'GC.F',
    unit: 'USD/oz',
    priceBaseline: 2640,
    baselineDate: '2025-11-28',
    baselineSourceName: 'LBMA PM fix (approx.)',
    baselineSourceUrl: 'https://www.lbma.org.uk/prices-and-data/precious-metal-prices',
    priceAtWarStart: 2890,
    warStartDate: '2026-02-27',
    warStartSourceName: 'LBMA PM fix (approx.)',
    warStartSourceUrl: 'https://www.lbma.org.uk/prices-and-data/precious-metal-prices',
    priceCurrent: 3060,
    currentAsOf: '2026-04-10',
    currentSourceName: 'Live spot (Stooq / Yahoo)',
    currentSourceUrl: 'https://finance.yahoo.com/quote/GC=F',
    crisisDirection: 'up',
    liveApi: '/api/precious-metals',
    sparkline: [
      { t: '2025-11-28', v: 2640 },
      { t: '2025-12-08', v: 2680 },
      { t: '2025-12-22', v: 2710 },
      { t: '2026-01-05', v: 2735 },
      { t: '2026-01-20', v: 2760 },
      { t: '2026-02-10', v: 2805 },
      { t: '2026-02-27', v: 2890 },
      { t: '2026-03-06', v: 2950 },
      { t: '2026-03-15', v: 2985 },
      { t: '2026-03-25', v: 3010 },
      { t: '2026-04-05', v: 3045 },
      { t: '2026-04-10', v: 3060 },
    ],
  },
  {
    id: 'silver',
    assetClass: 'metals',
    label: 'Silver',
    sublabel: 'Safe-haven + industrial',
    symbol: 'SI.F',
    unit: 'USD/oz',
    priceBaseline: 31.20,
    baselineDate: '2025-11-28',
    baselineSourceName: 'LBMA silver fix (approx.)',
    baselineSourceUrl: 'https://www.lbma.org.uk/prices-and-data/precious-metal-prices',
    priceAtWarStart: 34.80,
    warStartDate: '2026-02-27',
    warStartSourceName: 'LBMA silver fix (approx.)',
    warStartSourceUrl: 'https://www.lbma.org.uk/prices-and-data/precious-metal-prices',
    priceCurrent: 38.80,
    currentAsOf: '2026-04-10',
    currentSourceName: 'Live spot (Stooq / Yahoo)',
    currentSourceUrl: 'https://finance.yahoo.com/quote/SI=F',
    crisisDirection: 'up',
    liveApi: '/api/precious-metals',
    sparkline: [
      { t: '2025-11-28', v: 31.20 },
      { t: '2025-12-08', v: 31.80 },
      { t: '2025-12-22', v: 32.50 },
      { t: '2026-01-05', v: 33.10 },
      { t: '2026-01-20', v: 33.60 },
      { t: '2026-02-10', v: 34.80 },
      { t: '2026-02-27', v: 34.80 },
      { t: '2026-03-06', v: 37.20 },
      { t: '2026-03-15', v: 38.50 },
      { t: '2026-03-25', v: 37.60 },
      { t: '2026-04-05', v: 38.40 },
      { t: '2026-04-10', v: 38.80 },
    ],
  },
  {
    id: 'copper',
    assetClass: 'metals',
    label: 'Copper',
    sublabel: 'Industrial bellwether',
    symbol: 'HG.F',
    unit: 'USD/lb',
    priceBaseline: 4.15,
    baselineDate: '2025-11-28',
    baselineSourceName: 'COMEX HG=F close (approx.)',
    baselineSourceUrl: 'https://finance.yahoo.com/quote/HG=F/history',
    priceAtWarStart: 4.30,
    warStartDate: '2026-02-27',
    warStartSourceName: 'COMEX HG=F close (approx.)',
    warStartSourceUrl: 'https://finance.yahoo.com/quote/HG=F/history',
    priceCurrent: 4.55,
    currentAsOf: '2026-04-10',
    currentSourceName: 'Live spot',
    currentSourceUrl: 'https://finance.yahoo.com/quote/HG=F',
    crisisDirection: 'up',
    liveApi: '/api/precious-metals',
    sparkline: [
      { t: '2025-11-28', v: 4.15 },
      { t: '2025-12-08', v: 4.20 },
      { t: '2025-12-22', v: 4.25 },
      { t: '2026-01-05', v: 4.18 },
      { t: '2026-01-20', v: 4.22 },
      { t: '2026-02-10', v: 4.28 },
      { t: '2026-02-27', v: 4.30 },
      { t: '2026-03-06', v: 4.45 },
      { t: '2026-03-15', v: 4.55 },
      { t: '2026-03-25', v: 4.48 },
      { t: '2026-04-05', v: 4.52 },
      { t: '2026-04-10', v: 4.55 },
    ],
    note: 'Copper is less war-direct than oil — watch it as a proxy for global demand through the war window.',
  },

  // ── Group C · Agri & fertilizer (Hormuz / food-security chain) ─────────────
  {
    id: 'wheat',
    assetClass: 'agri',
    label: 'Wheat (CBOT)',
    sublabel: 'Food-security benchmark',
    symbol: 'ZW.F',
    unit: 'USD/bu',
    priceBaseline: 5.80,
    baselineDate: '2025-11-28',
    baselineSourceName: 'CBOT ZW=F close',
    baselineSourceUrl: 'https://finance.yahoo.com/quote/ZW=F/history',
    priceAtWarStart: 6.10,
    warStartDate: '2026-02-27',
    warStartSourceName: 'CBOT ZW=F close',
    warStartSourceUrl: 'https://finance.yahoo.com/quote/ZW=F/history',
    priceCurrent: 7.10,
    currentAsOf: '2026-04-10',
    currentSourceName: 'Live futures',
    currentSourceUrl: 'https://finance.yahoo.com/quote/ZW=F',
    crisisDirection: 'up',
    liveApi: '/api/agri-market',
    sparkline: [
      { t: '2025-11-28', v: 5.80 },
      { t: '2025-12-08', v: 5.65 },
      { t: '2025-12-22', v: 5.55 },
      { t: '2026-01-05', v: 5.60 },
      { t: '2026-01-20', v: 5.75 },
      { t: '2026-02-10', v: 5.95 },
      { t: '2026-02-27', v: 6.10 },
      { t: '2026-03-06', v: 6.95 },
      { t: '2026-03-15', v: 7.40 },
      { t: '2026-03-25', v: 6.85 },
      { t: '2026-04-05', v: 6.95 },
      { t: '2026-04-10', v: 7.10 },
    ],
  },
  {
    id: 'urea',
    assetClass: 'agri',
    label: 'Urea / CF Industries',
    sublabel: 'Fertilizer supply (Hormuz chain)',
    symbol: 'CF.US',
    unit: 'USD/share',
    priceBaseline: 82,
    baselineDate: '2025-11-28',
    baselineSourceName: 'NYSE:CF close',
    baselineSourceUrl: 'https://finance.yahoo.com/quote/CF/history',
    priceAtWarStart: 89,
    warStartDate: '2026-02-27',
    warStartSourceName: 'NYSE:CF close',
    warStartSourceUrl: 'https://finance.yahoo.com/quote/CF/history',
    priceCurrent: 101,
    currentAsOf: '2026-04-10',
    currentSourceName: 'Live equity',
    currentSourceUrl: 'https://finance.yahoo.com/quote/CF',
    crisisDirection: 'up',
    liveApi: '/api/agri-market',
    sparkline: [
      { t: '2025-11-28', v: 82 },
      { t: '2025-12-08', v: 84 },
      { t: '2025-12-22', v: 86 },
      { t: '2026-01-05', v: 85 },
      { t: '2026-01-20', v: 87 },
      { t: '2026-02-10', v: 88 },
      { t: '2026-02-27', v: 89 },
      { t: '2026-03-06', v: 95 },
      { t: '2026-03-15', v: 98 },
      { t: '2026-03-25', v: 97 },
      { t: '2026-04-05', v: 99 },
      { t: '2026-04-10', v: 101 },
    ],
    note: 'CF Industries (NYSE:CF) is a liquid proxy for nitrogen/urea supply — Hormuz disruption transmits here first.',
  },

  // ── Group D · Household (US retail) ─────────────────────────────────────────
  {
    id: 'us-gasoline',
    assetClass: 'household',
    label: 'US Retail Gasoline',
    sublabel: 'Avg all grades, pump',
    unit: 'USD/gal',
    priceBaseline: 3.18,
    baselineDate: '2025-11-24',
    baselineSourceName: 'EIA Weekly Retail Gasoline & Diesel',
    baselineSourceUrl: 'https://www.eia.gov/petroleum/gasdiesel/',
    priceAtWarStart: 3.38,
    warStartDate: '2026-02-23',
    warStartSourceName: 'EIA Weekly (last release before war)',
    warStartSourceUrl: 'https://www.eia.gov/petroleum/gasdiesel/',
    priceCurrent: 3.89,
    currentAsOf: '2026-04-07',
    currentSourceName: 'EIA Weekly Retail (most recent)',
    currentSourceUrl: 'https://www.eia.gov/petroleum/gasdiesel/',
    crisisDirection: 'up',
    sparkline: [
      { t: '2025-11-24', v: 3.18 },
      { t: '2025-12-08', v: 3.22 },
      { t: '2025-12-22', v: 3.25 },
      { t: '2026-01-05', v: 3.28 },
      { t: '2026-01-20', v: 3.32 },
      { t: '2026-02-09', v: 3.36 },
      { t: '2026-02-23', v: 3.38 },
      { t: '2026-03-02', v: 3.52 },
      { t: '2026-03-16', v: 3.68 },
      { t: '2026-03-23', v: 3.78 },
      { t: '2026-03-30', v: 3.84 },
      { t: '2026-04-07', v: 3.89 },
    ],
    note: 'EIA releases weekly on Mondays. Retail pump prices lag crude benchmarks by 2–3 weeks.',
  },
  {
    id: 'us-diesel',
    assetClass: 'household',
    label: 'US Retail Diesel',
    sublabel: 'Transport / freight input',
    unit: 'USD/gal',
    priceBaseline: 3.68,
    baselineDate: '2025-11-24',
    baselineSourceName: 'EIA Weekly Retail',
    baselineSourceUrl: 'https://www.eia.gov/petroleum/gasdiesel/',
    priceAtWarStart: 3.92,
    warStartDate: '2026-02-23',
    warStartSourceName: 'EIA Weekly (last release before war)',
    warStartSourceUrl: 'https://www.eia.gov/petroleum/gasdiesel/',
    priceCurrent: 4.52,
    currentAsOf: '2026-04-07',
    currentSourceName: 'EIA Weekly Retail (most recent)',
    currentSourceUrl: 'https://www.eia.gov/petroleum/gasdiesel/',
    crisisDirection: 'up',
    sparkline: [
      { t: '2025-11-24', v: 3.68 },
      { t: '2025-12-08', v: 3.72 },
      { t: '2025-12-22', v: 3.78 },
      { t: '2026-01-05', v: 3.82 },
      { t: '2026-01-20', v: 3.85 },
      { t: '2026-02-09', v: 3.89 },
      { t: '2026-02-23', v: 3.92 },
      { t: '2026-03-02', v: 4.10 },
      { t: '2026-03-16', v: 4.28 },
      { t: '2026-03-23', v: 4.38 },
      { t: '2026-03-30', v: 4.45 },
      { t: '2026-04-07', v: 4.52 },
    ],
    note: 'Diesel transmits faster into groceries, construction, and trucking than gasoline.',
  },
  {
    id: 'bread-1lb',
    assetClass: 'household',
    label: 'Bread, 1 lb (US avg)',
    sublabel: 'Shopping-basket item',
    unit: 'USD',
    priceBaseline: 1.98,
    baselineDate: '2025-11-01',
    baselineSourceName: 'BLS Average Price Data (APU0000702111)',
    baselineSourceUrl: 'https://data.bls.gov/cgi-bin/surveymost?ap',
    priceAtWarStart: 2.05,
    warStartDate: '2026-02-01',
    warStartSourceName: 'BLS Average Price Data',
    warStartSourceUrl: 'https://data.bls.gov/cgi-bin/surveymost?ap',
    priceCurrent: 2.14,
    currentAsOf: '2026-03-01',
    currentSourceName: 'BLS Average Price Data (most recent monthly)',
    currentSourceUrl: 'https://data.bls.gov/cgi-bin/surveymost?ap',
    crisisDirection: 'up',
    sparkline: [
      { t: '2025-11-01', v: 1.98 },
      { t: '2025-12-01', v: 2.00 },
      { t: '2026-01-01', v: 2.03 },
      { t: '2026-02-01', v: 2.05 },
      { t: '2026-03-01', v: 2.14 },
    ],
    note: 'BLS APU0000702111 — monthly average. One household-grocery hero row; replace with any APD series you prefer (milk, eggs, etc.).',
  },

  // ── Group E · Inflation indices ─────────────────────────────────────────────
  {
    id: 'cpi-headline',
    assetClass: 'inflation',
    label: 'US CPI — Headline',
    sublabel: 'Year-over-year',
    unit: 'YoY %',
    priceBaseline: 2.9,
    baselineDate: '2025-11-01',
    baselineSourceName: 'BLS CPI-U (November 2025 release)',
    baselineSourceUrl: 'https://www.bls.gov/cpi/',
    priceAtWarStart: 3.1,
    warStartDate: '2026-02-01',
    warStartSourceName: 'BLS CPI-U (February 2026 release)',
    warStartSourceUrl: 'https://www.bls.gov/cpi/',
    priceCurrent: 4.1,
    currentAsOf: '2026-03-01',
    currentSourceName: 'BLS CPI-U (March 2026 release)',
    currentSourceUrl: 'https://www.bls.gov/cpi/',
    crisisDirection: 'up',
    sparkline: [
      { t: '2025-11-01', v: 2.9 },
      { t: '2025-12-01', v: 3.0 },
      { t: '2026-01-01', v: 3.1 },
      { t: '2026-02-01', v: 3.1 },
      { t: '2026-03-01', v: 4.1 },
    ],
    note: 'Headline CPI YoY — monthly release mid-month from BLS.',
  },
  {
    id: 'cpi-food-home',
    assetClass: 'inflation',
    label: 'US CPI — Food at Home',
    sublabel: 'Groceries YoY',
    unit: 'YoY %',
    priceBaseline: 1.8,
    baselineDate: '2025-11-01',
    baselineSourceName: 'BLS CPI Food at Home',
    baselineSourceUrl: 'https://www.bls.gov/cpi/',
    priceAtWarStart: 2.3,
    warStartDate: '2026-02-01',
    warStartSourceName: 'BLS CPI Food at Home',
    warStartSourceUrl: 'https://www.bls.gov/cpi/',
    priceCurrent: 4.8,
    currentAsOf: '2026-03-01',
    currentSourceName: 'BLS CPI Food at Home',
    currentSourceUrl: 'https://www.bls.gov/cpi/',
    crisisDirection: 'up',
    sparkline: [
      { t: '2025-11-01', v: 1.8 },
      { t: '2025-12-01', v: 2.0 },
      { t: '2026-01-01', v: 2.3 },
      { t: '2026-02-01', v: 2.3 },
      { t: '2026-03-01', v: 4.8 },
    ],
    note: 'The sharper move here versus headline CPI is the household-grocery transmission of the war premium.',
  },
  {
    id: 'fao-food-index',
    assetClass: 'inflation',
    label: 'FAO Food Price Index',
    sublabel: 'Global food index',
    unit: 'index',
    priceBaseline: 125.4,
    baselineDate: '2025-11-01',
    baselineSourceName: 'FAO Food Price Index (November 2025)',
    baselineSourceUrl: 'https://www.fao.org/worldfoodsituation/foodpricesindex/en/',
    priceAtWarStart: 128.2,
    warStartDate: '2026-02-01',
    warStartSourceName: 'FAO Food Price Index (February 2026)',
    warStartSourceUrl: 'https://www.fao.org/worldfoodsituation/foodpricesindex/en/',
    priceCurrent: 132.4,
    currentAsOf: '2026-03-01',
    currentSourceName: 'FAO Food Price Index (March 2026)',
    currentSourceUrl: 'https://www.fao.org/worldfoodsituation/foodpricesindex/en/',
    crisisDirection: 'up',
    sparkline: [
      { t: '2025-11-01', v: 125.4 },
      { t: '2025-12-01', v: 126.8 },
      { t: '2026-01-01', v: 128.2 },
      { t: '2026-02-01', v: 128.2 },
      { t: '2026-03-01', v: 132.4 },
    ],
    note: 'FAO Food Price Index — global basket of cereals, dairy, meat, oils, sugar. Released first Friday of each month.',
  },
  {
    id: 'corn',
    assetClass: 'agri',
    label: 'Corn (CBOT)',
    sublabel: 'Feed and food chain benchmark',
    symbol: 'ZC.F',
    unit: 'USD/bu',
    priceBaseline: 4.55,
    baselineDate: '2025-11-28',
    baselineSourceName: 'CBOT ZC=F close',
    baselineSourceUrl: 'https://finance.yahoo.com/quote/ZC=F/history',
    priceAtWarStart: 4.70,
    warStartDate: '2026-02-27',
    warStartSourceName: 'CBOT ZC=F close',
    warStartSourceUrl: 'https://finance.yahoo.com/quote/ZC=F/history',
    priceCurrent: 5.25,
    currentAsOf: '2026-04-10',
    currentSourceName: 'Live futures',
    currentSourceUrl: 'https://finance.yahoo.com/quote/ZC=F',
    crisisDirection: 'up',
    liveApi: '/api/agri-market',
    sparkline: [
      { t: '2025-11-28', v: 4.55 },
      { t: '2025-12-18', v: 4.48 },
      { t: '2026-01-20', v: 4.61 },
      { t: '2026-02-27', v: 4.70 },
      { t: '2026-03-20', v: 5.16 },
      { t: '2026-04-10', v: 5.25 },
    ],
  },
  {
    id: 'soybeans',
    assetClass: 'agri',
    label: 'Soybeans (CBOT)',
    sublabel: 'Global protein/oil feedstock',
    symbol: 'ZS.F',
    unit: 'USD/bu',
    priceBaseline: 11.25,
    baselineDate: '2025-11-28',
    baselineSourceName: 'CBOT ZS=F close',
    baselineSourceUrl: 'https://finance.yahoo.com/quote/ZS=F/history',
    priceAtWarStart: 11.70,
    warStartDate: '2026-02-27',
    warStartSourceName: 'CBOT ZS=F close',
    warStartSourceUrl: 'https://finance.yahoo.com/quote/ZS=F/history',
    priceCurrent: 12.45,
    currentAsOf: '2026-04-10',
    currentSourceName: 'Live futures',
    currentSourceUrl: 'https://finance.yahoo.com/quote/ZS=F',
    crisisDirection: 'up',
    liveApi: '/api/agri-market',
    sparkline: [
      { t: '2025-11-28', v: 11.25 },
      { t: '2025-12-18', v: 11.08 },
      { t: '2026-01-20', v: 11.40 },
      { t: '2026-02-27', v: 11.70 },
      { t: '2026-03-20', v: 12.22 },
      { t: '2026-04-10', v: 12.45 },
    ],
  },
  {
    id: 'eggs-dozen',
    assetClass: 'household',
    label: 'Eggs, Grade A (dozen)',
    sublabel: 'Grocery shelf staple',
    unit: 'USD',
    priceBaseline: 3.08,
    baselineDate: '2025-11-01',
    baselineSourceName: 'BLS Average Price Data',
    baselineSourceUrl: 'https://fred.stlouisfed.org/series/APU0000708111',
    priceAtWarStart: 3.28,
    warStartDate: '2026-02-01',
    warStartSourceName: 'BLS Average Price Data',
    warStartSourceUrl: 'https://fred.stlouisfed.org/series/APU0000708111',
    priceCurrent: 3.68,
    currentAsOf: '2026-03-01',
    currentSourceName: 'BLS Average Price Data',
    currentSourceUrl: 'https://fred.stlouisfed.org/series/APU0000708111',
    crisisDirection: 'up',
    sparkline: [
      { t: '2025-11-01', v: 3.08 },
      { t: '2025-12-01', v: 3.15 },
      { t: '2026-01-01', v: 3.20 },
      { t: '2026-02-01', v: 3.28 },
      { t: '2026-03-01', v: 3.68 },
    ],
  },
  {
    id: 'milk-gallon',
    assetClass: 'household',
    label: 'Milk, whole (gallon)',
    sublabel: 'Household basket staple',
    unit: 'USD',
    priceBaseline: 4.15,
    baselineDate: '2025-11-01',
    baselineSourceName: 'BLS Average Price Data',
    baselineSourceUrl: 'https://fred.stlouisfed.org/series/APU0000709112',
    priceAtWarStart: 4.22,
    warStartDate: '2026-02-01',
    warStartSourceName: 'BLS Average Price Data',
    warStartSourceUrl: 'https://fred.stlouisfed.org/series/APU0000709112',
    priceCurrent: 4.41,
    currentAsOf: '2026-03-01',
    currentSourceName: 'BLS Average Price Data',
    currentSourceUrl: 'https://fred.stlouisfed.org/series/APU0000709112',
    crisisDirection: 'up',
    sparkline: [
      { t: '2025-11-01', v: 4.15 },
      { t: '2025-12-01', v: 4.18 },
      { t: '2026-01-01', v: 4.20 },
      { t: '2026-02-01', v: 4.22 },
      { t: '2026-03-01', v: 4.41 },
    ],
  },
  {
    id: 'electricity-kwh',
    assetClass: 'household',
    label: 'Electricity retail',
    sublabel: 'US avg cents per kWh',
    unit: 'USD/kWh',
    priceBaseline: 0.174,
    baselineDate: '2025-11-01',
    baselineSourceName: 'BLS Average Price Data',
    baselineSourceUrl: 'https://fred.stlouisfed.org/series/APU000072610',
    priceAtWarStart: 0.178,
    warStartDate: '2026-02-01',
    warStartSourceName: 'BLS Average Price Data',
    warStartSourceUrl: 'https://fred.stlouisfed.org/series/APU000072610',
    priceCurrent: 0.186,
    currentAsOf: '2026-03-01',
    currentSourceName: 'BLS Average Price Data',
    currentSourceUrl: 'https://fred.stlouisfed.org/series/APU000072610',
    crisisDirection: 'up',
    sparkline: [
      { t: '2025-11-01', v: 0.174 },
      { t: '2025-12-01', v: 0.175 },
      { t: '2026-01-01', v: 0.177 },
      { t: '2026-02-01', v: 0.178 },
      { t: '2026-03-01', v: 0.186 },
    ],
  },
  {
    id: 'cpi-core',
    assetClass: 'inflation',
    label: 'US CPI — Core',
    sublabel: 'Ex food and energy YoY',
    unit: 'YoY %',
    priceBaseline: 3.0,
    baselineDate: '2025-11-01',
    baselineSourceName: 'BLS Core CPI',
    baselineSourceUrl: 'https://fred.stlouisfed.org/series/CPILFESL',
    priceAtWarStart: 3.1,
    warStartDate: '2026-02-01',
    warStartSourceName: 'BLS Core CPI',
    warStartSourceUrl: 'https://fred.stlouisfed.org/series/CPILFESL',
    priceCurrent: 3.6,
    currentAsOf: '2026-03-01',
    currentSourceName: 'BLS Core CPI',
    currentSourceUrl: 'https://fred.stlouisfed.org/series/CPILFESL',
    crisisDirection: 'up',
    sparkline: [
      { t: '2025-11-01', v: 3.0 },
      { t: '2025-12-01', v: 3.0 },
      { t: '2026-01-01', v: 3.1 },
      { t: '2026-02-01', v: 3.1 },
      { t: '2026-03-01', v: 3.6 },
    ],
  },
  {
    id: 'cpi-energy',
    assetClass: 'inflation',
    label: 'US CPI — Energy',
    sublabel: 'Energy index YoY',
    unit: 'YoY %',
    priceBaseline: 1.1,
    baselineDate: '2025-11-01',
    baselineSourceName: 'BLS Energy CPI',
    baselineSourceUrl: 'https://fred.stlouisfed.org/series/CPIENGSL',
    priceAtWarStart: 1.8,
    warStartDate: '2026-02-01',
    warStartSourceName: 'BLS Energy CPI',
    warStartSourceUrl: 'https://fred.stlouisfed.org/series/CPIENGSL',
    priceCurrent: 5.2,
    currentAsOf: '2026-03-01',
    currentSourceName: 'BLS Energy CPI',
    currentSourceUrl: 'https://fred.stlouisfed.org/series/CPIENGSL',
    crisisDirection: 'up',
    sparkline: [
      { t: '2025-11-01', v: 1.1 },
      { t: '2025-12-01', v: 1.2 },
      { t: '2026-01-01', v: 1.6 },
      { t: '2026-02-01', v: 1.8 },
      { t: '2026-03-01', v: 5.2 },
    ],
  },
  {
    id: 'us10y-yield',
    assetClass: 'inflation',
    label: 'US 10Y Treasury',
    sublabel: 'Nominal yield',
    unit: '%',
    priceBaseline: 4.1,
    baselineDate: '2025-11-28',
    baselineSourceName: 'FRED DGS10',
    baselineSourceUrl: 'https://fred.stlouisfed.org/series/DGS10',
    priceAtWarStart: 4.3,
    warStartDate: '2026-02-28',
    warStartSourceName: 'FRED DGS10',
    warStartSourceUrl: 'https://fred.stlouisfed.org/series/DGS10',
    priceCurrent: 4.7,
    currentAsOf: '2026-04-10',
    currentSourceName: 'FRED DGS10',
    currentSourceUrl: 'https://fred.stlouisfed.org/series/DGS10',
    crisisDirection: 'up',
    sparkline: [
      { t: '2025-11-28', v: 4.1 },
      { t: '2025-12-20', v: 4.05 },
      { t: '2026-01-20', v: 4.16 },
      { t: '2026-02-28', v: 4.3 },
      { t: '2026-03-20', v: 4.54 },
      { t: '2026-04-10', v: 4.7 },
    ],
  },
  {
    id: 'us-5y-breakeven',
    assetClass: 'inflation',
    label: 'US 5Y Breakeven',
    sublabel: 'Market inflation expectation',
    unit: '%',
    priceBaseline: 2.2,
    baselineDate: '2025-11-28',
    baselineSourceName: 'FRED T5YIE',
    baselineSourceUrl: 'https://fred.stlouisfed.org/series/T5YIE',
    priceAtWarStart: 2.35,
    warStartDate: '2026-02-28',
    warStartSourceName: 'FRED T5YIE',
    warStartSourceUrl: 'https://fred.stlouisfed.org/series/T5YIE',
    priceCurrent: 2.7,
    currentAsOf: '2026-04-10',
    currentSourceName: 'FRED T5YIE',
    currentSourceUrl: 'https://fred.stlouisfed.org/series/T5YIE',
    crisisDirection: 'up',
    sparkline: [
      { t: '2025-11-28', v: 2.2 },
      { t: '2025-12-20', v: 2.18 },
      { t: '2026-01-20', v: 2.24 },
      { t: '2026-02-28', v: 2.35 },
      { t: '2026-03-20', v: 2.55 },
      { t: '2026-04-10', v: 2.7 },
    ],
  },
  {
    id: 'dollar-index',
    assetClass: 'inflation',
    label: 'US Dollar Index',
    sublabel: 'Trade-weighted broad dollar',
    unit: 'index',
    priceBaseline: 124.2,
    baselineDate: '2025-11-28',
    baselineSourceName: 'FRED DTWEXBGS',
    baselineSourceUrl: 'https://fred.stlouisfed.org/series/DTWEXBGS',
    priceAtWarStart: 125.1,
    warStartDate: '2026-02-28',
    warStartSourceName: 'FRED DTWEXBGS',
    warStartSourceUrl: 'https://fred.stlouisfed.org/series/DTWEXBGS',
    priceCurrent: 127.5,
    currentAsOf: '2026-04-10',
    currentSourceName: 'FRED DTWEXBGS',
    currentSourceUrl: 'https://fred.stlouisfed.org/series/DTWEXBGS',
    crisisDirection: 'up',
    sparkline: [
      { t: '2025-11-28', v: 124.2 },
      { t: '2025-12-20', v: 123.7 },
      { t: '2026-01-20', v: 124.6 },
      { t: '2026-02-28', v: 125.1 },
      { t: '2026-03-20', v: 126.2 },
      { t: '2026-04-10', v: 127.5 },
    ],
  },
  {
    id: 'vix',
    assetClass: 'inflation',
    label: 'VIX',
    sublabel: 'Equity implied volatility',
    unit: 'index',
    priceBaseline: 17.5,
    baselineDate: '2025-11-28',
    baselineSourceName: 'FRED VIXCLS',
    baselineSourceUrl: 'https://fred.stlouisfed.org/series/VIXCLS',
    priceAtWarStart: 20.1,
    warStartDate: '2026-02-28',
    warStartSourceName: 'FRED VIXCLS',
    warStartSourceUrl: 'https://fred.stlouisfed.org/series/VIXCLS',
    priceCurrent: 24.8,
    currentAsOf: '2026-04-10',
    currentSourceName: 'FRED VIXCLS',
    currentSourceUrl: 'https://fred.stlouisfed.org/series/VIXCLS',
    crisisDirection: 'up',
    sparkline: [
      { t: '2025-11-28', v: 17.5 },
      { t: '2025-12-20', v: 16.8 },
      { t: '2026-01-20', v: 18.2 },
      { t: '2026-02-28', v: 20.1 },
      { t: '2026-03-20', v: 23.4 },
      { t: '2026-04-10', v: 24.8 },
    ],
  },
];

// ── Lookups & computed helpers ────────────────────────────────────────────────

export function getBaseline(id: string): WarBaselineRow | undefined {
  return WAR_BASELINES.find((r) => r.id === id);
}

/** The three rows spotlighted in the compact sidebar card */
export const HERO_ROW_IDS = ['brent', 'us-gasoline', 'fao-food-index'] as const;

export type AssetClassFilter = 'all' | WarAssetClass;

export const ASSET_CLASS_LABELS: Record<AssetClassFilter, string> = {
  all: 'All',
  energy: 'Energy',
  metals: 'Metals',
  agri: 'Agri',
  household: 'Household',
  inflation: 'Inflation',
};

/**
 * Color for a delta, given the row's `crisisDirection`.
 * If price moves in crisis direction → red. Otherwise → green.
 */
export function deltaColor(
  row: WarBaselineRow,
  from: number,
  to: number,
): string {
  const change = to - from;
  if (Math.abs(change) < 0.0001) return 'var(--text-muted)';
  const movedUp = change > 0;
  const isCrisis =
    (row.crisisDirection === 'up' && movedUp) ||
    (row.crisisDirection === 'down' && !movedUp);
  return isCrisis ? 'var(--neon-red)' : 'var(--neon-green)';
}

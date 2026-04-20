import { Router, Request, Response } from 'express';

const router = Router();

const BASELINE = '2025-11-28';
const WAR_START = '2026-02-28';

type SeriesPoint = { t: string; v: number };
type HouseholdConfig = {
  id: string;
  seriesId: string;
  unit: string;
  sourceName: string;
  sourceUrl: string;
  transform?: (v: number) => number;
};
type RowPayload = {
  id: string;
  unit: string;
  baselineDate: string;
  warStartDate: string;
  currentAsOf: string;
  priceBaseline: number;
  priceAtWarStart: number;
  priceCurrent: number;
  sparkline: SeriesPoint[];
  sourceName: string;
  sourceUrl: string;
};

const SERIES: HouseholdConfig[] = [
  {
    id: 'us-gasoline',
    seriesId: 'GASREGW',
    unit: 'USD/gal',
    sourceName: 'FRED (EIA weekly gasoline)',
    sourceUrl: 'https://fred.stlouisfed.org/series/GASREGW',
  },
  {
    id: 'us-diesel',
    seriesId: 'GASDESW',
    unit: 'USD/gal',
    sourceName: 'FRED (EIA weekly diesel)',
    sourceUrl: 'https://fred.stlouisfed.org/series/GASDESW',
  },
  {
    id: 'bread-1lb',
    seriesId: 'APU0000702111',
    unit: 'USD',
    sourceName: 'FRED (BLS avg price bread, 1 lb)',
    sourceUrl: 'https://fred.stlouisfed.org/series/APU0000702111',
  },
  {
    id: 'eggs-dozen',
    seriesId: 'APU0000708111',
    unit: 'USD',
    sourceName: 'FRED (BLS avg price eggs, grade A, dozen)',
    sourceUrl: 'https://fred.stlouisfed.org/series/APU0000708111',
  },
  {
    id: 'milk-gallon',
    seriesId: 'APU0000709112',
    unit: 'USD',
    sourceName: 'FRED (BLS avg price whole milk, per gallon)',
    sourceUrl: 'https://fred.stlouisfed.org/series/APU0000709112',
  },
  {
    id: 'electricity-kwh',
    seriesId: 'APU000072610',
    unit: 'USD/kWh',
    sourceName: 'FRED (BLS avg retail electricity, per kWh)',
    sourceUrl: 'https://fred.stlouisfed.org/series/APU000072610',
  },
  {
    id: 'cpi-headline',
    seriesId: 'CPIAUCSL',
    unit: 'YoY %',
    sourceName: 'FRED (BLS CPIAUCSL transformed YoY)',
    sourceUrl: 'https://fred.stlouisfed.org/series/CPIAUCSL',
    transform: (v) => v,
  },
  {
    id: 'cpi-food-home',
    seriesId: 'CUSR0000SAF11',
    unit: 'YoY %',
    sourceName: 'FRED (BLS Food at home CPI transformed YoY)',
    sourceUrl: 'https://fred.stlouisfed.org/series/CUSR0000SAF11',
    transform: (v) => v,
  },
  {
    id: 'cpi-core',
    seriesId: 'CPILFESL',
    unit: 'YoY %',
    sourceName: 'FRED (Core CPI transformed YoY)',
    sourceUrl: 'https://fred.stlouisfed.org/series/CPILFESL',
    transform: (v) => v,
  },
  {
    id: 'cpi-energy',
    seriesId: 'CPIENGSL',
    unit: 'YoY %',
    sourceName: 'FRED (Energy CPI transformed YoY)',
    sourceUrl: 'https://fred.stlouisfed.org/series/CPIENGSL',
    transform: (v) => v,
  },
  {
    id: 'fao-food-index',
    seriesId: 'PFOODINDEXM',
    unit: 'index',
    sourceName: 'FRED (Food price index)',
    sourceUrl: 'https://fred.stlouisfed.org/series/PFOODINDEXM',
  },
  {
    id: 'us10y-yield',
    seriesId: 'DGS10',
    unit: '%',
    sourceName: 'FRED (US 10Y Treasury constant maturity)',
    sourceUrl: 'https://fred.stlouisfed.org/series/DGS10',
  },
  {
    id: 'us-5y-breakeven',
    seriesId: 'T5YIE',
    unit: '%',
    sourceName: 'FRED (5Y breakeven inflation)',
    sourceUrl: 'https://fred.stlouisfed.org/series/T5YIE',
  },
  {
    id: 'dollar-index',
    seriesId: 'DTWEXBGS',
    unit: 'index',
    sourceName: 'FRED (Trade weighted US dollar index)',
    sourceUrl: 'https://fred.stlouisfed.org/series/DTWEXBGS',
  },
  {
    id: 'vix',
    seriesId: 'VIXCLS',
    unit: 'index',
    sourceName: 'FRED (CBOE VIX close)',
    sourceUrl: 'https://fred.stlouisfed.org/series/VIXCLS',
  },
];

let _cache: { at: number; payload: unknown } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

function normalizeDate(input: string): string {
  return input.slice(0, 10);
}

function nearestOnOrBefore(series: SeriesPoint[], targetDate: string): SeriesPoint | null {
  const target = new Date(targetDate).getTime();
  let best: SeriesPoint | null = null;
  for (const point of series) {
    const ts = new Date(point.t).getTime();
    if (Number.isNaN(ts) || ts > target) continue;
    if (!best || ts > new Date(best.t).getTime()) best = point;
  }
  return best;
}

function sampleSeries(series: SeriesPoint[], maxPoints = 24): SeriesPoint[] {
  if (series.length <= maxPoints) return series;
  const out: SeriesPoint[] = [];
  const step = (series.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step);
    out.push(series[idx]);
  }
  return out;
}

async function fetchFredSeries(seriesId: string): Promise<SeriesPoint[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const start = BASELINE.slice(0, 7);
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}&cosd=${start}-01`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/csv' },
    });
    if (!res.ok) return [];
    const csv = await res.text();
    const lines = csv.split('\n').map((v) => v.trim()).filter(Boolean);
    const points: SeriesPoint[] = [];
    for (let i = 1; i < lines.length; i++) {
      const [date, valueRaw] = lines[i].split(',');
      if (!date || !valueRaw || valueRaw === '.') continue;
      const value = Number(valueRaw);
      if (!Number.isFinite(value)) continue;
      points.push({ t: normalizeDate(date), v: value });
    }
    return points.sort((a, b) => a.t.localeCompare(b.t));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function toYoY(rawSeries: SeriesPoint[]): SeriesPoint[] {
  const byMonth = new Map<string, number>();
  for (const pt of rawSeries) byMonth.set(pt.t.slice(0, 7), pt.v);
  const out: SeriesPoint[] = [];
  for (const pt of rawSeries) {
    const date = new Date(`${pt.t}T00:00:00Z`);
    date.setUTCFullYear(date.getUTCFullYear() - 1);
    const priorKey = date.toISOString().slice(0, 7);
    const prev = byMonth.get(priorKey);
    if (!prev || prev === 0) continue;
    out.push({ t: pt.t, v: ((pt.v - prev) / prev) * 100 });
  }
  return out;
}

router.get('/', async (_req: Request, res: Response) => {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
    return res
      .set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=300')
      .json(_cache.payload);
  }

  try {
    const rows = await Promise.all(
      SERIES.map(async (cfg): Promise<RowPayload | null> => {
        const fetched = await fetchFredSeries(cfg.seriesId);
        if (fetched.length < 2) return null;
        const series = cfg.unit === 'YoY %' ? toYoY(fetched) : fetched;
        if (series.length < 2) return null;
        const baseline = nearestOnOrBefore(series, BASELINE) ?? series[0];
        const war = nearestOnOrBefore(series, WAR_START) ?? baseline;
        const current = series[series.length - 1];
        const applyTransform = cfg.transform ?? ((v: number) => v);
        return {
          id: cfg.id,
          unit: cfg.unit,
          baselineDate: baseline.t,
          warStartDate: war.t,
          currentAsOf: current.t,
          priceBaseline: applyTransform(baseline.v),
          priceAtWarStart: applyTransform(war.v),
          priceCurrent: applyTransform(current.v),
          sparkline: sampleSeries(series).map((p) => ({ t: p.t, v: applyTransform(p.v) })),
          sourceName: cfg.sourceName,
          sourceUrl: cfg.sourceUrl,
        };
      }),
    );

    const payload = {
      ok: true,
      anchors: { baseline: BASELINE, warStart: WAR_START },
      rows: rows.filter((r): r is RowPayload => Boolean(r)),
      generatedAt: new Date().toISOString(),
    };
    _cache = { at: Date.now(), payload };
    return res
      .set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=300')
      .json(payload);
  } catch (err) {
    console.error('[FTG household-prices]', err);
    return res.status(500).json({ ok: false, error: 'household_prices_unavailable' });
  }
});

export default router;

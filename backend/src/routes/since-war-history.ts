import { Router, Request, Response } from 'express';

const router = Router();

const BASELINE = '2025-11-28';
const WAR_START = '2026-02-28';

type SourceKind = 'stooq' | 'fred';
type RowConfig = {
  id: string;
  source: SourceKind;
  symbol: string;
  unit: string;
};

type SeriesPoint = { t: string; v: number };
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
};

const ROWS: RowConfig[] = [
  { id: 'brent', source: 'stooq', symbol: 'cb.f', unit: 'USD/bbl' },
  { id: 'wti', source: 'stooq', symbol: 'cl.f', unit: 'USD/bbl' },
  { id: 'natgas', source: 'stooq', symbol: 'ng.f', unit: 'USD/MMBtu' },
  { id: 'gold', source: 'stooq', symbol: 'gc.f', unit: 'USD/oz' },
  { id: 'silver', source: 'stooq', symbol: 'si.f', unit: 'USD/oz' },
  { id: 'copper', source: 'stooq', symbol: 'hg.f', unit: 'USD/lb' },
  { id: 'wheat', source: 'stooq', symbol: 'zw.f', unit: 'USD/bu' },
  { id: 'corn', source: 'stooq', symbol: 'zc.f', unit: 'USD/bu' },
  { id: 'soybeans', source: 'stooq', symbol: 'zs.f', unit: 'USD/bu' },
  { id: 'urea', source: 'stooq', symbol: 'cf.us', unit: 'USD/share' },
];

const CACHE_TTL_MS = 10 * 60 * 1000;
let _cache: { at: number; payload: unknown } | null = null;

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

function sampleSeries(series: SeriesPoint[], maxPoints = 40): SeriesPoint[] {
  if (series.length <= maxPoints) return series;
  const out: SeriesPoint[] = [];
  const step = (series.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step);
    out.push(series[idx]);
  }
  return out;
}

function normalizePointValue(rowId: string, raw: number): number {
  // Stooq grain futures often come in cents/bushel while UI expects USD/bu.
  if ((rowId === 'wheat' || rowId === 'corn' || rowId === 'soybeans') && raw > 100) {
    return raw / 100;
  }
  return raw;
}

async function fetchStooqHistory(symbol: string): Promise<SeriesPoint[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const url =
      `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&d1=${BASELINE.replaceAll('-', '')}&d2=${new Date().toISOString().slice(0, 10).replaceAll('-', '')}&i=d`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/csv' },
    });
    if (!res.ok) return [];
    const csv = await res.text();
    const lines = csv.split('\n').map((v) => v.trim()).filter(Boolean);
    const points: SeriesPoint[] = [];
    for (let i = 1; i < lines.length; i++) {
      const [date, _open, _high, _low, close] = lines[i].split(',');
      const value = Number(close);
      if (!date || !Number.isFinite(value) || value <= 0) continue;
      points.push({ t: normalizeDate(date), v: value });
    }
    return points.sort((a, b) => a.t.localeCompare(b.t));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

router.get('/', async (_req: Request, res: Response) => {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
    return res
      .set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=120')
      .json(_cache.payload);
  }

  try {
    const rows = await Promise.all(
      ROWS.map(async (row): Promise<RowPayload | null> => {
        const seriesRaw = await fetchStooqHistory(row.symbol);
        const series = seriesRaw.map((p) => ({ ...p, v: normalizePointValue(row.id, p.v) }));
        if (series.length < 2) return null;
        const baseline = nearestOnOrBefore(series, BASELINE) ?? series[0];
        const war = nearestOnOrBefore(series, WAR_START) ?? baseline;
        const current = series[series.length - 1];
        if (!baseline || !war || !current) return null;
        return {
          id: row.id,
          unit: row.unit,
          baselineDate: baseline.t,
          warStartDate: war.t,
          currentAsOf: current.t,
          priceBaseline: baseline.v,
          priceAtWarStart: war.v,
          priceCurrent: current.v,
          sparkline: sampleSeries(series),
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
      .set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=120')
      .json(payload);
  } catch (err) {
    console.error('[FTG since-war-history]', err);
    return res.status(500).json({ ok: false, error: 'since_war_history_unavailable' });
  }
});

export default router;

/**
 * GET /api/oil-history?range=1d|7d
 * Historical OHLCV from Stooq. In-memory cache: 5 min (1d), 15 min (7d).
 */

import { Router, Request, Response } from 'express';

const router = Router();

type OHLCPoint = { t: string; o: number; h: number; l: number; c: number };
type Series    = { symbol: string; name: string; color: string; points: OHLCPoint[] };

const SYMBOLS = [
  { symbol: 'CL.F', name: 'WTI Crude',  color: '#e74c3c' },
  { symbol: 'CB.F', name: 'Brent Crude', color: '#3498db' },
  { symbol: 'NG.F', name: 'Natural Gas', color: '#2ecc71' },
];

const _cache: Record<string, { data: Series[]; at: number }> = {};
const TTL_1D = 5  * 60 * 1000;
const TTL_7D = 15 * 60 * 1000;

function parseCSV(csv: string): OHLCPoint[] {
  const lines  = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(',');
  const iDate  = header.indexOf('date');  const iTime  = header.indexOf('time');
  const iOpen  = header.indexOf('open');  const iHigh  = header.indexOf('high');
  const iLow   = header.indexOf('low');   const iClose = header.indexOf('close');
  const points: OHLCPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols    = lines[i].split(',');
    const dateStr = cols[iDate]?.trim() ?? '';
    const timeStr = iTime >= 0 ? (cols[iTime]?.trim() ?? '00:00:00') : '00:00:00';
    if (!dateStr) continue;
    const o = parseFloat(cols[iOpen]  ?? '0');
    const h = parseFloat(cols[iHigh]  ?? '0');
    const l = parseFloat(cols[iLow]   ?? '0');
    const c = parseFloat(cols[iClose] ?? '0');
    if (!c && !o) continue;
    points.push({ t: `${dateStr}T${timeStr}`, o, h, l, c });
  }
  return points;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchSeries(sym: string, range: '1d' | '7d'): Promise<OHLCPoint[]> {
  const headers = { 'User-Agent': 'Mozilla/5.0 Chrome/120', 'Accept': 'text/plain' };
  let url: string;
  if (range === '1d') {
    url = `https://stooq.com/q/d/l/?s=${sym.toLowerCase()}&i=h`;
  } else {
    const end   = new Date();
    const start = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);
    url = `https://stooq.com/q/d/l/?s=${sym.toLowerCase()}&d1=${fmtDate(start)}&d2=${fmtDate(end)}&i=d`;
  }
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) throw new Error(`Stooq ${res.status}`);
    const text = await res.text();
    if (text.includes('No data')) return [];
    let pts = parseCSV(text);
    pts = range === '1d' ? pts.slice(-24) : pts.slice(-7);
    return pts;
  } finally {
    clearTimeout(timeout);
  }
}

router.get('/', async (req: Request, res: Response) => {
  const range = (req.query.range ?? '7d') === '1d' ? '1d' : '7d';
  const ttl   = range === '1d' ? TTL_1D : TTL_7D;

  const cached = _cache[range];
  if (cached && Date.now() - cached.at < ttl) {
    return res.set('Cache-Control', `public, s-maxage=${Math.floor(ttl / 1000)}`).json({ range, series: cached.data, cached: true });
  }

  try {
    const seriesData: Series[] = await Promise.all(
      SYMBOLS.map(async ({ symbol, name, color }) => {
        try { return { symbol, name, color, points: await fetchSeries(symbol, range) }; }
        catch { return { symbol, name, color, points: [] }; }
      })
    );
    if (seriesData.some(s => s.points.length > 0)) _cache[range] = { data: seriesData, at: Date.now() };
    return res.set('Cache-Control', `public, s-maxage=${Math.floor(ttl / 1000)}, stale-while-revalidate=60`).json({ range, series: seriesData });
  } catch (err) {
    console.error('[FTG oil-history]', err);
    return res.status(500).json({ error: 'History unavailable' });
  }
});

export default router;

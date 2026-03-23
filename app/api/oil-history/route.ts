/**
 * /api/oil-history?range=1d|7d
 *
 * Fetches historical OHLCV data from Stooq for key oil benchmarks.
 *
 * range=1d  → intraday hourly data  (last ~24h)
 * range=7d  → daily data            (last 7 trading days)
 *
 * Returns:
 *   { range, series: { symbol, name, color, points: { t, o, h, l, c }[] }[] }
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 0;

const SYMBOLS = [
  { symbol: 'CL.F',  name: 'WTI Crude',   color: '#e74c3c' },
  { symbol: 'CB.F',  name: 'Brent Crude',  color: '#3498db' },
  { symbol: 'NG.F',  name: 'Natural Gas',  color: '#2ecc71' },
];

type OHLCPoint = { t: string; o: number; h: number; l: number; c: number };
type Series    = { symbol: string; name: string; color: string; points: OHLCPoint[] };

// In-process cache per range (Vercel lambdas are short-lived, but helps burst requests)
const _cache: Record<string, { data: Series[]; at: number }> = {};
const TTL_1D = 5  * 60 * 1000;   // 5 min for intraday
const TTL_7D = 15 * 60 * 1000;   // 15 min for daily

/** Parse Stooq CSV response → OHLCPoint[] */
function parseCSV(csv: string): OHLCPoint[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(',');
  const iDate  = header.indexOf('date');
  const iTime  = header.indexOf('time');
  const iOpen  = header.indexOf('open');
  const iHigh  = header.indexOf('high');
  const iLow   = header.indexOf('low');
  const iClose = header.indexOf('close');

  const points: OHLCPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const dateStr = cols[iDate]?.trim() ?? '';
    const timeStr = iTime >= 0 ? (cols[iTime]?.trim() ?? '00:00:00') : '00:00:00';
    if (!dateStr) continue;

    const o = parseFloat(cols[iOpen]  ?? '0');
    const h = parseFloat(cols[iHigh]  ?? '0');
    const l = parseFloat(cols[iLow]   ?? '0');
    const c = parseFloat(cols[iClose] ?? '0');
    if (!c && !o) continue;

    // Stooq date format: YYYY-MM-DD, time: HH:MM:SS
    points.push({ t: `${dateStr}T${timeStr}`, o, h, l, c });
  }
  return points;
}

/** Format date as YYYYMMDD for Stooq */
function fmtDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchSeries(sym: string, range: '1d' | '7d'): Promise<OHLCPoint[]> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120',
    'Accept': 'text/plain',
  };

  let url: string;
  if (range === '1d') {
    // Intraday hourly — Stooq serves last ~5 sessions
    url = `https://stooq.com/q/d/l/?s=${sym.toLowerCase()}&i=h`;
  } else {
    // Daily — last 14 calendar days, keep last 7 trading sessions
    const end   = new Date();
    const start = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);
    url = `https://stooq.com/q/d/l/?s=${sym.toLowerCase()}&d1=${fmtDate(start)}&d2=${fmtDate(end)}&i=d`;
  }

  const res = await fetch(url, { headers, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Stooq ${res.status} for ${sym}`);
  const text = await res.text();
  if (text.includes('No data')) return [];

  let pts = parseCSV(text);

  if (range === '1d') {
    // Keep only the last 24 data points (≈ one full session of hourly bars)
    pts = pts.slice(-24);
  } else {
    // Keep last 7 trading days
    pts = pts.slice(-7);
  }

  return pts;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = (searchParams.get('range') ?? '7d') === '1d' ? '1d' : '7d';
  const ttl   = range === '1d' ? TTL_1D : TTL_7D;

  // Return cache if fresh
  const cached = _cache[range];
  if (cached && Date.now() - cached.at < ttl) {
    const res = NextResponse.json({ range, series: cached.data, cached: true });
    res.headers.set('Cache-Control', `public, s-maxage=${Math.floor(ttl / 1000)}`);
    return res;
  }

  try {
    const seriesData: Series[] = await Promise.all(
      SYMBOLS.map(async ({ symbol, name, color }) => {
        try {
          const points = await fetchSeries(symbol, range);
          return { symbol, name, color, points };
        } catch {
          return { symbol, name, color, points: [] };
        }
      })
    );

    // Only cache if at least one series has data
    if (seriesData.some(s => s.points.length > 0)) {
      _cache[range] = { data: seriesData, at: Date.now() };
    }

    const res = NextResponse.json({ range, series: seriesData });
    res.headers.set('Cache-Control', `public, s-maxage=${Math.floor(ttl / 1000)}, stale-while-revalidate=60`);
    return res;
  } catch (err) {
    console.error('[FTG oil-history]', err);
    return NextResponse.json({ error: 'History unavailable' }, { status: 500 });
  }
}

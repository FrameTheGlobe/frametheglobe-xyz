/**
 * GET /api/precious-metals
 * Gold, silver, platinum, palladium via Stooq.
 * In-memory cache: 60 seconds.
 */

import { Router, Request, Response } from 'express';

const router = Router();

interface StooqSymbol { symbol: string; open: number | null; close: number | null; [k: string]: unknown; }

let _cache: { data: object[]; at: number } | null = null;
const CACHE_TTL = 60 * 1000;

const NAME_MAP: Record<string, string> = {
  'GC.F':   'Gold (Futures)',    'SI.F':   'Silver (Futures)',
  'PL.F':   'Platinum (Futures)','PA.F':   'Palladium (Futures)',
  'GLD.US': 'Gold (GLD ETF)',    'SLV.US': 'Silver (SLV ETF)',
};
const UNIT_MAP: Record<string, string> = {
  'GC.F': 'USD/troy oz', 'SI.F': 'USD/troy oz', 'PL.F': 'USD/troy oz',
  'PA.F': 'USD/troy oz', 'GLD.US': 'USD/share', 'SLV.US': 'USD/share',
};

router.get('/', async (_req: Request, res: Response) => {
  if (_cache && Date.now() - _cache.at < CACHE_TTL) {
    return res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30').json(_cache.data);
  }
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8_000);
  try {
    const symbols = 'gc.f+si.f+pl.f+pa.f+gld.us+slv.us';
    const fetched = await fetch(`https://stooq.com/q/l/?s=${symbols}&f=sd2t2ohlcv&h&e=json`, {
      signal:  controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0', 'Accept': 'application/json' },
    });
    if (!fetched.ok) throw new Error(`Stooq ${fetched.status}`);
    const text      = await fetched.text();
    const sanitized = text.replace(/"volume":\s*}/g, '"volume":null}').replace(/"volume":\s*,/g, '"volume":null,');
    const raw       = JSON.parse(sanitized);
    const results: StooqSymbol[] = raw.symbols || [];
    const mapped = results.map(r => {
      const price = r.close || r.open || 0;
      const open  = r.open  || price || 1;
      const sym   = (r.symbol || '').toUpperCase();
      return { symbol: sym, name: NAME_MAP[sym] ?? sym, price,
               change: price - open, changePercent: ((price - open) / open) * 100,
               unit: UNIT_MAP[sym] ?? 'USD' };
    }).filter(q => q.price > 0);
    _cache = { data: mapped, at: Date.now() };
    return res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30').json(mapped);
  } catch (err) {
    console.error('[FTG precious-metals]', err);
    return res.status(500).json({ error: 'Precious metals data temporarily unavailable.' });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;

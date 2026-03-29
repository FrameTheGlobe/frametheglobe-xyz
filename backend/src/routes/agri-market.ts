/**
 * GET /api/agri-market
 * Hormuz-adjacent agricultural & fertilizer commodity prices via Stooq.
 * In-memory cache: 60 seconds.
 */

import { Router, Request, Response } from 'express';

const router = Router();

interface StooqSymbol { symbol: string; open: number | null; close: number | null; [k: string]: unknown; }

let _cache: { data: object[]; at: number } | null = null;
const CACHE_TTL = 60 * 1000;

const NAME_MAP: Record<string, string> = {
  'CF.US':   'CF Industries (Urea)',
  'MOS.US':  'Mosaic Co. (Potash)',
  'WEAT.US': 'Wheat (WEAT ETF)',
  'CORN.US': 'Corn (CORN ETF)',
  'SOYB.US': 'Soybeans (SOYB ETF)',
  'NG.F':    'Natural Gas',
};
const UNIT_MAP: Record<string, string> = {
  'CF.US':   'USD/share', 'MOS.US':  'USD/share', 'WEAT.US': 'USD/share',
  'CORN.US': 'USD/share', 'SOYB.US': 'USD/share', 'NG.F':    'USD/MMBtu',
};

router.get('/', async (_req: Request, res: Response) => {
  if (_cache && Date.now() - _cache.at < CACHE_TTL) {
    return res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30').json(_cache.data);
  }

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8_000);
  try {
    const symbols = 'cf.us+mos.us+weat.us+corn.us+soyb.us+ng.f';
    const url     = `https://stooq.com/q/l/?s=${symbols}&f=sd2t2ohlcv&h&e=json`;
    const fetched = await fetch(url, {
      signal: controller.signal,
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
    console.error('[FTG agri-market]', err);
    return res.status(500).json({ error: 'Agri market data temporarily unavailable.' });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;

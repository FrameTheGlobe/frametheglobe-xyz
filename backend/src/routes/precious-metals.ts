/**
 * GET /api/precious-metals
 * Gold / silver / platinum / palladium futures + GLD/SLV — Yahoo Finance primary
 * (Stooq SI.F is off by ~100× vs liquid COMEX quotes), Stooq batch fallback.
 * In-memory cache: 60 seconds.
 */

import { Router, Request, Response } from 'express';

const router = Router();

interface MetalQuote {
  symbol:        string;
  name:          string;
  price:         number;
  change:        number;
  changePercent: number;
  unit:          string;
}

interface StooqSymbol { symbol: string; open: number | null; close: number | null; [k: string]: unknown; }

let _cache: { data: MetalQuote[]; at: number } | null = null;
const CACHE_TTL = 60 * 1000;

const NAME_MAP: Record<string, string> = {
  'GC.F':   'Gold (Futures)',     'SI.F':   'Silver (Futures)',
  'PL.F':   'Platinum (Futures)', 'PA.F':   'Palladium (Futures)',
  'HG.F':   'Copper (Futures)',
  'GLD.US': 'Gold (GLD ETF)',     'SLV.US': 'Silver (SLV ETF)',
};
const UNIT_MAP: Record<string, string> = {
  'GC.F': 'USD/troy oz', 'SI.F': 'USD/troy oz', 'PL.F': 'USD/troy oz',
  'PA.F': 'USD/troy oz', 'HG.F': 'USD/lb', 'GLD.US': 'USD/share', 'SLV.US': 'USD/share',
};

const YAHOO_PAIRS: [string, string][] = [
  ['GC=F', 'GC.F'], ['SI=F', 'SI.F'], ['PL=F', 'PL.F'], ['PA=F', 'PA.F'],
  ['HG=F', 'HG.F'],
  ['GLD', 'GLD.US'], ['SLV', 'SLV.US'],
];

async function fetchYahooMetal(yfSym: string, outSym: string): Promise<MetalQuote | null> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8_000);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      signal:  controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FrameTheGlobe/1.0)' },
    });
    if (!res.ok) return null;
    const data   = await res.json() as { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } };
    const meta   = data?.chart?.result?.[0]?.meta;
    const price  = meta?.regularMarketPrice as number | undefined;
    if (!price || price <= 0) return null;
    const prev          = (meta?.chartPreviousClose as number | undefined) ?? price;
    const change        = price - prev;
    const changePercent = prev > 0 ? (change / prev) * 100 : 0;
    return {
      symbol: outSym,
      name:   NAME_MAP[outSym] ?? outSym,
      price, change, changePercent,
      unit:   UNIT_MAP[outSym] ?? 'USD',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Stooq SI.F often prints ~100× the USD/oz quote; normalize when obviously scaled. */
function normalizeStooqRow(sym: string, price: number, open: number): { price: number; open: number; change: number; changePercent: number } {
  let p = price;
  let o = open || price || 1;
  if (sym === 'SI.F' && p > 400) {
    p *= 0.01;
    o *= 0.01;
  }
  const change        = p - o;
  const changePercent = o > 0 ? (change / o) * 100 : 0;
  return { price: p, open: o, change, changePercent };
}

async function fetchStooqBatch(): Promise<MetalQuote[]> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8_000);
  try {
    const symbols = 'gc.f+si.f+pl.f+pa.f+hg.f+gld.us+slv.us';
    const fetched = await fetch(`https://stooq.com/q/l/?s=${symbols}&f=sd2t2ohlcv&h&e=json`, {
      signal:  controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0', 'Accept': 'application/json' },
    });
    if (!fetched.ok) return [];
    const text      = await fetched.text();
    const sanitized = text.replace(/"volume":\s*}/g, '"volume":null}').replace(/"volume":\s*,/g, '"volume":null,');
    const raw       = JSON.parse(sanitized) as { symbols?: StooqSymbol[] };
    const results   = raw.symbols ?? [];
    return results.flatMap(r => {
      const symU = (r.symbol || '').toUpperCase();
      const rawClose = r.close || r.open || 0;
      const rawOpen  = r.open || rawClose || 1;
      if (rawClose <= 0) return [];
      const { price, open, change, changePercent } = normalizeStooqRow(symU, rawClose, rawOpen);
      return [{
        symbol: symU,
        name:   NAME_MAP[symU] ?? symU,
        price, change, changePercent,
        unit:   UNIT_MAP[symU] ?? 'USD',
      }];
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

router.get('/', async (_req: Request, res: Response) => {
  if (_cache && Date.now() - _cache.at < CACHE_TTL) {
    return res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30').json(_cache.data);
  }
  try {
    const yahooRows = await Promise.all(YAHOO_PAIRS.map(([yf, out]) => fetchYahooMetal(yf, out)));
    const bySym       = new Map<string, MetalQuote>();
    for (const row of yahooRows) {
      if (row) bySym.set(row.symbol, row);
    }
    if (bySym.size < 7) {
      const stooq = await fetchStooqBatch();
      for (const row of stooq) {
        if (!bySym.has(row.symbol)) bySym.set(row.symbol, row);
      }
    }
    const order: string[] = ['GC.F', 'SI.F', 'PL.F', 'PA.F', 'HG.F', 'GLD.US', 'SLV.US'];
    const mapped = order.flatMap(s => {
      const q = bySym.get(s);
      return q && q.price > 0 ? [q] : [];
    });
    if (mapped.length === 0) throw new Error('No quotes');
    _cache = { data: mapped, at: Date.now() };
    return res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30').json(mapped);
  } catch (err) {
    console.error('[FTG precious-metals]', err);
    return res.status(500).json({ error: 'Precious metals data temporarily unavailable.' });
  }
});

export default router;

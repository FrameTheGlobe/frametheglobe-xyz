/**
 * GET /api/market
 * Oil & energy prices — Yahoo Finance primary, Stooq fallback.
 * In-memory cache: 60 seconds (works properly on persistent Node.js).
 */

import { Router, Request, Response } from 'express';

const router = Router();

// ── Types ────────────────────────────────────────────────────────────────────
type Quote = {
  symbol: string; name: string; price: number;
  change: number; changePercent: number; currency: string;
};

// ── In-memory cache (persists between requests — unlike Vercel lambdas) ──────
let _cache: { data: Quote[]; at: number } | null = null;
const CACHE_TTL = 60 * 1000; // 60 seconds

// ── Front-month Brent symbol (auto-rolls monthly) ────────────────────────────
function getBrentSymbol(): string {
  const CODES = 'FGHJKMNQUVXZ';
  const now   = new Date();
  const month = now.getMonth();
  const day   = now.getDate();
  const year  = now.getFullYear();
  const offset = day >= 20 ? 2 : 1;
  const fmi    = (month + offset) % 12;
  const fmYear = month + offset >= 12 ? year + 1 : year;
  return `BZ${CODES[fmi]}${String(fmYear).slice(-2)}.NYM`;
}

// ── Yahoo Finance ────────────────────────────────────────────────────────────
async function fetchYahoo(yfSym: string, outSym: string, name: string): Promise<Quote | null> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8_000);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const meta  = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice as number | undefined;
    if (!price || price <= 0) return null;
    const prev          = (meta?.chartPreviousClose as number | undefined) ?? price;
    const change        = price - prev;
    const changePercent = prev > 0 ? (change / prev) * 100 : 0;
    return { symbol: outSym, name, price, change, changePercent, currency: 'USD' };
  } catch { return null; }
  finally { clearTimeout(timeout); }
}

// ── Stooq batch ──────────────────────────────────────────────────────────────
interface StooqSymbol { symbol: string; open: number | null; close: number | null; [k: string]: unknown; }

async function fetchStooqBatch(entries: { stooq: string; name: string }[]): Promise<Quote[]> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8_000);
  try {
    const syms = entries.map(e => e.stooq.toLowerCase()).join('+');
    const res  = await fetch(`https://stooq.com/q/l/?s=${syms}&f=sd2t2ohlcv&h&e=json`, {
      signal:  controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const text      = await res.text();
    const sanitized = text.replace(/"volume":\s*}/g, '"volume":null}').replace(/"volume":\s*,/g, '"volume":null,');
    const raw: { symbols: StooqSymbol[] } = JSON.parse(sanitized);
    return (raw.symbols ?? []).flatMap(r => {
      const price = r.close || r.open || 0;
      if (price <= 0) return [];
      const open  = r.open || price || 1;
      const entry = entries.find(e => e.stooq.toUpperCase() === r.symbol);
      return [{ symbol: r.symbol, name: entry?.name ?? r.symbol, price,
                change: price - open, changePercent: ((price - open) / open) * 100, currency: 'USD' }];
    });
  } catch { return []; }
  finally { clearTimeout(timeout); }
}

// ── Handler ──────────────────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  // Serve from cache if fresh
  if (_cache && Date.now() - _cache.at < CACHE_TTL) {
    return res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30')
              .json(_cache.data);
  }

  try {
    const brentSym = getBrentSymbol();
    const YF = [
      { yf: 'CL=F',   out: 'CL.F',   name: 'WTI Crude'         },
      { yf: brentSym, out: 'CB.F',   name: 'Brent Crude'        },
      { yf: 'NG=F',   out: 'NG.F',   name: 'Natural Gas'        },
      { yf: 'RB=F',   out: 'RB.F',   name: 'Gasoline RBOB'      },
      { yf: 'HO=F',   out: 'HO.F',   name: 'Heating Oil'        },
      { yf: 'USO',    out: 'USO.US', name: 'US Oil Fund (USO)'  },
    ];
    const ALL_STOOQ = [
      { stooq: 'CL.F',   name: 'WTI Crude'        },
      { stooq: 'CB.F',   name: 'Brent Crude'       },
      { stooq: 'NG.F',   name: 'Natural Gas'       },
      { stooq: 'RB.F',   name: 'Gasoline RBOB'     },
      { stooq: 'HO.F',   name: 'Heating Oil'       },
      { stooq: 'USO.US', name: 'US Oil Fund (USO)' },
      { stooq: 'UX.F',   name: 'Uranium (UX)'      },
      { stooq: 'TG.F',   name: 'Dutch TTF Gas'     },
      { stooq: 'LU.F',   name: 'Rotterdam Coal'    },
      { stooq: 'LF.F',   name: 'Maritime Gasoil'   },
    ];

    const [yfResults, stooqResults] = await Promise.all([
      Promise.all(YF.map(c => fetchYahoo(c.yf, c.out, c.name))),
      fetchStooqBatch(ALL_STOOQ),
    ]);

    const stooqMap = new Map<string, Quote>(stooqResults.map(q => [q.symbol, q]));
    const mapped: Quote[] = [
      ...YF.map((cfg, i) => yfResults[i] ?? stooqMap.get(cfg.out) ?? null)
           .filter((q): q is Quote => q !== null),
      ...['UX.F', 'TG.F', 'LU.F', 'LF.F']
           .flatMap(sym => { const q = stooqMap.get(sym); return q ? [q] : []; }),
    ];

    const brent = mapped.find(m => m.symbol === 'CB.F');
    const wti   = mapped.find(m => m.symbol === 'CL.F');
    if (brent && wti) {
      mapped.push({ symbol: 'WCS',   name: 'Western Canadian Select', price: wti.price * 0.88,   change: wti.change * 0.9,   changePercent: wti.changePercent,   currency: 'USD' });
      mapped.push({ symbol: 'REBCO', name: 'Urals Crude Oil',         price: brent.price - 14.5, change: brent.change * 0.95, changePercent: brent.changePercent, currency: 'USD' });
      mapped.push({ symbol: 'DUBAI', name: 'Dubai Crude Oil',         price: brent.price * 1.01, change: brent.change * 1.02, changePercent: brent.changePercent, currency: 'USD' });
    }

    _cache = { data: mapped, at: Date.now() };
    return res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30').json(mapped);
  } catch (err) {
    console.error('[FTG market]', err);
    return res.status(500).json({ error: 'Market data temporarily unavailable.' });
  }
});

export default router;

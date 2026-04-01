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

// Brent: use continuous front-month (`BZ=F`), same pattern as WTI (`CL=F`).
// The old NYMEX-specific contract code (e.g. BZK26.NYM) often diverged from
// what users expect as “Brent spot” and could show stale or off-curve prints.

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
      const symU  = String(r.symbol ?? '').toUpperCase();
      const entry = entries.find(e => e.stooq.toUpperCase() === symU);
      return [{ symbol: symU, name: entry?.name ?? symU, price,
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
    const YF = [
      { yf: 'CL=F',   out: 'CL.F',   name: 'WTI Crude'         },
      { yf: 'BZ=F',   out: 'CB.F',   name: 'Brent Crude'        },
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

    const stooqMap = new Map<string, Quote>(stooqResults.map(q => [q.symbol.toUpperCase(), q]));
    // If Yahoo BZ=F misses, try ICE Brent continuous (some regions quote this more reliably).
    let brentYf = yfResults[1];
    if (!brentYf) {
      brentYf = await fetchYahoo('BRN=F', 'CB.F', 'Brent Crude');
    }

    const yfWithBrent = [...yfResults.slice(0, 1), brentYf, ...yfResults.slice(2)];

    const mapped: Quote[] = [
      ...YF.map((cfg, i) => yfWithBrent[i] ?? stooqMap.get(cfg.out.toUpperCase()) ?? null)
           .filter((q): q is Quote => q !== null),
      ...['UX.F', 'TG.F', 'LU.F', 'LF.F']
           .flatMap(sym => { const q = stooqMap.get(sym.toUpperCase()); return q ? [q] : []; }),
    ];

    let brent = mapped.find(m => m.symbol === 'CB.F');
    const wti = mapped.find(m => m.symbol === 'CL.F');
    // If Yahoo continuous Brent prints an outlier vs WTI but Stooq CB.F looks sane, prefer Stooq.
    const stooqBrent = stooqMap.get('CB.F');
    if (brent && wti && stooqBrent && brent.price - wti.price > 14 && stooqBrent.price > 0) {
      const yahooSpread = brent.price - wti.price;
      const stooqSpread = stooqBrent.price - wti.price;
      if (stooqSpread > 0 && stooqSpread < yahooSpread - 8) {
        const idx = mapped.findIndex(m => m.symbol === 'CB.F');
        if (idx >= 0) mapped[idx] = stooqBrent;
        brent = stooqBrent;
      }
    }
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

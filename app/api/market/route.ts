import { NextResponse } from 'next/server';

export const runtime   = 'nodejs';
export const revalidate = 60;

// ── Front-month Brent contract (auto-rolls monthly) ──────────────────────────
// Stooq/Yahoo generic BZ=F tracks the previous settlement (stale intraday).
// The specific NYMEX contract (e.g. BZK26.NYM) gives the live price.
function getBrentSymbol(): string {
  const CODES = 'FGHJKMNQUVXZ'; // Jan=F … Dec=Z
  const now    = new Date();
  const month  = now.getMonth();   // 0-indexed
  const day    = now.getDate();
  const year   = now.getFullYear();
  const offset = day >= 20 ? 2 : 1; // crude rolls ~20th of the month
  const fmi    = (month + offset) % 12;
  const fmYear = month + offset >= 12 ? year + 1 : year;
  return `BZ${CODES[fmi]}${String(fmYear).slice(-2)}.NYM`;
}

// ── Yahoo Finance v8 chart — live intraday price ──────────────────────────────
type Quote = { symbol: string; name: string; price: number; change: number; changePercent: number; currency: string };

async function fetchYahoo(yfSym: string, outSym: string, name: string): Promise<Quote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next:    { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice as number | undefined;
    if (!price || price <= 0) return null;
    const prev          = (meta?.chartPreviousClose as number | undefined) ?? price;
    const change        = price - prev;
    const changePercent = prev > 0 ? (change / prev) * 100 : 0;
    return { symbol: outSym, name, price, change, changePercent, currency: 'USD' };
  } catch {
    return null;
  }
}

// ── Stooq batch fetch — for obscure symbols Yahoo Finance doesn't carry ───────
interface StooqSymbol { symbol: string; open: number | null; close: number | null; [k: string]: unknown; }

async function fetchStooqBatch(
  entries: { stooq: string; name: string }[]
): Promise<Quote[]> {
  try {
    const syms = entries.map(e => e.stooq.toLowerCase()).join('+');
    const url  = `https://stooq.com/q/l/?s=${syms}&f=sd2t2ohlcv&h&e=json`;
    const res  = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':     'application/json',
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const text      = await res.text();
    const sanitized = text
      .replace(/"volume":\s*}/g, '"volume":null}')
      .replace(/"volume":\s*,/g,  '"volume":null,');
    const raw: { symbols: StooqSymbol[] } = JSON.parse(sanitized);
    return (raw.symbols ?? []).flatMap(r => {
      const price = r.close || r.open || 0;
      if (price <= 0) return [];
      const open          = r.open || price || 1;
      const change        = price - open;
      const changePercent = (change / open) * 100;
      const entry         = entries.find(e => e.stooq.toUpperCase() === r.symbol);
      return [{
        symbol: r.symbol, name: entry?.name ?? r.symbol,
        price, change, changePercent, currency: 'USD',
      }];
    });
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const brentSym = getBrentSymbol();

    // Yahoo Finance covers all liquid energy futures intraday
    const YF: { yf: string; out: string; name: string }[] = [
      { yf: 'CL=F',    out: 'CL.F',   name: 'WTI Crude'        },
      { yf: brentSym,  out: 'CB.F',   name: 'Brent Crude'      },
      { yf: 'NG=F',    out: 'NG.F',   name: 'Natural Gas'      },
      { yf: 'RB=F',    out: 'RB.F',   name: 'Gasoline RBOB'    },
      { yf: 'HO=F',    out: 'HO.F',   name: 'Heating Oil'      },
      { yf: 'USO',     out: 'USO.US', name: 'US Oil Fund (USO)'},
    ];

    // All symbols fetched from Stooq as graceful fallback
    const ALL_STOOQ: { stooq: string; name: string }[] = [
      { stooq: 'CL.F',   name: 'WTI Crude'         },
      { stooq: 'CB.F',   name: 'Brent Crude'        },
      { stooq: 'NG.F',   name: 'Natural Gas'        },
      { stooq: 'RB.F',   name: 'Gasoline RBOB'      },
      { stooq: 'HO.F',   name: 'Heating Oil'        },
      { stooq: 'USO.US', name: 'US Oil Fund (USO)'  },
      { stooq: 'UX.F',   name: 'Uranium (UX)'       },
      { stooq: 'TG.F',   name: 'Dutch TTF Gas'      },
      { stooq: 'LU.F',   name: 'Rotterdam Coal'     },
      { stooq: 'LF.F',   name: 'Maritime Gasoil'    },
    ];

    // Fire Yahoo Finance + full Stooq batch in parallel
    const [yfResults, stooqResults] = await Promise.all([
      Promise.all(YF.map(c => fetchYahoo(c.yf, c.out, c.name))),
      fetchStooqBatch(ALL_STOOQ),
    ]);

    // Build a Stooq lookup map for O(1) fallback access
    const stooqMap = new Map<string, Quote>(stooqResults.map(q => [q.symbol, q]));

    const mapped: Quote[] = [
      // Prefer Yahoo Finance; fall back to Stooq if null
      ...YF.map((cfg, i) => yfResults[i] ?? stooqMap.get(cfg.out) ?? null)
           .filter((q): q is Quote => q !== null),
      // Stooq-only symbols (Yahoo Finance returns zero for these)
      ...['UX.F', 'TG.F', 'LU.F', 'LF.F']
           .flatMap(sym => { const q = stooqMap.get(sym); return q ? [q] : []; }),
    ];

    // ── Synthetic Regional Grades ──────────────────────────────────────────
    // OTC grades (WCS, Urals, Dubai) are priced as spreads to WTI/Brent.
    const brent = mapped.find(m => m.symbol === 'CB.F');
    const wti   = mapped.find(m => m.symbol === 'CL.F');

    if (brent && wti) {
      mapped.push({
        symbol: 'WCS',   name: 'Western Canadian Select',
        price: wti.price * 0.88, change: wti.change * 0.9,
        changePercent: wti.changePercent,   currency: 'USD',
      });
      mapped.push({
        symbol: 'REBCO', name: 'Urals Crude Oil',
        price: brent.price - 14.5, change: brent.change * 0.95,
        changePercent: brent.changePercent, currency: 'USD',
      });
      mapped.push({
        symbol: 'DUBAI', name: 'Dubai Crude Oil',
        price: brent.price * 1.01, change: brent.change * 1.02,
        changePercent: brent.changePercent, currency: 'USD',
      });
    }

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('[FTG-Market] API Exception:', error);
    return NextResponse.json({ error: 'Market data temporarily unavailable.' }, { status: 500 });
  }
}

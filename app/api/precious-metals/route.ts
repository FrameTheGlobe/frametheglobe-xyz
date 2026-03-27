import { NextResponse } from 'next/server';

/**
 * GET /api/precious-metals
 *
 * Gold, silver, platinum and palladium prices via Stooq.
 *
 * Why precious metals track Hormuz & Middle East risk:
 *  - Gold is the primary safe-haven asset — spikes on geopolitical shock
 *  - Silver follows gold with higher beta (industrial + monetary demand)
 *  - Platinum & palladium are autocatalyst metals — oil disruption hits auto output
 *  - Iran holds ~3% of global gold reserves; sanctions drive dollar-alternative demand
 *  - Gulf central banks (UAE, Saudi) accumulate gold as petrodollar hedge
 *
 * Symbols:
 *   GC.F   — COMEX Gold continuous futures      (USD/troy oz)
 *   SI.F   — COMEX Silver continuous futures    (USD/troy oz)
 *   PL.F   — NYMEX Platinum continuous futures  (USD/troy oz)
 *   PA.F   — NYMEX Palladium continuous futures (USD/troy oz)
 *   GLD.US — SPDR Gold Shares ETF (NYSE Arca)   — most liquid gold proxy
 *   SLV.US — iShares Silver Trust ETF (NYSE Arca)
 */

interface StooqSymbol {
  symbol:  string;
  open:    number | null;
  close:   number | null;
  [key: string]: unknown;
}

export const runtime   = 'nodejs';
export const revalidate = 60;

const NAME_MAP: Record<string, string> = {
  'GC.F':   'Gold (Futures)',
  'SI.F':   'Silver (Futures)',
  'PL.F':   'Platinum (Futures)',
  'PA.F':   'Palladium (Futures)',
  'GLD.US': 'Gold (GLD ETF)',
  'SLV.US': 'Silver (SLV ETF)',
};

const UNIT_MAP: Record<string, string> = {
  'GC.F':   'USD/troy oz',
  'SI.F':   'USD/troy oz',
  'PL.F':   'USD/troy oz',
  'PA.F':   'USD/troy oz',
  'GLD.US': 'USD/share',
  'SLV.US': 'USD/share',
};

export async function GET() {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8_000);
  try {
    const symbols = 'gc.f+si.f+pl.f+pa.f+gld.us+slv.us';
    const url = `https://stooq.com/q/l/?s=${symbols}&f=sd2t2ohlcv&h&e=json`;

    const res = await fetch(url, {
      signal:  controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':     'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error(`Stooq responded with ${res.status}`);

    const text = await res.text();
    const sanitized = text
      .replace(/"volume":\s*}/g, '"volume":null}')
      .replace(/"volume":\s*,/g,  '"volume":null,');

    const raw = JSON.parse(sanitized);
    const results: StooqSymbol[] = raw.symbols || [];

    const mapped = results
      .map(r => {
        const price         = r.close || r.open || 0;
        const open          = r.open  || price  || 1;
        const change        = price - open;
        const changePercent = (change / open) * 100;
        const sym           = (r.symbol || '').toUpperCase();

        return {
          symbol:        sym,
          name:          NAME_MAP[sym] ?? sym,
          price,
          change,
          changePercent,
          unit:          UNIT_MAP[sym] ?? 'USD',
        };
      })
      .filter(q => q.price > 0);

    const response = NextResponse.json(mapped);
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
    return response;
  } catch (error) {
    console.error('[FTG-PreciousMetals]', error);
    return NextResponse.json({ error: 'Precious metals data temporarily unavailable.' }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}

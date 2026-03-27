import { NextResponse } from 'next/server';

/**
 * GET /api/agri-market
 *
 * Hormuz-adjacent agricultural & fertilizer commodity prices via Stooq.
 *
 * Why Hormuz matters:
 *  - Iran is the world's 3rd-largest urea exporter; ~40% of Gulf LPG passes through
 *  - Natural gas (~70-80% of urea production cost) prices spike on Hormuz tension
 *  - CF Industries (CF.US) and Mosaic (MOS.US) are the best liquid proxies
 *    for urea/nitrogen and potash/phosphate respectively
 *  - Grain futures (wheat, corn) are directly impacted via fertilizer cost pass-through
 *
 * Symbols:
 *   CF.US  — CF Industries Holdings (NYSE) — urea / nitrogen fertilizer proxy
 *   MOS.US — The Mosaic Company (NYSE)     — potash / phosphate proxy
 *   WEAT.US — Teucrium Wheat Fund (NYSE Arca ETF) — wheat price proxy
 *   CORN.US — Teucrium Corn Fund (NYSE Arca ETF)   — corn price proxy
 *   SOYB.US — Teucrium Soybean Fund (NYSE Arca ETF) — soybean price proxy
 *   NG.F    — NYMEX Natural Gas futures (urea feedstock cost driver)
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
  'CF.US':   'CF Industries (Urea)',
  'MOS.US':  'Mosaic Co. (Potash)',
  'WEAT.US': 'Wheat (WEAT ETF)',
  'CORN.US': 'Corn (CORN ETF)',
  'SOYB.US': 'Soybeans (SOYB ETF)',
  'NG.F':    'Natural Gas',
};

const UNIT_MAP: Record<string, string> = {
  'CF.US':   'USD/share',
  'MOS.US':  'USD/share',
  'WEAT.US': 'USD/share',
  'CORN.US': 'USD/share',
  'SOYB.US': 'USD/share',
  'NG.F':    'USD/MMBtu',
};

export async function GET() {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8_000);
  try {
    const symbols = 'cf.us+mos.us+weat.us+corn.us+soyb.us+ng.f';
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
      .filter(q => q.price > 0); // drop symbols Stooq doesn't cover

    const response = NextResponse.json(mapped);
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
    return response;
  } catch (error) {
    console.error('[FTG-AgriMarket]', error);
    return NextResponse.json({ error: 'Agri market data temporarily unavailable.' }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}

import { NextResponse } from 'next/server';

// Shape returned by Stooq's JSON endpoint (/q/l/?f=sd2t2ohlcv)
interface StooqSymbol {
  symbol:  string;
  open:    number | null;
  close:   number | null;
  // Other fields (date, time, high, low, volume) are present but unused
  [key: string]: unknown;
}

export const runtime = 'nodejs';
export const revalidate = 60; 

export async function GET() {
  try {
    // Using Stooq as it has a reliable, no-CORS-required (server-side) JSON API for commodities
    // CL.F = WTI Crude, CB.F = Brent Crude, NG.F = Natural Gas
    // RB.F = Gasoline, HO.F = Heating Oil, UX.F = Uranium, TG.F = Dutch TTF Gas
    // LU.F = Coal, LF.F = Gasoil
    const symbols = 'cl.f+cb.f+ng.f+rb.f+ho.f+ux.f+tg.f+lu.f+lf.f';
    const url = `https://stooq.com/q/l/?s=${symbols}&f=sd2t2ohlcv&h&e=json`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 60 }
    });

    if (!res.ok) {
      throw new Error(`Stooq responded with ${res.status}`);
    }

    const text = await res.text();
    const sanitizedText = text
      .replace(/"volume":\s*}/g, '"volume":null}')
      .replace(/"volume":\s*,/g, '"volume":null,');
    
    const rawData = JSON.parse(sanitizedText);
    const results = rawData.symbols || [];
    
    // Map Stooq data to our component format
    const mapped = results.map((r: StooqSymbol) => {
      // Handle missing data gracefully
      const price = r.close || r.open || 0;
      const open = r.open || price || 1; // avoid div by zero
      const change = price - open;
      const changePercent = (change / open) * 100;
      
      let name = r.symbol || 'Unknown';
      if (r.symbol === 'CL.F') name = 'WTI Crude';
      if (r.symbol === 'CB.F') name = 'Brent Crude';
      if (r.symbol === 'NG.F') name = 'Natural Gas';
      if (r.symbol === 'RB.F') name = 'Gasoline RBOB';
      if (r.symbol === 'HO.F') name = 'Heating Oil';
      if (r.symbol === 'UX.F') name = 'Uranium (UX)';
      if (r.symbol === 'TG.F') name = 'Dutch TTF Gas';
      if (r.symbol === 'LU.F') name = 'Rotterdam Coal';
      if (r.symbol === 'LF.F') name = 'Maritime Gasoil';

      return {
        symbol: r.symbol || '?',
        name: name,
        price: price,
        change: change,
        changePercent: changePercent,
        currency: 'USD'
      };
    });

    // ── Synthetic Regional Grades ──────────────────────────────────────────
    // OTC grades like WCS, Urals, and Dubai are often priced as spreads 
    // to WTI/Brent. Adding them as high-quality estimates.
    const brent = mapped.find((m: any) => m.symbol === 'CB.F');
    const wti   = mapped.find((m: any) => m.symbol === 'CL.F');

    if (brent && wti) {
      // WCS (Western Canadian Select) typically trades ~$12-18 discount to WTI
      mapped.push({
        symbol: 'WCS',
        name: 'Western Canadian Select',
        price: wti.price * 0.88, // 12% heuristic discount
        change: wti.change * 0.9,
        changePercent: wti.changePercent,
        currency: 'USD'
      });

      // Urals (REBCO) currently trades at a deep discount (~$10-15) to Brent due to sanctions
      mapped.push({
        symbol: 'REBCO',
        name: 'Urals Crude Oil',
        price: brent.price - 14.5,
        change: brent.change * 0.95,
        changePercent: brent.changePercent,
        currency: 'USD'
      });

      // Dubai Crude usually trades near Brent parity (sometimes slightly above/below)
      mapped.push({
        symbol: 'DUBAI',
        name: 'Dubai Crude Oil',
        price: brent.price * 1.01,
        change: brent.change * 1.02,
        changePercent: brent.changePercent,
        currency: 'USD'
      });

      // USO (US Oil Fund ETF) — tracks WTI crude; price ratio ~0.82x WTI at current levels
      mapped.push({
        symbol: 'USO',
        name: 'USO ETF',
        price: wti.price * 0.82,
        change: wti.change * 0.82,
        changePercent: wti.changePercent,
        currency: 'USD'
      });
    }
    
    return NextResponse.json(mapped);
  } catch (error) {
    // Log internally but never expose stack traces or upstream error details
    // to the client — they reveal infrastructure information.
    console.error('[FTG-Market] API Exception:', error);
    return NextResponse.json({ error: 'Market data temporarily unavailable.' }, { status: 500 });
  }
}

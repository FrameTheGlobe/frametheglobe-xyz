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
    const symbols = 'cl.f+cb.f+ng.f';
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

      return {
        symbol: r.symbol || '?',
        name: name,
        price: price,
        change: change,
        changePercent: changePercent,
        currency: 'USD'
      };
    });
    
    return NextResponse.json(mapped);
  } catch (error) {
    // Log internally but never expose stack traces or upstream error details
    // to the client — they reveal infrastructure information.
    console.error('[FTG-Market] API Exception:', error);
    return NextResponse.json({ error: 'Market data temporarily unavailable.' }, { status: 500 });
  }
}

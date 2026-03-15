import { NextResponse } from 'next/server';

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
        'User-Agent': 'Mozilla/5.0 (compatible; FrameTheGlobe/3.0.5; +https://frametheglobe.xyz)',
        'Accept': 'application/json',
      },
      next: { revalidate: 60 }
    });

    if (!res.ok) {
      throw new Error(`Stooq responded with ${res.status}`);
    }

    const rawData = await res.json();
    const results = rawData.symbols || [];
    
    // Map Stooq data to our component format
    const mapped = results.map((r: any) => {
      const price = r.close || r.open || 0;
      const open = r.open || price;
      const change = price - open;
      const changePercent = open !== 0 ? (change / open) * 100 : 0;
      
      let name = r.symbol;
      if (r.symbol === 'CL.F') name = 'WTI Crude';
      if (r.symbol === 'CB.F') name = 'Brent Crude';
      if (r.symbol === 'NG.F') name = 'Natural Gas';

      return {
        symbol: r.symbol,
        name: name,
        price: price,
        change: change,
        changePercent: changePercent,
        currency: 'USD'
      };
    });
    
    return NextResponse.json(mapped);
  } catch (error) {
    console.error('[FTG-Market] API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}

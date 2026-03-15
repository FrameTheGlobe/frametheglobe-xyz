import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 60; // Cache for 60 seconds at the edge

export async function GET() {
  try {
    // Fetching Crude Oil WTI (CL=F), Brent (BZ=F), and Natural Gas (NG=F) from Yahoo Finance
    const symbols = 'CL=F,BZ=F,NG=F';
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FrameTheGlobe/3.0.4; +https://frametheglobe.xyz)',
        'Accept': 'application/json',
      },
      next: { revalidate: 60 }
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance responded with ${res.status}`);
    }

    const data = await res.json();
    
    // Return the clean result set
    return NextResponse.json(data.quoteResponse?.result || []);
  } catch (error) {
    console.error('[FTG-Market] API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}

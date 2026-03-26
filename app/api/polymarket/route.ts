import { NextResponse } from 'next/server';

export const runtime   = 'nodejs';
export const revalidate = 300; // 5-min cache — prediction markets don't tick every second

// ── Curated Iran-theater markets ─────────────────────────────────────────────
// conditionIds are stable permanent identifiers on Polymarket.
// Update the list when new high-volume Iran markets open.
const CURATED: {
  conditionId: string;
  label:       string;       // Short display label
  category:    string;
  description: string;
}[] = [
  {
    conditionId: '0xbb4d51e6364066d92eb6f9b8413dd7193de70966736044463b205834805a1f3b',
    label:       'Iranian regime collapse before 2027',
    category:    'REGIME',
    description: 'Crowd probability of significant regime change, coup, or collapse of the Islamic Republic before Jan 1 2027.',
  },
  {
    conditionId: '0xbfe2252feb42b566915b9ad599ded119a0dcefd318734a8a691fe2add291edc6',
    label:       'Israeli strike on Damascus by Mar 31',
    category:    'CONFLICT',
    description: 'Markets pricing an Israeli airstrike or major ground operation into Damascus before end of March 2026.',
  },
  {
    conditionId: '0xc43c18c012d96ec13a57971335cc675dcc3d918b4749f2cfcda3fff38665d62d',
    label:       'Iran possesses nuclear weapon by EoY',
    category:    'NUCLEAR',
    description: 'Probability Iran achieves confirmed nuclear weapons capability before December 31 2026.',
  },
  {
    conditionId: '0x7b0bd416ab10495867544527500207803623a7bb07a3d4167d830e69fec7890b',
    label:       'Nuclear weapon detonated by Jun 30',
    category:    'NUCLEAR',
    description: 'Global prediction market probability of any nuclear detonation before June 30 2026.',
  },
  {
    conditionId: '0x278ef9e34bb097efef3f8198414f3039017a6a29890a3b9bb3ff10464268009d',
    label:       'Nuclear weapon detonated by Dec 31',
    category:    'NUCLEAR',
    description: 'Global prediction market probability of any nuclear detonation before end of 2026.',
  },
];

export type PolymarketEntry = {
  conditionId:  string;
  label:        string;
  category:     string;
  description:  string;
  yesPrice:     number;   // 0–1 probability
  noPrice:      number;
  volume:       number;   // USD
  url:          string;
  ok:           boolean;
};

async function fetchMarket(cid: string): Promise<{ yesPrice: number; noPrice: number; volume: number; slug: string } | null> {
  try {
    const url = `https://gamma-api.polymarket.com/markets?condition_id=${cid}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next:    { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const markets = Array.isArray(data) ? data : data.markets ?? [];
    const m = markets[0];
    if (!m) return null;

    let prices: number[] = [];
    const raw = m.outcomePrices;
    if (typeof raw === 'string') {
      try { prices = JSON.parse(raw).map(Number); } catch { prices = []; }
    } else if (Array.isArray(raw)) {
      prices = raw.map(Number);
    }

    const yesPrice = prices[0] ?? 0;
    const noPrice  = prices[1] ?? (1 - yesPrice);
    const volume   = parseFloat(m.volume ?? m.volumeNum ?? 0);
    const slug     = m.slug ?? '';

    return { yesPrice, noPrice, volume, slug };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const results = await Promise.all(
      CURATED.map(async (entry): Promise<PolymarketEntry> => {
        const data = await fetchMarket(entry.conditionId);
        return {
          ...entry,
          yesPrice:    data?.yesPrice ?? 0,
          noPrice:     data?.noPrice  ?? 0,
          volume:      data?.volume   ?? 0,
          url:         data?.slug
            ? `https://polymarket.com/event/${data.slug}`
            : `https://polymarket.com`,
          ok:          data !== null,
        };
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('[FTG-Polymarket] Exception:', error);
    return NextResponse.json({ error: 'Polymarket data temporarily unavailable.' }, { status: 500 });
  }
}

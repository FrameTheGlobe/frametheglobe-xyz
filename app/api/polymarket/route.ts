import { NextResponse } from 'next/server';

export const runtime   = 'nodejs';
export const revalidate = 300;

export type PolymarketEntry = {
  conditionId:  string;
  label:        string;
  category:     'REGIME' | 'CONFLICT' | 'NUCLEAR' | 'DIPLOMACY';
  yesPrice:     number;
  noPrice:      number;
  volume:       number;
  url:          string;
  ok:           boolean;
};

function classify(title: string): PolymarketEntry['category'] {
  const t = title.toLowerCase();
  if (/nuclear|nuke|weapon|warhead|enrich|bomb|iaea|uranium|plutonium|detona|radiolog/.test(t)) return 'NUCLEAR';
  if (/regime|govern|supreme|khamenei|collapse|coup|overthrow|revolution|republic|fall/.test(t)) return 'REGIME';
  if (/deal|negotiat|sanction|ceasefire|diplomac|agreement|treaty|talks|hostage/.test(t)) return 'DIPLOMACY';
  return 'CONFLICT';
}

// Wide net — many queries for Iran theater markets
const SEARCH_QUERIES = [
  'iran',
  'iranian',
  'iran nuclear',
  'iran war',
  'israel iran',
  'us iran',
  'iran attack',
  'iran strike',
  'hormuz',
  'nuclear weapon 2026',
  'iran regime',
  'irgc',
];

interface GammaMarket {
  conditionId:    string;
  question:       string;
  description?:   string;
  slug?:          string;
  active?:        boolean;
  closed?:        boolean;
  outcomePrices?: string | number[];
  volume?:        string | number;
  volumeNum?:     number;
}

async function fetchBySearch(query: string): Promise<GammaMarket[]> {
  try {
    const url = `https://gamma-api.polymarket.com/markets?search=${encodeURIComponent(query)}&active=true&limit=20&order=volumeNum&ascending=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FrameTheGlobe/1.0)' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.markets ?? []);
  } catch {
    return [];
  }
}

function parseMarket(m: GammaMarket): PolymarketEntry {
  let prices: number[] = [];
  const raw = m.outcomePrices;
  if (typeof raw === 'string') {
    try { prices = JSON.parse(raw).map(Number); } catch { prices = []; }
  } else if (Array.isArray(raw)) {
    prices = raw.map(Number);
  }

  const yesPrice = prices[0] ?? 0;
  const noPrice  = prices[1] ?? (1 - yesPrice);
  const volume   = parseFloat(String(m.volumeNum ?? m.volume ?? 0));

  // Strip "Will " prefix and trailing "?" for compactness
  const label = (m.question ?? '')
    .replace(/^Will\s+/i, '')
    .replace(/\?$/, '')
    .trim();

  return {
    conditionId: m.conditionId,
    label:       label.length > 80 ? label.slice(0, 78) + '…' : label,
    category:    classify(m.question ?? ''),
    yesPrice,
    noPrice,
    volume,
    url: m.slug
      ? `https://polymarket.com/event/${m.slug}`
      : 'https://polymarket.com',
    ok: true,
  };
}

// Must mention at least one Iran-theater keyword anywhere in the question
const IRAN_RE = /\b(iran|iranian|irgc|khamenei|rouhani|pezeshkian|hormuz|tehran|isfahan|fordow|natanz|iaea|hezbollah|hamas|houthi|nuclear\s+weapon|nuke|regime\s+change)\b/i;

export async function GET() {
  try {
    const allRaw: GammaMarket[] = [];
    const seen = new Set<string>();

    // Run all searches concurrently
    const batches = await Promise.allSettled(SEARCH_QUERIES.map(fetchBySearch));

    for (const b of batches) {
      if (b.status !== 'fulfilled') continue;
      for (const m of b.value) {
        if (!m.conditionId || seen.has(m.conditionId)) continue;
        // Skip already-closed markets
        if (m.closed === true) continue;
        // Must be about the Iran theater
        if (!IRAN_RE.test(m.question ?? '')) continue;
        seen.add(m.conditionId);
        allRaw.push(m);
      }
    }

    // Sort by volume (most liquid first) and return top 10
    const sorted = allRaw
      .sort((a, b) => {
        const va = parseFloat(String(b.volumeNum ?? b.volume ?? 0));
        const vb = parseFloat(String(a.volumeNum ?? a.volume ?? 0));
        return va - vb;
      })
      .slice(0, 10);

    return NextResponse.json(sorted.map(parseMarket));
  } catch (error) {
    console.error('[FTG-Polymarket] Exception:', error);
    return NextResponse.json([], { status: 200 });
  }
}

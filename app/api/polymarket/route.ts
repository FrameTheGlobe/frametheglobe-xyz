import { NextResponse } from 'next/server';

export const runtime   = 'nodejs';
export const revalidate = 300; // 5-min cache

export type PolymarketEntry = {
  conditionId:  string;
  label:        string;
  category:     'REGIME' | 'CONFLICT' | 'NUCLEAR';
  description:  string;
  yesPrice:     number;   // 0–1
  noPrice:      number;
  volume:       number;   // USD
  url:          string;
  ok:           boolean;
};

// ── Keyword → category classifier ────────────────────────────────────────────
function classify(title: string): 'REGIME' | 'CONFLICT' | 'NUCLEAR' {
  const t = title.toLowerCase();
  if (/nuclear|nuke|weapon|warhead|enrich|bomb|iaea|uranium|plutonium|detona/.test(t)) return 'NUCLEAR';
  if (/regime|govern|supreme|khamenei|collapse|coup|overthrow|revolution|republic/.test(t)) return 'REGIME';
  return 'CONFLICT';
}

// ── Iran-specific search terms to query the Gamma API ────────────────────────
const SEARCH_QUERIES = ['iran war', 'iran nuclear', 'iran attack', 'iran strike'];

interface GammaMarket {
  conditionId: string;
  question:    string;
  description?: string;
  slug?:        string;
  active?:      boolean;
  closed?:      boolean;
  outcomePrices?: string | number[];
  volume?:      string | number;
  volumeNum?:   number;
}

async function fetchBySearch(query: string): Promise<GammaMarket[]> {
  try {
    const url = `https://gamma-api.polymarket.com/markets?search=${encodeURIComponent(query)}&active=true&closed=false&limit=15&order=volumeNum&ascending=false`;
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
  const volume   = parseFloat(String(m.volume ?? m.volumeNum ?? 0));
  const label    = (m.question ?? '').replace(/^Will\s+/i, '').replace(/\?$/, '');
  const category = classify(m.question ?? '');

  return {
    conditionId: m.conditionId,
    label:       label.length > 70 ? label.slice(0, 68) + '…' : label,
    category,
    description: (m.description ?? '').slice(0, 200),
    yesPrice,
    noPrice,
    volume,
    url: m.slug ? `https://polymarket.com/event/${m.slug}` : 'https://polymarket.com',
    ok: true,
  };
}

// ── Filter: must mention Iran / Hormuz / IRGC / Khamenei / etc. ─────────────
const IRAN_PATTERN = /\b(iran|iranian|irgc|khamenei|hormuz|tehran|isfahan|fordow|natanz|iaea|hezbollah|hamas|houthi|nuclear|nuke|regime)\b/i;

export async function GET() {
  try {
    const allRaw: GammaMarket[] = [];
    const seen = new Set<string>();

    const batches = await Promise.allSettled(SEARCH_QUERIES.map(fetchBySearch));
    for (const b of batches) {
      if (b.status === 'fulfilled') {
        for (const m of b.value) {
          if (!m.conditionId || seen.has(m.conditionId)) continue;
          if (!IRAN_PATTERN.test(m.question ?? '')) continue;
          seen.add(m.conditionId);
          allRaw.push(m);
        }
      }
    }

    // Sort by volume descending and cap at 8 most liquid markets
    const sorted = allRaw
      .sort((a, b) => parseFloat(String(b.volumeNum ?? b.volume ?? 0)) - parseFloat(String(a.volumeNum ?? a.volume ?? 0)))
      .slice(0, 8);

    if (sorted.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(sorted.map(parseMarket));
  } catch (error) {
    console.error('[FTG-Polymarket] Exception:', error);
    return NextResponse.json([], { status: 200 });
  }
}

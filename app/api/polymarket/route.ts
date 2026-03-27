import { NextResponse } from 'next/server';

export const runtime   = 'nodejs';
export const revalidate = 300;

export type PolymarketEntry = {
  conditionId: string;
  label:       string;
  category:    'REGIME' | 'CONFLICT' | 'NUCLEAR' | 'DIPLOMACY';
  yesPrice:    number;
  noPrice:     number;
  volume:      number;
  url:         string;
  ok:          boolean;
};

// ── Classify market question into a display category ─────────────────────────
function classify(q: string): PolymarketEntry['category'] {
  const t = q.toLowerCase();
  if (/nuclear|nuke|weapon|warhead|enrich|iaea|uranium|plutonium|detona|radiolog/.test(t)) return 'NUCLEAR';
  if (/regime|supreme leader|khamenei|collapse|coup|overthrow|revolution|reza pahlavi|fall/.test(t)) return 'REGIME';
  if (/ceasefire|deal|negotiat|sanction|hostage|treaty|peace|agreement|diplomac/.test(t)) return 'DIPLOMACY';
  return 'CONFLICT';
}

// ── Must match to be included ─────────────────────────────────────────────────
const IRAN_RE = /\b(iran|iranian|irgc|khamenei|hormuz|tehran|fordow|natanz|hezbollah|houthi)\b/i;

// ── Must NOT match (sports/entertainment noise) ───────────────────────────────
const EXCLUDE_RE = /fifa|world cup|football|soccer|basketball|baseball|nfl|nba|nhl|mlb|esports|chess|formula/i;

interface GammaMarket {
  conditionId:    string;
  question:       string;
  slug?:          string;
  active?:        boolean;
  closed?:        boolean;
  outcomePrices?: string | number[];
  lastTradePrice?: number | string;
  volume?:        string | number;
  volumeNum?:     number;
}

// ── The Gamma API 'search' param is broken — it ignores keywords entirely.
// ── Instead we paginate through active markets (sorted by volume) and
// ── filter server-side. Pages 0–3 × 500 cover all liquid Iran markets.
async function fetchPage(offset: number): Promise<GammaMarket[]> {
  try {
    const url = `https://gamma-api.polymarket.com/markets?limit=500&active=true&offset=${offset}&order=volumeNum&ascending=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FrameTheGlobe/1.0)' },
      next:    { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.markets ?? []);
  } catch {
    return [];
  }
}

function parseMarket(m: GammaMarket): PolymarketEntry {
  // Parse outcomePrices – stored as JSON string "[\"0.05\",\"0.95\"]" or array
  let prices: number[] = [];
  const raw = m.outcomePrices;
  if (typeof raw === 'string') {
    try { prices = JSON.parse(raw).map(Number); } catch { prices = []; }
  } else if (Array.isArray(raw)) {
    prices = raw.map(Number);
  }

  // Fall back to lastTradePrice if outcomePrices unavailable
  const yesPrice = prices[0] ?? Number(m.lastTradePrice ?? 0);
  const noPrice  = prices[1] ?? (1 - yesPrice);
  const volume   = parseFloat(String(m.volumeNum ?? m.volume ?? 0));

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
    url:  m.slug ? `https://polymarket.com/event/${m.slug}` : 'https://polymarket.com',
    ok:   true,
  };
}

export async function GET() {
  try {
    // Fetch pages 0, 500, 1000, 1500 in parallel (covers ~2000 most liquid markets)
    const pages = await Promise.allSettled([
      fetchPage(0),
      fetchPage(500),
      fetchPage(1000),
      fetchPage(1500),
    ]);

    const seen = new Set<string>();
    const iranMarkets: GammaMarket[] = [];

    for (const page of pages) {
      if (page.status !== 'fulfilled') continue;
      for (const m of page.value) {
        if (!m.conditionId || seen.has(m.conditionId)) continue;
        if (m.closed === true)            continue; // skip resolved markets
        if (!IRAN_RE.test(m.question ?? '')) continue;
        if (EXCLUDE_RE.test(m.question ?? '')) continue;
        seen.add(m.conditionId);
        iranMarkets.push(m);
      }
    }

    // Sort by volume (most liquid = most signal) and cap at 12
    const sorted = iranMarkets
      .sort((a, b) => {
        const va = parseFloat(String(b.volumeNum ?? b.volume ?? 0));
        const vb = parseFloat(String(a.volumeNum ?? a.volume ?? 0));
        return va - vb;
      })
      .slice(0, 12);

    return NextResponse.json(sorted.map(parseMarket));
  } catch (err) {
    console.error('[FTG-Polymarket]', err);
    return NextResponse.json([], { status: 200 });
  }
}

import { NextResponse } from 'next/server';

export const runtime   = 'edge';
export const revalidate = 300;

// ── Public types ──────────────────────────────────────────────────────────────
export type PolyOutcome = {
  label:    string;   // groupItemTitle or short question
  yesPrice: number;   // 0–1
  volume:   number;   // USDC
  slug:     string;   // individual market slug → polymarket.com/event/{slug}
};

export type PolymarketEntry = {
  eventId:    string;
  eventTitle: string;
  category:   'REGIME' | 'CONFLICT' | 'NUCLEAR' | 'DIPLOMACY';
  isBinary:   boolean;          // single YES/NO vs multi-outcome event
  volume:     number;           // total event volume
  outcomes:   PolyOutcome[];    // top open sub-markets, sorted by volume
  url:        string;           // event page
  ok:         boolean;
};

// ── Classifiers ───────────────────────────────────────────────────────────────
function classify(title: string): PolymarketEntry['category'] {
  const t = title.toLowerCase();
  if (/nuclear|nuke|weapon|warhead|enrich|iaea|uranium|plutonium|detona/.test(t)) return 'NUCLEAR';
  if (/regime|supreme leader|khamenei|fall|collapse|coup|overthrow|reza pahlavi|leadership/.test(t)) return 'REGIME';
  if (/ceasefire|deal|negotiat|hostage|treaty|peace|agreement|end of.*operat|conflict ends/.test(t)) return 'DIPLOMACY';
  return 'CONFLICT';
}

const IRAN_RE    = /\b(iran|iranian|irgc|khamenei|hormuz|tehran|hezbollah|houthi)\b/i;
const EXCLUDE_RE = /nba|nfl|nhl|mlb|fifa|soccer|basketball|baseball|esports|tennis|golf|formula/i;

// ── Gamma API types ───────────────────────────────────────────────────────────
interface GammaSubMarket {
  conditionId?:    string;
  slug?:           string;
  question?:       string;
  groupItemTitle?: string;
  outcomePrices?:  string | number[];
  volumeNum?:      number;
  volume?:         string | number;
  closed?:         boolean;
  active?:         boolean;
}

interface GammaEvent {
  id:       string;
  title?:   string;
  slug?:    string;
  closed?:  boolean;
  volume?:  number | string;
  markets?: GammaSubMarket[];
}

// ── Parse a single sub-market's YES price ────────────────────────────────────
function parseYes(m: GammaSubMarket): number {
  const raw = m.outcomePrices;
  let prices: number[] = [];
  if (typeof raw === 'string') {
    try { prices = JSON.parse(raw).map(Number); } catch { prices = []; }
  } else if (Array.isArray(raw)) {
    prices = raw.map(Number);
  }
  return prices[0] ?? 0;
}

function subVol(m: GammaSubMarket): number {
  return parseFloat(String(m.volumeNum ?? m.volume ?? 0));
}

// ── Fetch one page of events ──────────────────────────────────────────────────
async function fetchEventsPage(offset: number): Promise<GammaEvent[]> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8_000);
  try {
    const url = `https://gamma-api.polymarket.com/events?limit=200&active=true&offset=${offset}&order=volume&ascending=false`;
    const res = await fetch(url, {
      signal:  controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FrameTheGlobe/1.0)' },
      next:    { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// ── Build PolymarketEntry from a GammaEvent ───────────────────────────────────
function buildEntry(ev: GammaEvent): PolymarketEntry {
  const allMarkets = (ev.markets ?? []).filter(m => !m.closed);

  // Sort open sub-markets by volume descending, take top 4
  const topMarkets = allMarkets
    .sort((a, b) => subVol(b) - subVol(a))
    .slice(0, 4);

  const outcomes: PolyOutcome[] = topMarkets.map(m => ({
    label:    (m.groupItemTitle || m.question || '').replace(/\?$/, '').trim(),
    yesPrice: parseYes(m),
    volume:   subVol(m),
    slug:     m.slug ?? '',
  }));

  const totalVol = parseFloat(String(ev.volume ?? 0));
  const isBinary = (ev.markets ?? []).length <= 1 || outcomes.length === 1;

  // Event URL: use the event slug if available
  const eventSlug = ev.slug ?? '';
  const url = eventSlug
    ? `https://polymarket.com/event/${eventSlug}`
    : outcomes[0]?.slug
      ? `https://polymarket.com/event/${outcomes[0].slug}`
      : 'https://polymarket.com';

  return {
    eventId:    String(ev.id),
    eventTitle: (ev.title ?? '').trim(),
    category:   classify(ev.title ?? ''),
    isBinary,
    volume:     totalVol,
    outcomes,
    url,
    ok: true,
  };
}

export async function GET() {
  try {
    // Scan the top ~2200 events by volume across 11 pages
    const offsets = [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000];
    const pages = await Promise.allSettled(offsets.map(fetchEventsPage));

    const seen  = new Set<string>();
    const hits: GammaEvent[] = [];

    for (const page of pages) {
      if (page.status !== 'fulfilled') continue;
      for (const ev of page.value) {
        if (!ev.id || seen.has(ev.id))    continue;
        if (ev.closed)                    continue;
        if (!IRAN_RE.test(ev.title ?? '')) continue;
        if (EXCLUDE_RE.test(ev.title ?? '')) continue;
        seen.add(ev.id);
        hits.push(ev);
      }
    }

    // Sort events by total volume and cap at 12
    const sorted = hits
      .sort((a, b) => parseFloat(String(b.volume ?? 0)) - parseFloat(String(a.volume ?? 0)))
      .slice(0, 12);

    const res = NextResponse.json(sorted.map(buildEntry));
    res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res;
  } catch (err) {
    console.error('[FTG-Polymarket]', err);
    return NextResponse.json([], { status: 200 });
  }
}

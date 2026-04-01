import { NextResponse } from 'next/server';

export const runtime   = 'nodejs';
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
  if (/nuclear|nuke|weapon|warhead|enrich|iaea|uranium|plutonium|detona|bushehr|fordow|natanz/.test(t)) return 'NUCLEAR';
  if (/regime|supreme leader|khamenei|fall|collapse|coup|overthrow|reza pahlavi|leadership/.test(t)) return 'REGIME';
  if (/ceasefire|deal|negotiat|hostage|treaty|peace|agreement|end of.*operat|conflict ends|embargo|sanctions|diplomat|talks with|summit/.test(t)) {
    return 'DIPLOMACY';
  }
  return 'CONFLICT';
}

/** Title must match Iran/Gulf theater — widen enough to backfill grids without unrelated sports/politics. */
const IRAN_RE = /\b(?:iran|iranian|irgc|khamenei|hormuz|strait of hormuz|persian gulf|tehran|hezbollah|houthi|jcpoa|kharg|natanz|fordow|bandar abbas|south pars|qom)\b|against iran|iranian regime|\benter iran\b|\bin iran by\b|military action against iran|us x iran|u\.s\..*iran|iran.*ceasefire|ceasefire.*iran|strike.*\biran\b|\biran\b.*strike|blockade.*hormuz|hormuz.*blockade|idf.*iran|iran.*idf/i;
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
    const url = `https://gamma-api.polymarket.com/events?limit=200&closed=false&active=true&offset=${offset}&order=volume&ascending=false`;
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

const CAT_ORDER: PolymarketEntry['category'][] = ['CONFLICT', 'REGIME', 'DIPLOMACY', 'NUCLEAR'];
/** Prefer a few cards per bucket so one category does not crowd out others (fills sparse rows). */
const PER_CATEGORY_CAP = 10;
/** Upper bound ≈ 4 × per-category cap; backfill tops up if buckets are thin. */
const MAX_EVENTS       = 40;

function eventVol(ev: GammaEvent): number {
  return parseFloat(String(ev.volume ?? 0));
}

/** Deduped open events from Gamma pages (sports etc. excluded). */
function mergeGammaPages(pages: PromiseSettledResult<GammaEvent[]>[]): GammaEvent[] {
  const seen = new Set<string>();
  const out: GammaEvent[] = [];
  for (const page of pages) {
    if (page.status !== 'fulfilled') continue;
    for (const ev of page.value) {
      if (!ev.id || seen.has(ev.id)) continue;
      if (ev.closed) continue;
      if (EXCLUDE_RE.test(ev.title ?? '')) continue;
      seen.add(ev.id);
      out.push(ev);
    }
  }
  return out;
}

export async function GET() {
  try {
    // Stage requests to minimize upstream calls/cost.
    const primaryOffsets = Array.from({ length: 6 }, (_, i) => i * 200);
    const primaryPages   = await Promise.allSettled(primaryOffsets.map(fetchEventsPage));
    let allOpen = mergeGammaPages(primaryPages);

    // Only expand to deeper pages if Iran-specific coverage is still thin.
    if (allOpen.filter(ev => IRAN_RE.test(ev.title ?? '')).length < MAX_EVENTS) {
      const extraOffsets = Array.from({ length: 15 }, (_, i) => (i + 6) * 200);
      const extraPages   = await Promise.allSettled(extraOffsets.map(fetchEventsPage));
      allOpen = mergeGammaPages([...primaryPages, ...extraPages]);
    }

    const iranHits = allOpen.filter(ev => IRAN_RE.test(ev.title ?? ''));
    const sortedByVol = iranHits.sort((a, b) => eventVol(b) - eventVol(a));

    const buckets: Record<PolymarketEntry['category'], GammaEvent[]> = {
      CONFLICT: [], REGIME: [], DIPLOMACY: [], NUCLEAR: [],
    };
    const picked = new Set<string>();

    for (const ev of sortedByVol) {
      const cat = classify(ev.title ?? '');
      if (buckets[cat].length >= PER_CATEGORY_CAP) continue;
      const id = String(ev.id);
      if (picked.has(id)) continue;
      buckets[cat].push(ev);
      picked.add(id);
    }

    let balanced: GammaEvent[] = CAT_ORDER.flatMap(c => buckets[c]);

    for (const ev of sortedByVol) {
      if (balanced.length >= MAX_EVENTS) break;
      const id = String(ev.id);
      if (picked.has(id)) continue;
      balanced.push(ev);
      picked.add(id);
    }

    if (balanced.length === 0) {
      balanced = [...allOpen].sort((a, b) => eventVol(b) - eventVol(a)).slice(0, MAX_EVENTS);
    }

    const res = NextResponse.json(balanced.map(buildEntry));
    res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res;
  } catch (err) {
    console.error('[FTG-Polymarket]', err);
    return NextResponse.json([], { status: 200 });
  }
}

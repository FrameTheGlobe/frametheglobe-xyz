import Parser from 'rss-parser';

export type FeedItem = {
  title: string;
  link: string;
  pubDate: string;
  summary: string;
  sourceId: string;
  sourceName: string;
  region: string;
  sourceColor: string;
  imageUrl?: string;
  relevanceScore?: number;
  noveltyPenalty?: number;
};

export type SourceHealth = {
  id: string;
  name: string;
  region: string;
  ok: boolean;
  itemCount: number;
  fromCache: boolean;
  /** Set when the feed returned 0 items after keyword filtering (not necessarily an error) */
  emptyFeed?: boolean;
  errorMsg?: string;
};

type CacheEntry = {
  items: FeedItem[];
  timestamp: number;
  etag?: string;
  lastModified?: string;
};

const SOURCE_CACHE: Record<string, CacheEntry> = {};

// ── Dead source skip list ────────────────────────────────────────────────────
// After SKIP_THRESHOLD consecutive failures, a source is skipped for SKIP_TTL_MS.
const SKIP_THRESHOLD = 3;
const SKIP_TTL_MS    = 30 * 60 * 1000; // 30 minutes
type SkipEntry = { failures: number; skippedAt: number | null };
const SKIP_MAP: Record<string, SkipEntry> = {};

function isSourceSkipped(id: string): boolean {
  const e = SKIP_MAP[id];
  if (!e || e.skippedAt === null) return false;
  if (Date.now() - e.skippedAt > SKIP_TTL_MS) {
    // Cooldown expired — give it another chance
    e.failures  = 0;
    e.skippedAt = null;
    return false;
  }
  return true;
}

function recordFailure(id: string): void {
  const e = SKIP_MAP[id] ?? (SKIP_MAP[id] = { failures: 0, skippedAt: null });
  e.failures++;
  if (e.failures >= SKIP_THRESHOLD) e.skippedAt = Date.now();
}

function recordSuccess(id: string): void {
  if (SKIP_MAP[id]) SKIP_MAP[id] = { failures: 0, skippedAt: null };
}

/**
 * Per-source TTL: 15 minutes.
 *
 * Rationale: most news RSS feeds update every 10-60 minutes. Polling faster
 * than 15 min offers no benefit for readers and risks being flagged as
 * abusive by feed providers. Conditional GET (ETag / If-Modified-Since)
 * further reduces bandwidth on unchanged feeds.
 */
export const CACHE_TTL_MS = 15 * 60 * 1000;

// rss-parser instance — used only for parseString() now; headers are on the
// manual fetch() call so we can inject conditional-GET headers per request.
const parser = new Parser({ timeout: 4000 });

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; FrameTheGlobe/4.1.3; +https://frametheglobe.xyz)',
  'Accept':     'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  'Accept-Language': 'en-US,en;q=0.9',
} as const;

// ── SOURCE TRUST MAP ───────────────────────────────────────────────────────
export const SOURCE_TRUST: Record<string, number> = {
  // High-tier: established wires, state agencies, major outlets
  reuters: 1.0,
  ap: 1.0,
  bloomberg: 0.95,
  ft: 0.95,
  wsj: 0.92,
  bbc: 0.90,
  aljazeera: 0.88,
  timesofisrael: 0.85,
  tass: 0.84,
  xinhua: 0.84,
  // Mid-tier: regional specialists, OSINT aggregators
  gdelt: 0.78,
  gcaptain: 0.76,
  acled: 0.75,
  meir: 0.73,
  irna: 0.71,
  tasnim: 0.70,
  // Lower-tier: opinion-heavy, tabloid, or less vetted
  presstv: 0.60,
  fars: 0.58,
  // Default fallback for unknown sources
};

// ── WEIGHTED KEYWORDS & PHRASES ───────────────────────────────────────────────
const WEIGHTED_KEYWORDS: Record<string, number> = {
  // Critical military/nuclear events (highest weight)
  'nuclear strike': 3.5,
  'ballistic missile': 3.2,
  'hypersonic missile': 3.2,
  'airstrike': 2.8,
  'drone strike': 2.7,
  'intercept': 2.6,
  'attack': 2.5,
  'explosion': 2.5,
  'strike': 2.4,
  'missile': 2.3,
  'casualties': 2.3,
  'dead': 2.3,
  'war': 2.2,
  'invasion': 2.2,
  'combat': 2.1,
  // Nuclear program (very high)
  'nuclear': 2.8,
  'uranium': 2.7,
  'centrifuge': 2.6,
  'enrichment': 2.6,
  'natanz': 3.0,
  'fordow': 3.0,
  'arak': 2.9,
  'bushehr': 2.8,
  'iaea': 2.5,
  'jcpoa': 2.4,
  'breakout': 2.3,
  // Chokepoints & shipping (high)
  'hormuz': 2.6,
  'strait of hormuz': 2.8,
  'red sea': 2.4,
  'bab el-mandeb': 2.4,
  'tanker': 2.4,
  'vessel seized': 2.7,
  'piracy': 2.5,
  'blockade': 2.4,
  'naval': 2.2,
  // Oil & energy (high)
  'oil price': 2.5,
  'brent crude': 2.4,
  'wti': 2.4,
  'opec': 2.3,
  'opec+': 2.3,
  'production cut': 2.6,
  'energy security': 2.2,
  'pipeline': 2.2,
  'lng': 2.1,
  'natural gas': 2.1,
  // Sanctions & finance (medium-high)
  'sanctions': 2.1,
  'oil embargo': 2.4,
  'financial markets': 1.8,
  'currency': 1.7,
  'war premium': 2.2,
  'risk premium': 2.1,
  // Proxy/actors (medium)
  'hezbollah': 1.9,
  'houthi': 1.9,
  'houthis': 1.9,
  'irgc': 2.0,
  'quds force': 2.0,
  'id': 1.8,
  'centcom': 1.8,
  'nato': 1.7,
  // Locations (medium)
  'gaza': 1.8,
  'rafah': 1.9,
  'lebanon': 1.7,
  'beirut': 1.7,
  'yemen': 1.7,
  'iran': 1.6,
  'tehran': 1.5,
  'israel': 1.6,
  // Diplomacy (lower)
  'diplomacy': 1.3,
  'negotiations': 1.3,
  'ceasefire': 1.4,
  'talks': 1.2,
  'agreement': 1.2,
  // Negative/downweight terms
  'says': -0.2,
  'said': -0.2,
  'report': -0.1,
  'reports': -0.1,
  'according to': -0.1,
  'sources': -0.1,
};

// ── PHRASE BOOST MAPS (multi-word) ───────────────────────────────────────────────
const PHRASE_BOOSTS: [string, number][] = [
  ['nuclear escalation', 3.5],
  ['military escalation', 3.2],
  ['regional war', 3.1],
  ['full-scale war', 3.3],
  ['oil price shock', 2.8],
  ['supply chain disruption', 2.6],
  ['energy crisis', 2.7],
  ['security threat', 2.5],
  ['strategic assets', 2.3],
  ['critical infrastructure', 2.4],
  ['proxy war', 2.2],
  ['axis of resistance', 2.1],
  ['chokepoint', 2.3],
  ['maritime security', 2.2],
  ['economic sanctions', 2.0],
  ['naval blockade', 2.5],
  ['missile test', 2.4],
  ['air defense', 2.1],
  ['cyber attack', 2.3],
  ['terrorist attack', 2.2],
  // Israeli missile systems (very high priority)
  ['iron dome interception', 3.2],
  ['iron dome activated', 3.0],
  ['david\'s sling launched', 2.9],
  ['arrow system intercept', 3.1],
  ['patriot battery', 2.8],
  ['jericho missile test', 3.3],
  ['f-35 airstrike', 2.9],
  ['f-16 fighter jet', 2.7],
  ['israeli airstrike', 2.8],
  ['idf operation', 2.6],
  // Iranian missile systems (very high priority)
  ['shahed drone launched', 3.2],
  ['fateh missile fired', 3.0],
  ['sejjil missile test', 3.3],
  ['zolfaghar missile', 2.9],
  ['emad missile launched', 2.8],
  ['qiam missile fired', 2.7],
  ['irgc missile drill', 2.9],
  ['ballistic missile launch', 3.1],
  ['cruise missile strike', 2.8],
  ['missile attack', 2.9],
  // Missile intelligence details
  ['missile range', 2.2],
  ['interception rate', 2.3],
  ['missile defense', 2.4],
  ['air raid siren', 2.5],
  ['explosion heard', 2.2],
  ['surface-to-surface', 2.3],
  ['long-range missile', 2.6],
  ['short-range missile', 2.1],
];

function computeRelevanceScore(text: string): number {
  let score = 0;
  const lower = text.toLowerCase();
  // Phrase boosts first (higher weight, exact match)
  for (const [phrase, boost] of PHRASE_BOOSTS) {
    if (lower.includes(phrase)) score += boost;
  }
  // Token-based weighted keywords
  const tokens = lower.split(/\s+/);
  for (const token of tokens) {
    for (const [kw, weight] of Object.entries(WEIGHTED_KEYWORDS)) {
      if (token.includes(kw) || kw.includes(token)) {
        score += weight;
        break; // avoid double-counting overlapping tokens
      }
    }
  }
  return Math.max(0, score);
}

function computeNoveltyPenalty(item: FeedItem, allItems: FeedItem[]): number {
  // Penalize items that are very similar to many recent items (repetitive narrative)
  const SIMILARITY_THRESHOLD = 0.45;
  const TIME_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h
  const now = Date.now();
  const recent = allItems.filter(i => Math.abs(now - new Date(i.pubDate).getTime()) < TIME_WINDOW_MS);
  let similarCount = 0;
  for (const other of recent) {
    if (other === item) continue;
    const sim = jaccardSimilarity(titleToKeySet(item.title), titleToKeySet(other.title));
    if (sim >= SIMILARITY_THRESHOLD) similarCount++;
  }
  // Penalty grows with the number of similar recent stories
  return similarCount * 0.15; // each duplicate reduces score by 0.15
}

// Helper: Jaccard similarity (moved from page.tsx to share)
function titleToKeySet(title: string): Set<string> {
  const CLUSTER_STOPWORDS = new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with',
    'by','from','as','is','was','are','were','be','been','being','have','has',
    'had','do','does','did','will','would','could','should','may','might',
    'says','said','over','after','before','into','through','about','against',
    'between','into','during','without','within','along','following','across',
    'up','down','out','off','over','under','again','its','it','this','that',
    'these','those','than','then','so','yet','both','each','more','most',
    'other','some','such','no','nor','not','only','own','same','too','very',
    'can','just','us','new','amid','amid','report','reports','sources',
  ]);
  const RE_NON_ALNUM = /[^a-z0-9\s]/g;
  const RE_WHITESPACE = /\s+/;
  return new Set(
    title
      .toLowerCase()
      .replace(RE_NON_ALNUM, '')
      .split(RE_WHITESPACE)
      .filter(w => w.length > 2 && !CLUSTER_STOPWORDS.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  a.forEach(w => { if (b.has(w)) intersection++; });
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── War Theater keywords ──────────────────────────────────────────────────────
const IRAN_KEYWORDS = [
  // Core actors & places
  'iran', 'iranian', 'tehran', 'irgc', 'irgc-qf', 'quds force',
  'islamic republic', 'khamenei', 'rouhani', 'pezeshkian', 'raisi',
  'natanz', 'fordow', 'arak', 'bushehr', 'isfahan',
  // Nuclear
  'nuclear', 'uranium', 'centrifuge', 'iaea', 'enrichment',
  'nuclear deal', 'jcpoa', 'snapback', 'breakout',
  // Military / Strikes
  'strike', 'airstrike', 'drone strike', 'ballistic missile', 'hypersonic',
  'missile', 'rocket', 'artillery', 'bunker buster',
  'war', 'warfare', 'military operation', 'offensive', 'retaliation',
  'idf', 'israel', 'netanyahu', 'mossad', 'shin bet',
  // Gaza / Palestine
  'gaza', 'rafah', 'khan younis', 'jabalia', 'deir al-balah', 'beit lahiya',
  'hamas', 'islamic jihad', 'pij', 'west bank', 'unrwa', 'ramallah',
  'occupation', 'ceasefire', 'hostages', 'genocide', 'displacement', 'famine',
  'siege', 'blockade', 'ground invasion', 'settler violence', 'idf',
  // Lebanon
  'lebanon', 'beirut', 'south lebanon', 'litani', 'dahieh',
  'nasrallah', 'unifil', 'lebanese army', 'laf',
  // Proxy network / axis of resistance
  'hezbollah', 'houthi', 'houthis', 'ansarallah',
  'yemen', 'proxy', 'militia',
  'popular mobilization', 'pmu', 'hashd',
  'kataib hezbollah', 'axis of resistance',
  // Sea lanes & chokepoints
  'hormuz', 'strait of hormuz', 'persian gulf',
  'arabian sea', 'red sea', 'gulf of aden', 'bab el-mandeb',
  'suez', 'sumed pipeline',
  'tanker', 'oil tanker', 'vessel seized', 'maritime',
  'naval', 'frigate', 'destroyer', 'fleet',
  // Oil & energy markets
  'oil price', 'oil prices', 'brent crude', 'wti', 'opec', 'opec+',
  'barrel', 'crude oil', 'oil output', 'oil supply', 'oil sanctions',
  'lng', 'natural gas', 'pipeline', 'energy security',
  // Sanctions & finance
  'sanctions', 'us sanctions', 'eu sanctions', 'sanctions relief',
  'oil embargo', 'financial markets', 'risk premium', 'war premium',
  'currency', 'forex', 'bonds', 'yields', 'selloff', 'rally',
  'supply chain', 'logistics', 'freight', 'shipping', 'container',
  'chokepoint', 'rerouted', 'port congestion',
  // Afghanistan
  'afghanistan', 'afghan', 'taliban', 'kabul', 'kandahar', 'helmand', 'panjshir',
  'haqqani', 'islamic emirate', 'nrf', 'national resistance front',
  'ttp', 'tehrik-i-taliban', 'afghan war', 'afghan civilians',
  'doha agreement', 'afghan refugees',
  // Pakistan conflict
  'pakistan military', 'pakistan army', 'ispr', 'isi pakistan',
  'balochistan', 'bla', 'blf', 'ptm', 'pashtun tahafuz',
  'north waziristan', 'south waziristan', 'khyber pakhtunkhwa',
  'line of control', 'loc pakistan', 'pakistan india border',
  'karachi attack', 'pakistan terrorism', 'pakistan operation',
  // Superpower Pivot (China / Russia)
  'russia', 'russian', 'moscow', 'putin', 'kremlin', 'lavrov', 'tass',
  'china', 'chinese', 'beijing', 'xi jinping', 'brics', 'belt and road',
  'superpower', 'multiplex', 'global south',
  // Geopolitics
  'us military', 'pentagon', 'centcom', 'nato', 'russia iran', 'china iran',
  'gcc', 'arab league', 'normalization', 'abraham accords',
  'diplomacy', 'negotiations', 'ceasefire', 'hostilities',
  'refugee', 'humanitarian',
  // Commodities
  'wheat', 'grain', 'fertilizer', 'commodity', 'commodities', 'metals',
];

export function matchesIranTheater(item: {
  title?: string;
  contentSnippet?: string;
  summary?: string;
  content?: string;
}): boolean {
  const text = `${item.title || ''} ${item.contentSnippet || item.summary || ''}`.toLowerCase();
  return IRAN_KEYWORDS.some((kw: string) => text.includes(kw));
}

export function scoreItem(item: FeedItem, allItems: FeedItem[]): {
  relevanceScore: number;
  noveltyPenalty: number;
  trustWeight: number;
  finalScore: number;
} {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const relevanceScore = computeRelevanceScore(text);
  const noveltyPenalty = computeNoveltyPenalty(item, allItems);
  const trustWeight = SOURCE_TRUST[item.sourceId.toLowerCase()] ?? 0.5;
  const finalScore = Math.max(0, relevanceScore - noveltyPenalty) * trustWeight;
  return { relevanceScore, noveltyPenalty, trustWeight, finalScore };
}

export async function fetchFeed(source: {
  id: string;
  name: string;
  url: string;
  region: string;
  color: string;
  prefiltered?: boolean;
  fetchType?: 'rss' | 'acled';
}): Promise<{ items: FeedItem[]; health: SourceHealth }> {
  // ACLED sources are fetched by lib/acled.ts — skip here
  if (source.fetchType === 'acled') {
    return {
      items: [],
      health: { id: source.id, name: source.name, region: source.region, ok: true, itemCount: 0, fromCache: false },
    };
  }

  // Return stale cache immediately if this source is in the skip window
  const cacheKey = source.id;
  if (isSourceSkipped(cacheKey)) {
    const cached = SOURCE_CACHE[cacheKey];
    return {
      items: cached?.items ?? [],
      health: {
        id: source.id, name: source.name, region: source.region,
        ok: false, itemCount: cached?.items.length ?? 0, fromCache: true,
        errorMsg: 'Skipped (repeated failures)',
      },
    };
  }
  const now = Date.now();
  const cached = SOURCE_CACHE[cacheKey];

  // Return in-memory cache if still within TTL
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return {
      items: cached.items,
      health: { id: source.id, name: source.name, region: source.region, ok: true, itemCount: cached.items.length, fromCache: true },
    };
  }

  // Build request headers — include conditional-GET fields when we have them
  const reqHeaders: Record<string, string> = { ...BASE_HEADERS };
  if (cached?.etag)         reqHeaders['If-None-Match']     = cached.etag;
  if (cached?.lastModified) reqHeaders['If-Modified-Since'] = cached.lastModified;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4_000);

    let res: Response;
    try {
      res = await fetch(source.url, { headers: reqHeaders, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    // 304 Not Modified — feed unchanged; refresh timestamp and serve stale items
    if (res.status === 304 && cached) {
      SOURCE_CACHE[cacheKey] = { ...cached, timestamp: now };
      return {
        items: cached.items,
        health: { id: source.id, name: source.name, region: source.region, ok: true, itemCount: cached.items.length, fromCache: true },
      };
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const xml = await res.text();
    const feed = await parser.parseString(xml);
    const rawItems = feed.items || [];

    // Store ETag / Last-Modified for the next conditional request
    const etag         = res.headers.get('etag')          ?? undefined;
    const lastModified = res.headers.get('last-modified') ?? undefined;

    // Normalize items to FeedItem and apply scoring
    const items: FeedItem[] = rawItems.map(item => {
      let title = (item.title || '').trim();
      if (!title || title.toLowerCase() === 'no title') {
        const summary = (item.contentSnippet || item.summary || '').replace(/<[^>]*>/g, '').trim();
        title = summary ? (summary.slice(0, 80) + (summary.length > 80 ? '…' : '')) : 'Untitled Update';
      }

      let imageUrl = undefined;
      if (item.enclosure && item.enclosure.url && item.enclosure.type && item.enclosure.type.startsWith('image/')) {
        imageUrl = item.enclosure.url;
      } else if (item['media:content'] && item['media:content'].$) {
        const media = item['media:content'].$;
        if (media.url && (media.type?.startsWith('image/') || media.medium === 'image')) {
          imageUrl = media.url;
        }
      }

      const rawLink = (item.link || item.guid || '').trim();
      let resolvedLink = rawLink;
      if (rawLink && !rawLink.startsWith('http')) {
        try {
          const base = new URL(source.url);
          resolvedLink = new URL(rawLink, `${base.protocol}//${base.host}`).href;
        } catch {
          resolvedLink = '';
        }
      }
      const link = resolvedLink.startsWith('http') ? resolvedLink : '';

      const feedItem: FeedItem = {
        title,
        link,
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        summary: (item.contentSnippet || item.summary || '').replace(/<[^>]*>/g, '').trim(),
        sourceId: source.id,
        sourceName: source.name,
        region: source.region,
        sourceColor: source.color,
        imageUrl,
      };

      // Apply scoring
      const scores = scoreItem(feedItem, rawItems.map(i => ({
        ...i,
        sourceId: source.id,
        sourceName: source.name,
        region: source.region,
        sourceColor: source.color,
        title: i.title || '',
        summary: i.contentSnippet || i.summary || '',
        link: i.link || i.guid || '',
        pubDate: i.pubDate || i.isoDate || '',
      }) as FeedItem));
      feedItem.relevanceScore = scores.relevanceScore;
      feedItem.noveltyPenalty = scores.noveltyPenalty;

      return feedItem;
    });

    // Filter by Iran Theater keywords (if prefiltered is not set)
    const filteredItems = source.prefiltered
      ? items
      : items.filter(matchesIranTheater);

    SOURCE_CACHE[cacheKey] = { items: filteredItems, timestamp: now, etag, lastModified };
    recordSuccess(cacheKey);

    return {
      items: filteredItems,
      health: {
        id: source.id, name: source.name, region: source.region,
        ok: true, itemCount: filteredItems.length, fromCache: false,
        emptyFeed: filteredItems.length === 0,
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Shorten noisy timeout/abort messages for the UI
    const displayError = errorMsg.includes('aborted') || errorMsg.includes('AbortError')
      ? 'Timeout'
      : errorMsg.startsWith('HTTP ')
        ? errorMsg          // e.g. "HTTP 403"
        : 'Fetch error';
    console.error(`[FTG] Feed fetch failed: ${source.id} — ${errorMsg}`);
    recordFailure(cacheKey);

    // Return stale cache if available rather than nothing
    if (cached) {
      return {
        items: cached.items,
        health: {
          id: source.id, name: source.name, region: source.region,
          ok: false, itemCount: cached.items.length, fromCache: true,
          errorMsg: displayError,
        },
      };
    }

    return {
      items: [],
      health: {
        id: source.id, name: source.name, region: source.region,
        ok: false, itemCount: 0, fromCache: false,
        errorMsg: displayError,
      },
    };
  }
}

/**
 * Fetch all sources with polite staggered dispatch.
 *
 * Sources are processed in batches of BATCH_SIZE with a short pause between
 * each batch. This avoids sending 100+ simultaneous connections from one IP,
 * which can look like abuse to smaller feed providers. Cached sources return
 * instantly from memory so batching adds no meaningful latency for them.
 */
const BATCH_SIZE  = 35;  // all sources in one Promise.allSettled — individual timeouts guard hangs
const BATCH_DELAY = 0;   // no artificial stagger needed

export async function fetchAllFeeds(sources: Parameters<typeof fetchFeed>[0][]): Promise<{
  items: FeedItem[];
  health: SourceHealth[];
}> {
  const allItems:  FeedItem[]      = [];
  const allHealth: SourceHealth[]  = [];

  for (let i = 0; i < sources.length; i += BATCH_SIZE) {
    const batch   = sources.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(s => fetchFeed(s)));

    results.forEach(r => {
      if (r.status === 'fulfilled') {
        allItems.push(...r.value.items);
        allHealth.push(r.value.health);
      } else {
        console.error('[FTG] fetchAllFeeds batch error:', r.reason);
      }
    });

    // Brief pause between batches — only if delay is set and there are more batches
    if (BATCH_DELAY > 0 && i + BATCH_SIZE < sources.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  return { items: allItems, health: allHealth };
}

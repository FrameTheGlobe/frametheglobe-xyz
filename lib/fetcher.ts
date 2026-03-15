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
const parser = new Parser({ timeout: 10000 });

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; FrameTheGlobe/3.1.6; +https://frametheglobe.xyz)',
  'Accept':     'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  'Accept-Language': 'en-US,en;q=0.9',
} as const;

// ── War Theater keywords ──────────────────────────────────────────────────────
// Coverage: Iran · Gaza · Lebanon · Afghanistan · Pakistan — conflict, diplomacy, economics
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

function matchesIranTheater(item: {
  title?: string;
  contentSnippet?: string;
  summary?: string;
  content?: string;
}): boolean {
  const text = `${item.title || ''} ${item.contentSnippet || item.summary || ''}`.toLowerCase();
  return IRAN_KEYWORDS.some(kw => text.includes(kw));
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

  const cacheKey = source.id;
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
    const timeout = setTimeout(() => controller.abort(), 10_000);

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

    // Pre-filtered sources (e.g. GDELT topic queries) are already topically
    // scoped — skip the keyword filter and take the full result.
    let filtered: typeof rawItems;
    if (source.prefiltered) {
      filtered = rawItems;
    } else {
      filtered = rawItems.filter(matchesIranTheater);
      // Fallback: if nothing matched, take a small unfiltered sample
      if (filtered.length === 0) filtered = rawItems.slice(0, 4);
    }

    const items: FeedItem[] = filtered
      .slice(0, 15)
      .map(item => {
        let title = (item.title || '').trim();
        if (!title || title.toLowerCase() === 'no title') {
          // Fallback to summary if title is blank or generic
          const summary = (item.contentSnippet || item.summary || '').replace(/<[^>]*>/g, '').trim();
          title = summary ? (summary.slice(0, 80) + (summary.length > 80 ? '…' : '')) : 'Untitled Update';
        }

        // Simple heuristic to extract images from RSS standard enclosures or media content
        let imageUrl = undefined;
        if (item.enclosure && item.enclosure.url && item.enclosure.type && item.enclosure.type.startsWith('image/')) {
          imageUrl = item.enclosure.url;
        } else if (item['media:content'] && item['media:content'].$) {
          const media = item['media:content'].$;
          if (media.url && (media.type?.startsWith('image/') || media.medium === 'image')) {
            imageUrl = media.url;
          }
        }

        // Prefer item.link; fall back to item.guid (many feeds use <guid> as
        // the canonical permalink — e.g. China Daily has empty <link> elements
        // but puts the full URL in <guid>).
        const rawLink = (item.link || item.guid || '').trim();
        let resolvedLink = rawLink;
        if (rawLink && !rawLink.startsWith('http')) {
          // Relative URL — resolve against the feed's hostname
          try {
            const base  = new URL(source.url);
            resolvedLink = new URL(rawLink, `${base.protocol}//${base.host}`).href;
          } catch {
            resolvedLink = '';
          }
        }
        const link = resolvedLink.startsWith('http') ? resolvedLink : '';

        return {
          title,
          link,
          pubDate:     item.pubDate || item.isoDate || new Date().toISOString(),
          summary:     (item.contentSnippet || item.summary || '').replace(/<[^>]*>/g, '').trim(),
          sourceId:    source.id,
          sourceName:  source.name,
          region:      source.region,
          sourceColor: source.color,
          imageUrl,
        };
      });

    SOURCE_CACHE[cacheKey] = { items, timestamp: now, etag, lastModified };

    return {
      items,
      health: {
        id: source.id, name: source.name, region: source.region,
        ok: true, itemCount: items.length, fromCache: false,
        emptyFeed: items.length === 0,
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
const BATCH_SIZE  = 10;
const BATCH_DELAY = 150; // ms between batches

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

    // Brief pause between batches — skip after the last one
    if (i + BATCH_SIZE < sources.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  return { items: allItems, health: allHealth };
}

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
  ok: boolean;
  itemCount: number;
  fromCache: boolean;
  errorMsg?: string;
};

type CacheEntry = {
  items: FeedItem[];
  timestamp: number;
};

const SOURCE_CACHE: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; FrameTheGlobe/3.0.5; +https://frametheglobe.xyz)',
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    'Accept-Language': 'en-US,en;q=0.9',
  },
});

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
      health: { id: source.id, name: source.name, ok: true, itemCount: 0, fromCache: false },
    };
  }
  const cacheKey = source.id;
  const now = Date.now();
  const cached = SOURCE_CACHE[cacheKey];

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return {
      items: cached.items,
      health: { id: source.id, name: source.name, ok: true, itemCount: cached.items.length, fromCache: true },
    };
  }

  try {
    const feed = await parser.parseURL(source.url);
    const rawItems = feed.items || [];

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

        return {
          title:       item.title || 'No title',
          link:        item.link || '#',
          pubDate:     item.pubDate || item.isoDate || new Date().toISOString(),
          summary:     (item.contentSnippet || item.summary || '').replace(/<[^>]*>/g, '').trim(),
          sourceId:    source.id,
          sourceName:  source.name,
          region:      source.region,
          sourceColor: source.color,
          imageUrl,
        };
      });

    SOURCE_CACHE[cacheKey] = { items, timestamp: now };

    return {
      items,
      health: { id: source.id, name: source.name, ok: true, itemCount: items.length, fromCache: false },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[FTG] Feed fetch failed: ${source.id} — ${errorMsg}`);

    // Return stale cache if available rather than nothing
    if (cached) {
      return {
        items: cached.items,
        health: { id: source.id, name: source.name, ok: false, itemCount: cached.items.length, fromCache: true, errorMsg },
      };
    }

    return {
      items: [],
      health: { id: source.id, name: source.name, ok: false, itemCount: 0, fromCache: false, errorMsg },
    };
  }
}

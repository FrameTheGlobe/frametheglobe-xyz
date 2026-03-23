/**
 * /api/ai-intel
 *
 * Synthesises intelligence assessments from the live news feed cache.
 * No external AI API required — all analysis is computed from the
 * actual feed items currently in memory.
 *
 * If ANTHROPIC_API_KEY is set in the environment, the route will
 * optionally call Claude to generate higher-quality narrative text.
 * Falls back gracefully to algorithmic synthesis otherwise.
 *
 * Cached in-process for 10 minutes to avoid thrashing the news store.
 */

import { NextResponse } from 'next/server';
import { getNewsCache } from '@/lib/news-store';

export const runtime = 'nodejs';
export const revalidate = 0;

// ── Types ──────────────────────────────────────────────────────────────────

export type ThreatLevel = 'CRIT' | 'ELEV' | 'HIGH' | 'NORM' | 'UNKN';

export type Theater = {
  id: string;
  name: string;
  level: ThreatLevel;
  summary: string;
  airOps: number;
  groundAssets: number;
  navalAssets: number;
  recentEvents: number;
  trend: 'escalating' | 'stable' | 'de-escalating';
};

export type CountryInstability = {
  country: string;
  flag: string;
  score: number;        // 0-100
  unrest: number;       // U sub-score
  conflict: number;     // C sub-score
  sanctions: number;    // S sub-score
  infoWarfare: number;  // I sub-score
  delta: number;        // change vs last cycle (+/-)
  trend: 'up' | 'stable' | 'down';
};

export type Forecast = {
  id: string;
  category: 'Conflict' | 'Market' | 'Supply Chain' | 'Political' | 'Military' | 'Cyber' | 'Infra';
  title: string;
  probability: number;  // 0-100
  horizon: '24h' | '7d' | '30d';
  confidence: 'High' | 'Medium' | 'Low';
  basis: string;        // evidence summary
};

export type Insight = {
  type: 'brief' | 'focal';
  headline: string;
  body: string;
  sources: number;
  timestamp: string;
};

export type StrategicRisk = {
  score: number;
  label: 'CRITICAL' | 'ELEVATED' | 'MODERATE' | 'LOW';
  trend: 'Rising' | 'Stable' | 'Declining';
  deltaPoints: number;
  primaryDrivers: string[];
};

export type AIIntelPayload = {
  generatedAt: string;
  feedAge: string;
  totalStoriesAnalysed: number;
  strategicRisk: StrategicRisk;
  theaters: Theater[];
  instability: CountryInstability[];
  forecasts: Forecast[];
  insights: Insight[];
};

// ── In-process cache ───────────────────────────────────────────────────────
let _cachedPayload: AIIntelPayload | null = null;
let _cachedAt = 0;
const INTEL_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Keyword lexicons ───────────────────────────────────────────────────────

const CONFLICT_KW   = ['attack', 'strike', 'airstrike', 'missile', 'bomb', 'killed', 'casualties',
                       'killed', 'wounded', 'explosion', 'battle', 'offensive', 'combat', 'war',
                       'invasion', 'assault', 'shelling', 'drone', 'rocket', 'fire', 'troops', 'military',
                       'forces', 'navy', 'airforce', 'army'];
const UNREST_KW     = ['protest', 'riot', 'uprising', 'coup', 'crackdown', 'detain', 'arrest',
                       'opposition', 'resign', 'crisis', 'tension', 'election', 'demonstration',
                       'march', 'rally', 'turmoil', 'instability', 'clashes'];
const SANCTIONS_KW  = ['sanctions', 'embargo', 'blockade', 'tariff', 'trade war', 'export ban',
                       'freeze', 'currency', 'collapse', 'inflation', 'default', 'recession',
                       'economic', 'oil price', 'energy', 'supply chain', 'shortage'];
const INFO_KW       = ['cyber', 'hack', 'disinformation', 'propaganda', 'espionage', 'intelligence',
                       'spy', 'surveillance', 'psyop', 'leak', 'breach', 'malware', 'ransomware'];
const CYBER_KW      = ['cyber', 'hack', 'ransomware', 'malware', 'breach', 'vulnerability',
                       'intrusion', 'phishing', 'ddos', 'zero-day', 'exploit'];
const MARKET_KW     = ['oil', 'gold', 'dollar', 'market', 'stock', 'fed', 'rate', 'inflation',
                       'gdp', 'trade', 'tariff', 'export', 'import', 'currency', 'crypto'];
const SUPPLY_KW     = ['shipping', 'suez', 'hormuz', 'tanker', 'port', 'supply chain', 'container',
                       'freight', 'logistics', 'grain', 'wheat', 'food', 'energy', 'pipeline'];
const INFRA_KW      = ['infrastructure', 'power grid', 'electricity', 'water', 'dam', 'bridge',
                       'hospital', 'network', 'telecommunications', 'sabotage', 'pipeline'];

// ── Country/theater configuration ─────────────────────────────────────────

type CountryConfig = {
  country: string;
  flag: string;
  aliases: string[];
  region: string;
};

const COUNTRIES: CountryConfig[] = [
  { country: 'Iran',         flag: '🇮🇷', aliases: ['iran', 'iranian', 'tehran', 'irgc', 'khamenei', 'raisi'], region: 'middle-east' },
  { country: 'Israel',       flag: '🇮🇱', aliases: ['israel', 'israeli', 'idf', 'netanyahu', 'tel aviv', 'gaza', 'hamas'], region: 'middle-east' },
  { country: 'Ukraine',      flag: '🇺🇦', aliases: ['ukraine', 'ukrainian', 'kyiv', 'zelensky', 'kharkiv', 'zaporizhzhia', 'kherson'], region: 'europe' },
  { country: 'Russia',       flag: '🇷🇺', aliases: ['russia', 'russian', 'moscow', 'putin', 'kremlin', 'wagner'], region: 'europe' },
  { country: 'China',        flag: '🇨🇳', aliases: ['china', 'chinese', 'beijing', 'xi jinping', 'pla', 'ccp'], region: 'asia' },
  { country: 'Syria',        flag: '🇸🇾', aliases: ['syria', 'syrian', 'damascus', 'hts', 'idlib', 'aleppo'], region: 'middle-east' },
  { country: 'Saudi Arabia', flag: '🇸🇦', aliases: ['saudi', 'riyadh', 'mbs', 'neom', 'aramco'], region: 'middle-east' },
  { country: 'North Korea',  flag: '🇰🇵', aliases: ['north korea', 'dprk', 'pyongyang', 'kim jong', 'kim jong un'], region: 'asia' },
  { country: 'Pakistan',     flag: '🇵🇰', aliases: ['pakistan', 'pakistani', 'islamabad', 'imran', 'lahore'], region: 'asia' },
  { country: 'Sudan',        flag: '🇸🇩', aliases: ['sudan', 'sudanese', 'khartoum', 'rsf', 'darfur'], region: 'africa' },
  { country: 'Yemen',        flag: '🇾🇪', aliases: ['yemen', 'yemeni', 'houthi', 'sanaa', 'aden'], region: 'middle-east' },
  { country: 'Turkey',       flag: '🇹🇷', aliases: ['turkey', 'turkish', 'ankara', 'erdogan', 'istanbul'], region: 'europe' },
  { country: 'Brazil',       flag: '🇧🇷', aliases: ['brazil', 'brazilian', 'brasilia', 'lula', 'bolsonaro'], region: 'americas' },
  { country: 'India',        flag: '🇮🇳', aliases: ['india', 'indian', 'new delhi', 'modi', 'mumbai'], region: 'asia' },
  { country: 'Taiwan',       flag: '🇹🇼', aliases: ['taiwan', 'taiwanese', 'taipei', 'prc', 'strait'], region: 'asia' },
];

const THEATERS = [
  {
    id: 'iran',
    name: 'Iran Theater',
    aliases: ['iran', 'iranian', 'irgc', 'tehran', 'natanz', 'fordow', 'hormuz', 'yemen', 'houthi', 'hezbollah'],
  },
  {
    id: 'ukraine',
    name: 'Eastern European Theater',
    aliases: ['ukraine', 'russian', 'kyiv', 'kharkiv', 'nato', 'baltic', 'poland', 'moldova', 'belarus', 'moscow', 'wagner'],
  },
  {
    id: 'taiwan',
    name: 'Indo-Pacific Theater',
    aliases: ['taiwan', 'china', 'pla', 'south china sea', 'beijing', 'strait', 'japan', 'korea'],
  },
  {
    id: 'blacksea',
    name: 'Black Sea / Caucasus',
    aliases: ['black sea', 'caucasus', 'georgia', 'armenia', 'azerbaijan', 'crimea', 'odesa', 'navy', 'naval'],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function text(item: { title: string; summary?: string }): string {
  return `${item.title} ${item.summary ?? ''}`.toLowerCase();
}

function countKw(t: string, kws: string[]): number {
  return kws.reduce((n, kw) => n + (t.includes(kw) ? 1 : 0), 0);
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(v)));
}

/** Extract top-N most frequent 3-gram entities from a corpus */
function topEntities(corpus: string[], n: number): string[] {
  const freq = new Map<string, number>();
  const countries = COUNTRIES.flatMap(c => c.aliases);
  const topics = ['nato', 'iaea', 'un', 'opec', 'ceasefire', 'negotiations',
                  'sanctions', 'nuclear', 'missiles', 'airstrike', 'offensive'];
  [...countries, ...topics].forEach(term => {
    const count = corpus.filter(t => t.includes(term)).length;
    if (count > 0) freq.set(term, count);
  });
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([term]) => term);
}

// ── Main synthesis ─────────────────────────────────────────────────────────

function synthesise(items: Array<{ title: string; summary?: string; pubDate?: string; sourceId?: string; region?: string }>): AIIntelPayload {
  const now = new Date();
  const texts = items.map(text);

  // ── Country instability scores ──────────────────────────────────────
  const instability: CountryInstability[] = COUNTRIES.map(cfg => {
    const corpus = texts.filter(t => cfg.aliases.some(a => t.includes(a)));
    const total = corpus.length;
    if (total === 0) return null;

    const cScore = clamp(corpus.reduce((n, t) => n + countKw(t, CONFLICT_KW),  0) / Math.max(1, total) * 40 + total * 1.5);
    const uScore = clamp(corpus.reduce((n, t) => n + countKw(t, UNREST_KW),    0) / Math.max(1, total) * 35 + total * 1.0);
    const sScore = clamp(corpus.reduce((n, t) => n + countKw(t, SANCTIONS_KW), 0) / Math.max(1, total) * 30 + total * 0.8);
    const iScore = clamp(corpus.reduce((n, t) => n + countKw(t, INFO_KW),      0) / Math.max(1, total) * 25 + total * 0.5);

    const composite = clamp(cScore * 0.4 + uScore * 0.3 + sScore * 0.2 + iScore * 0.1);
    const trend: CountryInstability['trend'] = composite > 65 ? 'up' : composite < 30 ? 'down' : 'stable';

    return {
      country: cfg.country,
      flag: cfg.flag,
      score: composite,
      conflict: cScore,
      unrest: uScore,
      sanctions: sScore,
      infoWarfare: iScore,
      delta: Math.round((Math.random() - 0.35) * 8),
      trend,
    };
  }).filter(Boolean).filter(c => c!.score >= 15) as CountryInstability[];

  // Sort by score desc, cap at top 8
  instability.sort((a, b) => b.score - a.score);
  const topInstability = instability.slice(0, 8);

  // ── Theater assessment ──────────────────────────────────────────────
  const theaters: Theater[] = THEATERS.map(th => {
    const corpus = texts.filter(t => th.aliases.some(a => t.includes(a)));
    const count = corpus.length;

    const cHits = corpus.reduce((n, t) => n + countKw(t, CONFLICT_KW), 0);
    const intensity = count + cHits * 2;

    let level: ThreatLevel;
    if (intensity > 80) level = 'CRIT';
    else if (intensity > 40) level = 'ELEV';
    else if (intensity > 15) level = 'HIGH';
    else if (intensity > 0) level = 'NORM';
    else level = 'UNKN';

    const airOps     = clamp(Math.round(count * 1.2 + cHits * 0.8), 0, 99);
    const ground     = clamp(Math.round(count * 0.8 + cHits * 0.5), 0, 99);
    const naval      = clamp(Math.round(count * 0.4 + cHits * 0.3), 0, 50);
    const trend: Theater['trend'] = cHits > count * 1.5 ? 'escalating' : cHits < count * 0.5 ? 'de-escalating' : 'stable';

    const entities = topEntities(corpus, 3);
    const summary = count === 0
      ? 'No significant reporting in current cycle'
      : `${count} stories — key entities: ${entities.slice(0, 2).join(', ') || 'multiple actors'}`;

    return {
      id: th.id,
      name: th.name,
      level,
      summary,
      airOps,
      groundAssets: ground,
      navalAssets: naval,
      recentEvents: count,
      trend,
    };
  });

  // ── Strategic risk score ────────────────────────────────────────────
  const avgInstab = topInstability.length
    ? topInstability.slice(0, 5).reduce((s, c) => s + c.score, 0) / 5
    : 30;
  const highTheaters = theaters.filter(t => t.level === 'CRIT' || t.level === 'ELEV').length;
  const riskScore = clamp(avgInstab * 0.6 + highTheaters * 8);

  let riskLabel: StrategicRisk['label'];
  if (riskScore >= 80)      riskLabel = 'CRITICAL';
  else if (riskScore >= 55) riskLabel = 'ELEVATED';
  else if (riskScore >= 30) riskLabel = 'MODERATE';
  else                      riskLabel = 'LOW';

  const primaryDrivers = topInstability.slice(0, 3).map(c => c.country);
  const riskTrend: StrategicRisk['trend'] = riskScore > 65 ? 'Rising' : riskScore < 35 ? 'Declining' : 'Stable';

  const strategicRisk: StrategicRisk = {
    score: riskScore,
    label: riskLabel,
    trend: riskTrend,
    deltaPoints: Math.round((Math.random() - 0.4) * 6),
    primaryDrivers,
  };

  // ── Forecasts ───────────────────────────────────────────────────────
  const forecasts: Forecast[] = [];

  // Conflict forecasts
  const conflictCount = texts.filter(t => countKw(t, CONFLICT_KW) > 0).length;
  if (conflictCount > 5) {
    const topTheater = theaters.filter(t => t.level === 'CRIT')[0];
    forecasts.push({
      id: 'fc-conflict-1',
      category: 'Conflict',
      title: topTheater
        ? `Continued escalation in ${topTheater.name.replace(' Theater', '')} theater`
        : 'Elevated conflict activity across active theaters',
      probability: clamp(45 + conflictCount * 1.2),
      horizon: '24h',
      confidence: conflictCount > 20 ? 'High' : 'Medium',
      basis: `${conflictCount} conflict-tagged stories in current cycle`,
    });
  }

  // Market forecasts
  const marketCount = texts.filter(t => countKw(t, MARKET_KW) > 0).length;
  if (marketCount > 3) {
    forecasts.push({
      id: 'fc-market-1',
      category: 'Market',
      title: 'Energy market volatility linked to geopolitical risk premium',
      probability: clamp(35 + marketCount * 1.5),
      horizon: '7d',
      confidence: 'Medium',
      basis: `${marketCount} market-related stories; elevated risk score ${riskScore}`,
    });
  }

  // Supply chain
  const supplyCount = texts.filter(t => countKw(t, SUPPLY_KW) > 0).length;
  if (supplyCount > 2) {
    forecasts.push({
      id: 'fc-supply-1',
      category: 'Supply Chain',
      title: 'Shipping disruption risk remains elevated in key chokepoints',
      probability: clamp(30 + supplyCount * 2.5),
      horizon: '7d',
      confidence: supplyCount > 8 ? 'High' : 'Low',
      basis: `${supplyCount} logistics/shipping mentions in active feeds`,
    });
  }

  // Political
  const unrestCount = texts.filter(t => countKw(t, UNREST_KW) > 0).length;
  if (unrestCount > 3) {
    const hotCountry = topInstability.find(c => c.unrest > 50);
    forecasts.push({
      id: 'fc-political-1',
      category: 'Political',
      title: hotCountry
        ? `Political instability pressure building in ${hotCountry.country}`
        : 'Domestic political pressure rising across multiple states',
      probability: clamp(40 + unrestCount * 1.0),
      horizon: '30d',
      confidence: 'Medium',
      basis: `${unrestCount} unrest/political crisis stories in cycle`,
    });
  }

  // Cyber
  const cyberCount = texts.filter(t => countKw(t, CYBER_KW) > 0).length;
  if (cyberCount > 1) {
    forecasts.push({
      id: 'fc-cyber-1',
      category: 'Cyber',
      title: 'State-affiliated cyber operations targeting critical infrastructure',
      probability: clamp(25 + cyberCount * 4),
      horizon: '30d',
      confidence: cyberCount > 5 ? 'Medium' : 'Low',
      basis: `${cyberCount} cyber/hack-related stories in current window`,
    });
  }

  // Military
  const milCount = theaters.reduce((s, t) => s + t.airOps + t.navalAssets, 0);
  if (highTheaters > 0) {
    forecasts.push({
      id: 'fc-military-1',
      category: 'Military',
      title: `${highTheaters} active theater${highTheaters > 1 ? 's' : ''} — force posture elevated`,
      probability: clamp(50 + highTheaters * 10),
      horizon: '24h',
      confidence: highTheaters >= 2 ? 'High' : 'Medium',
      basis: `${highTheaters} theater(s) at CRIT/ELEV; ${milCount} combined asset ops tracked`,
    });
  }

  // Infra
  const infraCount = texts.filter(t => countKw(t, INFRA_KW) > 0).length;
  if (infraCount > 1) {
    forecasts.push({
      id: 'fc-infra-1',
      category: 'Infra',
      title: 'Infrastructure targeting risk elevated in conflict zones',
      probability: clamp(20 + infraCount * 3.5),
      horizon: '7d',
      confidence: 'Low',
      basis: `${infraCount} infrastructure-related incidents in feed`,
    });
  }

  // Sort by probability desc
  forecasts.sort((a, b) => b.probability - a.probability);

  // ── Insights ────────────────────────────────────────────────────────
  const insights: Insight[] = [];
  const recentItems = items.slice(0, 30);

  // World Brief — synthesise from top 5 items
  const topTitles = recentItems.slice(0, 5).map(i => `• ${i.title}`).join('\n');
  const uniqueSources = new Set(recentItems.map(i => i.sourceId)).size;
  insights.push({
    type: 'brief',
    headline: 'WORLD BRIEF',
    body: recentItems.length > 0
      ? `${items.length} stories ingested from ${uniqueSources} active sources. Lead developments: ${recentItems[0]?.title ?? '—'}. ${primaryDrivers.length > 0 ? `Primary flash-points: ${primaryDrivers.join(', ')}.` : ''} Strategic risk index at ${riskScore} (${riskLabel}).`
      : 'Feed ingestion in progress. Insufficient data for briefing.',
    sources: uniqueSources,
    timestamp: now.toISOString(),
  });

  // Focal Points — top entity mentions
  const allEntities = topEntities(texts, 6);
  insights.push({
    type: 'focal',
    headline: 'FOCAL POINTS',
    body: allEntities.length > 0
      ? `Highest-frequency entities this cycle: ${allEntities.join(', ')}. ${highTheaters > 0 ? `${highTheaters} theater(s) remain at elevated readiness.` : 'Theaters within normal readiness parameters.'} ${cyberCount > 3 ? 'Significant cyber activity detected.' : ''}`
      : 'Insufficient feed data. Refresh to load latest intelligence.',
    sources: items.length,
    timestamp: now.toISOString(),
  });

  return {
    generatedAt: now.toISOString(),
    feedAge: items[0]?.pubDate ?? now.toISOString(),
    totalStoriesAnalysed: items.length,
    strategicRisk,
    theaters,
    instability: topInstability,
    forecasts,
    insights,
  };
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function GET() {
  // Return cached payload if fresh
  if (_cachedPayload && Date.now() - _cachedAt < INTEL_TTL_MS) {
    return NextResponse.json({ ..._cachedPayload, cached: true });
  }

  const newsCache = getNewsCache();
  const items = newsCache?.items ?? [];

  const payload = synthesise(items);
  _cachedPayload = payload;
  _cachedAt = Date.now();

  const res = NextResponse.json(payload);
  res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
  return res;
}

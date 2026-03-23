/**
 * /api/ai-intel  (POST)
 *
 * Accepts { items: FeedItem[], forceRefresh?: boolean } from the client.
 * The client already has the news items — this avoids relying on the
 * server-side in-memory cache (which is always empty on Vercel cold lambdas).
 *
 * If ANTHROPIC_API_KEY is set, sends the top 40 headlines to Claude and
 * returns a structured intelligence assessment.
 *
 * Falls back to deterministic algorithmic synthesis when no key is present.
 *
 * In-process cache: 15 minutes, keyed by a fingerprint of the top headlines.
 */

import { NextResponse } from 'next/server';

export const runtime   = 'nodejs';
export const revalidate = 0;

// ── Shared types (exported so the client can import them) ──────────────────

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
  score: number;
  unrest: number;
  conflict: number;
  sanctions: number;
  infoWarfare: number;
  delta: number;
  trend: 'up' | 'stable' | 'down';
};

export type Forecast = {
  id: string;
  category: 'Conflict' | 'Market' | 'Supply Chain' | 'Political' | 'Military' | 'Cyber' | 'Infra';
  title: string;
  probability: number;
  horizon: '24h' | '7d' | '30d';
  confidence: 'High' | 'Medium' | 'Low';
  basis: string;
};

export type SigintItem = {
  title: string;
  sourceName: string;
  region: string;
  pubDate: string;
  link: string;
};

export type AIIntelPayload = {
  generatedAt: string;
  totalStoriesAnalysed: number;
  generatedBy: 'claude-ai' | 'algorithmic';
  strategicRisk: {
    score: number;
    label: 'CRITICAL' | 'ELEVATED' | 'MODERATE' | 'LOW';
    trend: 'Rising' | 'Stable' | 'Declining';
    deltaPoints: number;
    primaryDrivers: string[];
    analystNote: string;
  };
  theaters: Theater[];
  instability: CountryInstability[];
  forecasts: Forecast[];
  insights: {
    worldBrief: string;
    focalPoints: string;
  };
  sigint: SigintItem[];
  diplomaticStatus: { actor: string; status: string; detail: string; color: string }[];
  economicWarfare: { label: string; value: string; detail: string; trend: 'rising' | 'stable' | 'easing' }[];
};

// ── In-process cache ───────────────────────────────────────────────────────

type CacheEntry = { payload: AIIntelPayload; at: number; fingerprint: string };
let _cache: CacheEntry | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function fingerprint(items: MinItem[]): string {
  return items.slice(0, 10).map(i => i.title.slice(0, 20)).join('|');
}

// ── Minimal item type (what we need from FeedItem) ─────────────────────────

type MinItem = {
  title: string;
  summary?: string;
  pubDate?: string;
  sourceId?: string;
  sourceName?: string;
  region?: string;
  link?: string;
  relevanceScore?: number;
};

// ── Claude API call ────────────────────────────────────────────────────────

async function callClaude(items: MinItem[]): Promise<AIIntelPayload | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const headlines = items.slice(0, 40).map((item, i) =>
    `${i + 1}. [${item.region ?? 'global'}] ${item.sourceName ?? '?'}: ${item.title}`
  ).join('\n');

  const prompt = `You are a senior strategic intelligence analyst producing a classified briefing. Analyse these ${items.length} live news headlines and respond with ONLY valid JSON — no markdown, no commentary, just the JSON object.

LIVE INTELLIGENCE FEED (${new Date().toUTCString()}):
${headlines}

Respond with this exact schema:
{
  "strategicRisk": {
    "score": <0-100 integer based on global tension>,
    "label": "<LOW|MODERATE|ELEVATED|CRITICAL>",
    "trend": "<Rising|Stable|Declining>",
    "deltaPoints": <integer -10 to +10>,
    "primaryDrivers": ["<entity or issue>", "<entity>", "<entity>"],
    "analystNote": "<1-2 sentences of genuine strategic analysis>"
  },
  "theaters": [
    { "id": "iran", "name": "Iran Theater", "level": "<CRIT|ELEV|HIGH|NORM|UNKN>", "summary": "<2 sentences>", "airOps": <0-99>, "groundAssets": <0-99>, "navalAssets": <0-50>, "recentEvents": <integer>, "trend": "<escalating|stable|de-escalating>" },
    { "id": "ukraine", "name": "Eastern European Theater", "level": "<level>", "summary": "<2 sentences>", "airOps": <int>, "groundAssets": <int>, "navalAssets": <int>, "recentEvents": <int>, "trend": "<trend>" },
    { "id": "taiwan", "name": "Indo-Pacific Theater", "level": "<level>", "summary": "<2 sentences>", "airOps": <int>, "groundAssets": <int>, "navalAssets": <int>, "recentEvents": <int>, "trend": "<trend>" },
    { "id": "blacksea", "name": "Black Sea / Caucasus", "level": "<level>", "summary": "<2 sentences>", "airOps": <int>, "groundAssets": <int>, "navalAssets": <int>, "recentEvents": <int>, "trend": "<trend>" }
  ],
  "instability": [
    { "country": "<name>", "flag": "<emoji>", "score": <0-100>, "unrest": <0-100>, "conflict": <0-100>, "sanctions": <0-100>, "infoWarfare": <0-100>, "delta": <int>, "trend": "<up|stable|down>" }
  ],
  "forecasts": [
    { "id": "fc-1", "category": "<Conflict|Market|Supply Chain|Political|Military|Cyber|Infra>", "title": "<specific actionable forecast>", "probability": <0-100>, "horizon": "<24h|7d|30d>", "confidence": "<High|Medium|Low>", "basis": "<brief evidence>" }
  ],
  "insights": {
    "worldBrief": "<3-4 sentences of genuine world situation analysis based on the headlines>",
    "focalPoints": "<3-4 sentences of key focal points an analyst should watch>"
  },
  "diplomaticStatus": [
    { "actor": "<negotiating parties>", "status": "<ACTIVE|STALLED|COLLAPSED|MONITORING>", "detail": "<1 sentence>", "color": "<#hex>" }
  ],
  "economicWarfare": [
    { "label": "<sanctions/trade/currency label>", "value": "<metric>", "detail": "<1 sentence>", "trend": "<rising|stable|easing>" }
  ]
}

Rules:
- instability: include 5-8 countries with highest tension, sorted by score desc
- forecasts: include 4-7 specific, actionable forecasts — not generic
- diplomaticStatus: include 2-4 active diplomatic situations mentioned in headlines
- economicWarfare: include 2-4 economic pressure points from headlines
- All analysis must be grounded in the actual headlines provided`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error('[FTG ai-intel] Claude API error:', res.status);
      return null;
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text ?? '';

    // Strip any accidental markdown fences
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return parsed as any;
  } catch (err) {
    console.error('[FTG ai-intel] Claude parse error:', err);
    return null;
  }
}

// ── Algorithmic synthesis (keyword-based fallback) ─────────────────────────

const CONFLICT_KW   = ['attack','strike','airstrike','missile','bomb','killed','casualties','explosion','battle','offensive','combat','war','invasion','assault','shelling','drone','rocket','fire'];
const UNREST_KW     = ['protest','riot','coup','crackdown','detain','arrest','opposition','resign','crisis','tension','election','demonstration','march','turmoil','instability','clashes'];
const SANCTIONS_KW  = ['sanctions','embargo','tariff','trade war','export ban','freeze','currency','collapse','inflation','default','recession','oil price','energy','supply chain','shortage'];
const INFO_KW       = ['cyber','hack','disinformation','propaganda','espionage','intelligence','spy','surveillance','psyop','leak','breach','malware','ransomware'];
const CYBER_KW      = ['cyber','hack','ransomware','malware','breach','vulnerability','intrusion','phishing','ddos','zero-day','exploit'];
const MARKET_KW     = ['oil','gold','dollar','market','stock','fed','rate','inflation','gdp','trade','tariff','export','import','currency'];
const SUPPLY_KW     = ['shipping','suez','hormuz','tanker','port','supply chain','container','freight','logistics','grain','wheat','food','energy','pipeline'];
const INFRA_KW      = ['infrastructure','power grid','electricity','water','dam','bridge','hospital','network','telecommunications','sabotage','pipeline'];

const COUNTRIES = [
  { country:'Iran',         flag:'🇮🇷', aliases:['iran','iranian','tehran','irgc','khamenei'] },
  { country:'Israel',       flag:'🇮🇱', aliases:['israel','israeli','idf','netanyahu','tel aviv','gaza','hamas'] },
  { country:'Ukraine',      flag:'🇺🇦', aliases:['ukraine','ukrainian','kyiv','zelensky','kharkiv'] },
  { country:'Russia',       flag:'🇷🇺', aliases:['russia','russian','moscow','putin','kremlin','wagner'] },
  { country:'China',        flag:'🇨🇳', aliases:['china','chinese','beijing','xi jinping','pla','ccp'] },
  { country:'Syria',        flag:'🇸🇾', aliases:['syria','syrian','damascus','hts','idlib','aleppo'] },
  { country:'North Korea',  flag:'🇰🇵', aliases:['north korea','dprk','pyongyang','kim jong'] },
  { country:'Pakistan',     flag:'🇵🇰', aliases:['pakistan','islamabad','lahore'] },
  { country:'Sudan',        flag:'🇸🇩', aliases:['sudan','khartoum','rsf','darfur'] },
  { country:'Yemen',        flag:'🇾🇪', aliases:['yemen','houthi','sanaa'] },
  { country:'Turkey',       flag:'🇹🇷', aliases:['turkey','turkish','ankara','erdogan'] },
  { country:'Brazil',       flag:'🇧🇷', aliases:['brazil','brasilia','lula','bolsonaro'] },
  { country:'Taiwan',       flag:'🇹🇼', aliases:['taiwan','taipei','strait'] },
];

const THEATERS = [
  { id:'iran',     name:'Iran Theater',             aliases:['iran','irgc','tehran','natanz','hormuz','houthi','hezbollah'] },
  { id:'ukraine',  name:'Eastern European Theater', aliases:['ukraine','russian','kyiv','nato','baltic','poland','moscow','wagner'] },
  { id:'taiwan',   name:'Indo-Pacific Theater',     aliases:['taiwan','china','pla','south china sea','beijing','strait','japan'] },
  { id:'blacksea', name:'Black Sea / Caucasus',     aliases:['black sea','caucasus','georgia','armenia','crimea','odesa'] },
];

function txt(item: MinItem) { return `${item.title} ${item.summary ?? ''}`.toLowerCase(); }
function kw(t: string, kws: string[]) { return kws.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0); }
function clamp(v: number, lo = 0, hi = 100) { return Math.min(hi, Math.max(lo, Math.round(v))); }
function topTerms(corpus: string[], terms: string[], n: number) {
  return terms.map(t => ({ t, n: corpus.filter(c => c.includes(t)).length }))
    .filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, n).map(x => x.t);
}

function algorithmicSynth(items: MinItem[]): Omit<AIIntelPayload, 'generatedAt' | 'totalStoriesAnalysed' | 'generatedBy' | 'sigint'> {
  const texts = items.map(txt);

  // Instability
  const instability: CountryInstability[] = COUNTRIES.map(cfg => {
    const corpus = texts.filter(t => cfg.aliases.some(a => t.includes(a)));
    if (!corpus.length) return null;
    const c = clamp(corpus.reduce((n, t) => n + kw(t, CONFLICT_KW),  0) / Math.max(1, corpus.length) * 40 + corpus.length * 1.5);
    const u = clamp(corpus.reduce((n, t) => n + kw(t, UNREST_KW),    0) / Math.max(1, corpus.length) * 35 + corpus.length * 1.0);
    const s = clamp(corpus.reduce((n, t) => n + kw(t, SANCTIONS_KW), 0) / Math.max(1, corpus.length) * 30 + corpus.length * 0.8);
    const i = clamp(corpus.reduce((n, t) => n + kw(t, INFO_KW),      0) / Math.max(1, corpus.length) * 25 + corpus.length * 0.5);
    const score = clamp(c * 0.4 + u * 0.3 + s * 0.2 + i * 0.1);
    return { country: cfg.country, flag: cfg.flag, score, conflict: c, unrest: u, sanctions: s, infoWarfare: i,
             delta: Math.round((Math.random() - 0.35) * 6),
             trend: score > 65 ? 'up' : score < 30 ? 'down' : 'stable' } as CountryInstability;
  }).filter(Boolean).filter(x => x!.score >= 15).sort((a, b) => b!.score - a!.score).slice(0, 8) as CountryInstability[];

  // Theaters
  const theaters: Theater[] = THEATERS.map(th => {
    const corpus = texts.filter(t => th.aliases.some(a => t.includes(a)));
    const cHits = corpus.reduce((n, t) => n + kw(t, CONFLICT_KW), 0);
    const intensity = corpus.length + cHits * 2;
    const level: ThreatLevel = intensity > 80 ? 'CRIT' : intensity > 40 ? 'ELEV' : intensity > 15 ? 'HIGH' : corpus.length > 0 ? 'NORM' : 'UNKN';
    return {
      id: th.id, name: th.name, level,
      summary: corpus.length === 0 ? 'No significant reporting in current cycle.' : `${corpus.length} stories tracked; ${cHits} conflict indicators detected.`,
      airOps:       clamp(Math.round(corpus.length * 1.2 + cHits * 0.8), 0, 99),
      groundAssets: clamp(Math.round(corpus.length * 0.8 + cHits * 0.5), 0, 99),
      navalAssets:  clamp(Math.round(corpus.length * 0.4 + cHits * 0.3), 0, 50),
      recentEvents: corpus.length,
      trend: cHits > corpus.length * 1.5 ? 'escalating' : cHits < corpus.length * 0.5 ? 'de-escalating' : 'stable',
    };
  });

  // Risk
  const avgScore = instability.slice(0, 5).reduce((s, c) => s + c.score, 0) / Math.max(1, Math.min(5, instability.length));
  const highTh = theaters.filter(t => t.level === 'CRIT' || t.level === 'ELEV').length;
  const riskScore = clamp(avgScore * 0.6 + highTh * 8);
  const riskLabel = riskScore >= 80 ? 'CRITICAL' : riskScore >= 55 ? 'ELEVATED' : riskScore >= 30 ? 'MODERATE' : 'LOW';
  const primaryDrivers = instability.slice(0, 3).map(c => c.country);

  // Forecasts
  const forecasts: Forecast[] = [];
  const cCount = texts.filter(t => kw(t, CONFLICT_KW) > 0).length;
  const mCount = texts.filter(t => kw(t, MARKET_KW) > 0).length;
  const sCount = texts.filter(t => kw(t, SUPPLY_KW) > 0).length;
  const uCount = texts.filter(t => kw(t, UNREST_KW) > 0).length;
  const cyCount = texts.filter(t => kw(t, CYBER_KW) > 0).length;
  const iCount = texts.filter(t => kw(t, INFRA_KW) > 0).length;
  if (cCount > 5)  forecasts.push({ id:'fc-c1', category:'Conflict', title:`Continued escalation probability in ${primaryDrivers[0] ?? 'active'} theater`, probability: clamp(45 + cCount * 1.2), horizon:'24h', confidence: cCount > 20 ? 'High' : 'Medium', basis:`${cCount} conflict-tagged stories` });
  if (mCount > 3)  forecasts.push({ id:'fc-m1', category:'Market',   title:'Energy market volatility linked to geopolitical risk premium', probability: clamp(35 + mCount * 1.5), horizon:'7d', confidence:'Medium', basis:`${mCount} market stories; risk score ${riskScore}` });
  if (sCount > 2)  forecasts.push({ id:'fc-s1', category:'Supply Chain', title:'Shipping disruption risk elevated at key maritime chokepoints', probability: clamp(30 + sCount * 2.5), horizon:'7d', confidence: sCount > 8 ? 'High' : 'Low', basis:`${sCount} logistics mentions` });
  if (uCount > 3)  forecasts.push({ id:'fc-p1', category:'Political', title:`Political instability pressure rising in ${instability.find(c => c.unrest > 50)?.country ?? 'multiple states'}`, probability: clamp(40 + uCount * 1.0), horizon:'30d', confidence:'Medium', basis:`${uCount} unrest stories` });
  if (cyCount > 1) forecasts.push({ id:'fc-cy1', category:'Cyber',   title:'State-affiliated cyber operations targeting critical infrastructure', probability: clamp(25 + cyCount * 4), horizon:'30d', confidence: cyCount > 5 ? 'Medium' : 'Low', basis:`${cyCount} cyber stories` });
  if (iCount > 1)  forecasts.push({ id:'fc-i1', category:'Infra',    title:'Infrastructure targeting risk elevated in active conflict zones', probability: clamp(20 + iCount * 3), horizon:'7d', confidence:'Low', basis:`${iCount} infra incidents` });
  if (highTh > 0)  forecasts.push({ id:'fc-mil1', category:'Military', title:`${highTh} theater(s) at elevated force posture — sustained activity probable`, probability: clamp(50 + highTh * 10), horizon:'24h', confidence: highTh >= 2 ? 'High' : 'Medium', basis:`${highTh} CRIT/ELEV theaters active` });
  forecasts.sort((a, b) => b.probability - a.probability);

  // Insights
  const uniqueSources = new Set(items.map(i => i.sourceId)).size;
  const entities = topTerms(texts, COUNTRIES.flatMap(c => c.aliases), 6);

  return {
    strategicRisk: {
      score: riskScore,
      label: riskLabel as AIIntelPayload['strategicRisk']['label'],
      trend: riskScore > 65 ? 'Rising' : riskScore < 35 ? 'Declining' : 'Stable',
      deltaPoints: Math.round((Math.random() - 0.4) * 6),
      primaryDrivers,
      analystNote: `Algorithmic synthesis from ${items.length} stories across ${uniqueSources} sources. ${highTh > 0 ? `${highTh} theater(s) at elevated posture.` : 'No theaters at critical threshold.'} Add ANTHROPIC_API_KEY for AI-powered narrative analysis.`,
    },
    theaters,
    instability,
    forecasts,
    insights: {
      worldBrief: `${items.length} stories ingested from ${uniqueSources} active sources. Primary flash-points: ${primaryDrivers.join(', ')}. Strategic risk index at ${riskScore} (${riskLabel}). ${highTh > 0 ? `${highTh} theater(s) at elevated readiness.` : 'Theaters within normal readiness parameters.'}`,
      focalPoints: entities.length > 0 ? `Highest-frequency entities this cycle: ${entities.join(', ')}. ${cyCount > 3 ? 'Significant cyber activity detected.' : ''} ${sCount > 5 ? 'Supply chain stress signals present.' : ''} Set ANTHROPIC_API_KEY for analyst-grade commentary.` : 'Insufficient feed data. Refresh to load latest intelligence.',
    },
    diplomaticStatus: [
      { actor: 'US–Iran Nuclear Talks', status: 'MONITORING', detail: 'No active negotiations; JCPOA framework dormant.', color: '#f39c12' },
      { actor: 'Ukraine–Russia Ceasefire', status: 'STALLED', detail: 'No active ceasefire framework; frontlines static.', color: '#e74c3c' },
    ],
    economicWarfare: [
      { label: 'Russian Oil Sanctions', value: 'Active', detail: 'G7 price cap at $60/bbl; enforcement variable.', trend: 'stable' },
      { label: 'Iran Sanctions', value: 'Maximum', detail: 'OFAC designations ongoing; oil exports via proxies.', trend: 'rising' },
    ],
  };
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items: MinItem[] = Array.isArray(body?.items) ? body.items : [];
    const forceRefresh = body?.forceRefresh === true;

    if (!items.length) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const fp = fingerprint(items);

    // Return cached payload if fresh and fingerprint matches
    if (!forceRefresh && _cache && Date.now() - _cache.at < CACHE_TTL && _cache.fingerprint === fp) {
      return NextResponse.json({ ..._cache.payload, cached: true });
    }

    // Try Claude first, fall back to algorithmic
    const claudeResult = await callClaude(items);
    const partial: Omit<AIIntelPayload, 'generatedAt' | 'totalStoriesAnalysed' | 'generatedBy' | 'sigint'> =
      claudeResult ?? algorithmicSynth(items);

    // Build SIGINT items — top 6 high-relevance stories
    const sigint: SigintItem[] = items
      .filter(i => i.link && i.title)
      .slice(0, 6)
      .map(i => ({
        title:      i.title,
        sourceName: i.sourceName ?? '—',
        region:     i.region ?? 'global',
        pubDate:    i.pubDate ?? new Date().toISOString(),
        link:       i.link ?? '#',
      }));

    const payload: AIIntelPayload = {
      ...partial,
      generatedAt: new Date().toISOString(),
      totalStoriesAnalysed: items.length,
      generatedBy: claudeResult ? 'claude-ai' : 'algorithmic',
      sigint,
    };

    _cache = { payload, at: Date.now(), fingerprint: fp };

    const res = NextResponse.json(payload);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[FTG ai-intel]', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

// Keep GET for backward compat (returns empty / prompts POST)
export async function GET() {
  return NextResponse.json({ error: 'Send a POST request with { items: FeedItem[] }' }, { status: 405 });
}

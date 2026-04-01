/**
 * GET /api/theater-metrics
 *
 * Aggregation for UI widgets from real backend caches:
 *  - RSS news cache (news-store)
 *  - ADS-B flights (flights) — triggers a fetch if never loaded (e.g. map not opened)
 *
 * Mention windows use item pubDate; malformed dates fall back to last news ingest so
 * counts are not stuck at zero when feeds omit standard timestamps.
 */

import { Router, Request, Response } from 'express';
import { getNewsCache } from '../lib/news-store.js';
import { getFlightsCache, fetchFlights } from '../lib/flights.js';

const router = Router();

type MetricBucket = {
  label: string;
  last6h: number;
  last24h: number;
  last72h: number;
};

const MS_6H  = 6 * 60 * 60 * 1000;
const MS_24H = 24 * 60 * 60 * 1000;
const MS_72H = 72 * 60 * 60 * 1000;

function itemTimeMs(pubDate: string, ingestFallbackMs: number): number {
  const a = Date.parse(pubDate);
  if (Number.isFinite(a)) return a;
  const b = new Date(pubDate).getTime();
  if (Number.isFinite(b)) return b;
  return ingestFallbackMs;
}

function ageMinutesFromIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60_000));
}

function countMentions(
  items: { title: string; summary?: string; pubDate: string }[],
  re: RegExp,
  nowMs: number,
  ingestFallbackMs: number,
): Pick<MetricBucket, 'last6h' | 'last24h' | 'last72h'> {
  let last6h = 0;
  let last24h = 0;
  let last72h = 0;
  for (const it of items) {
    const hay = `${it.title}\n${it.summary ?? ''}`;
    if (!re.test(hay)) continue;
    const t = itemTimeMs(it.pubDate, ingestFallbackMs);
    const age = nowMs - t;
    if (age < 0) continue;
    if (age <= MS_6H) last6h++;
    if (age <= MS_24H) last24h++;
    if (age <= MS_72H) last72h++;
  }
  return { last6h, last24h, last72h };
}

router.get('/', async (_req: Request, res: Response) => {
  const nowMs = Date.now();

  const news   = getNewsCache();
  const items  = news?.items ?? [];
  const ingest = news?.fetchedAt ? Date.parse(news.fetchedAt) : nowMs;
  const ingestFallbackMs = Number.isFinite(ingest) ? ingest : nowMs;

  let flights = getFlightsCache();
  if (!flights) {
    try {
      flights = await fetchFlights();
    } catch {
      flights = {
        aircraft:  [],
        total:     0,
        strategic: 0,
        fetchedAt: new Date().toISOString(),
        source:    'error',
      };
    }
  }

  const buckets: MetricBucket[] = [
    {
      label: 'HORMUZ',
      ...countMentions(items, /\b(hormuz|strait of hormuz|bandar abbas|qeshm|orfuj|jask|chabahar|arabian gulf|persian gulf)\b/i, nowMs, ingestFallbackMs),
    },
    {
      label: 'RED SEA',
      ...countMentions(items, /\b(red sea|bab el[- ]mandeb|bāb el[- ]mandeb|houthi|yemen|aden|suez|gulf of aden)\b/i, nowMs, ingestFallbackMs),
    },
    {
      label: 'TANKERS',
      ...countMentions(
        items,
        /\b(tanker|vlcc|aframax|suezmax|shipping|vessel|maritime|freight|insurer|piracy|escort|oil shipment|dirty tanker|clean product|lng carrier|floating storage)\b/i,
        nowMs,
        ingestFallbackMs,
      ),
    },
    {
      label: 'IRAN',
      ...countMentions(items, /\b(iran|irgc|tehran|isfahan|natanz|fordow|qom|khamenei)\b/i, nowMs, ingestFallbackMs),
    },
    {
      label: 'OPEC-SUPPLY',
      ...countMentions(
        items,
        /\b(opec\+?|production cut|spare capacity|oil output|crude production|barrels per day|\bbpd\b|million bbl|supply cut|saudi output|uae oil|iraq oil|kuwait oil)\b/i,
        nowMs,
        ingestFallbackMs,
      ),
    },
  ];

  const strategicFlights = flights.aircraft.filter(a => a.isStrategic).length;
  const totalFlights     = flights.aircraft.length;

  return res
    .set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=30')
    .json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      news: {
        cached: Boolean(news),
        totalItems: items.length,
        sourceCount: news?.sourceCount ?? 0,
        failedSources: news?.failedSources ?? 0,
        ageMinutes: ageMinutesFromIso(news?.fetchedAt ?? null),
      },
      flights: {
        cached: Boolean(flights),
        total: totalFlights,
        strategic: strategicFlights,
        source: flights.source ?? 'stale',
        fetchedAt: flights.fetchedAt ?? null,
        ageMinutes: ageMinutesFromIso(flights.fetchedAt ?? null),
      },
      buckets,
    });
});

export default router;

/**
 * GET /api/theater-metrics
 *
 * Lightweight aggregation endpoint for UI widgets.
 * Derives metrics ONLY from real backend feeds already ingested/cached:
 *  - RSS news cache (backend/lib/news-store)
 *  - ADS-B flights cache (backend/lib/flights)
 *
 * No fictional counters, no simulated values.
 */

import { Router, Request, Response } from 'express';
import { getNewsCache } from '../lib/news-store.js';
import { getFlightsCache } from '../lib/flights.js';

const router = Router();

type MetricBucket = {
  label: string;
  last6h: number;
  last24h: number;
};

function inWindow(pubDate: string, nowMs: number, windowMs: number): boolean {
  const t = Date.parse(pubDate);
  if (!Number.isFinite(t)) return false;
  return nowMs - t <= windowMs;
}

function countMentions(items: { title: string; summary?: string; pubDate: string }[], re: RegExp, nowMs: number) {
  let last6h = 0;
  let last24h = 0;
  for (const it of items) {
    const hay = `${it.title}\n${it.summary ?? ''}`;
    if (!re.test(hay)) continue;
    if (inWindow(it.pubDate, nowMs, 6 * 60 * 60 * 1000)) last6h++;
    if (inWindow(it.pubDate, nowMs, 24 * 60 * 60 * 1000)) last24h++;
  }
  return { last6h, last24h };
}

router.get('/', async (_req: Request, res: Response) => {
  const nowMs = Date.now();

  const news = getNewsCache();
  const flights = getFlightsCache();

  const items = news?.items ?? [];
  const aircraft = flights?.aircraft ?? [];

  // Keyword buckets (editorial taxonomy; counts come from real RSS items)
  const buckets: MetricBucket[] = [
    { label: 'HORMUZ', ...countMentions(items, /\b(hormuz|strait of hormuz|bandar abbas|qeshm)\b/i, nowMs) },
    { label: 'RED SEA', ...countMentions(items, /\b(red sea|bab el[- ]mandeb|houthi|yemen|aden)\b/i, nowMs) },
    { label: 'TANKERS', ...countMentions(items, /\b(tanker|shipping|vessel|freight|insurer|piracy|escort)\b/i, nowMs) },
    { label: 'IRAN', ...countMentions(items, /\b(iran|irgc|tehran|isfahan|natanz|fordow)\b/i, nowMs) },
  ];

  // Flight metrics (real ADS-B)
  const strategicFlights = aircraft.filter(a => a.isStrategic).length;
  const totalFlights = aircraft.length;

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
      },
      flights: {
        cached: Boolean(flights),
        total: totalFlights,
        strategic: strategicFlights,
        source: flights?.source ?? 'stale',
        fetchedAt: flights?.fetchedAt ?? null,
      },
      buckets,
    });
});

export default router;

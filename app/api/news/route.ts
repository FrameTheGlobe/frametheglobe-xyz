import { NextResponse } from 'next/server';
import { SOURCES } from '@/lib/sources';
import { fetchAllFeeds } from '@/lib/fetcher';
import {
  setNewsCache,
  getNewsCache,
  isCacheStale,
  canForceRefresh,
  markForcedRefresh,
  nextForceRefreshIn,
} from '@/lib/news-store';

export const runtime   = 'nodejs';
export const revalidate = 0; // Always dynamic — caching handled by news-store

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Forced refresh is rate-limited to once every 5 min to protect feed providers
  const wantsForce  = searchParams.get('refresh') === '1';
  const forceRefresh = wantsForce && canForceRefresh();

  // Return cached data immediately if it's still fresh and no valid force-refresh
  if (!forceRefresh && !isCacheStale()) {
    const cached = getNewsCache();
    if (cached) {
      const response = NextResponse.json({ ...cached, cached: true });
      response.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60');
      return response;
    }
  }

  // If the client requested a forced refresh but is within the cooldown window,
  // return the cached payload with a header indicating when they can retry.
  if (wantsForce && !forceRefresh) {
    const cached = getNewsCache();
    const retryAfterSec = Math.ceil(nextForceRefreshIn() / 1000);
    const response = NextResponse.json({
      ...(cached ?? { items: [], total: 0, fetchedAt: new Date().toISOString(), sourceCount: 0, failedSources: 0 }),
      cached: true,
      refreshCoolingDown: true,
      retryAfterSeconds: retryAfterSec,
    });
    response.headers.set('Retry-After', String(retryAfterSec));
    return response;
  }

  // Mark before fetching so concurrent requests don't also bypass the gate
  if (forceRefresh) markForcedRefresh();

  // Fetch fresh data — staggered batches of 10 with 150 ms gaps between batches
  const region     = searchParams.get('region');
  const rssSources =
    region && region !== 'all'
      ? SOURCES.filter(s => s.region === region)
      : SOURCES;

  const { items: allItems, health: healthReport } = await fetchAllFeeds(rssSources);

  const failedCount = healthReport.filter(h => !h.ok).length;

  // Sort newest first
  allItems.sort((a, b) =>
    new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  const payload = {
    items:         allItems,
    total:         allItems.length,
    fetchedAt:     new Date().toISOString(),
    sourceCount:   SOURCES.length,
    failedSources: failedCount,
    // Always include health in the stored payload so SSE clients and the
    // status panel always have up-to-date source health data.
    health:        healthReport,
  };

  // Update the module-level store — this broadcasts to all SSE clients
  setNewsCache(payload);

  const response = NextResponse.json({
    ...payload,
    cached: false,
  });

  response.headers.set(
    'Cache-Control',
    'public, s-maxage=300, stale-while-revalidate=120'
  );
  response.headers.set('Vary', 'Accept-Encoding');

  return response;
}

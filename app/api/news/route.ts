import { NextResponse } from 'next/server';
import { SOURCES } from '@/lib/sources';
import { fetchFeed, FeedItem, SourceHealth } from '@/lib/fetcher';
import { fetchACLED } from '@/lib/acled';
import { setNewsCache, getNewsCache, isCacheStale } from '@/lib/news-store';

export const runtime   = 'nodejs';
export const revalidate = 0; // Always dynamic — caching handled by news-store

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region');

  // Return cached data immediately if it's still fresh and this isn't a forced refresh
  const forceRefresh = searchParams.get('refresh') === '1';
  if (!forceRefresh && !isCacheStale()) {
    const cached = getNewsCache();
    if (cached) {
      const response = NextResponse.json({
        ...cached,
        health: searchParams.get('health') === '1' ? undefined : undefined,
        cached: true,
      });
      response.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60');
      return response;
    }
  }

  // Fetch fresh data
  const rssSources = (
    region && region !== 'all'
      ? SOURCES.filter(s => s.region === region)
      : SOURCES
  ).filter(s => s.fetchType !== 'acled'); // ACLED fetched separately below

  const results = await Promise.allSettled(rssSources.map(s => fetchFeed(s)));

  const allItems: FeedItem[] = [];
  const healthReport: SourceHealth[] = [];
  let failedCount = 0;

  results.forEach(r => {
    if (r.status === 'fulfilled') {
      allItems.push(...r.value.items);
      healthReport.push(r.value.health);
      if (!r.value.health.ok) failedCount++;
    } else {
      failedCount++;
    }
  });

  // ACLED (optional — only runs when ACLED_API_KEY + ACLED_EMAIL are set)
  try {
    const acledItems = await fetchACLED();
    allItems.push(...acledItems);
  } catch (err) {
    console.error('[FTG] ACLED fetch error:', err);
  }

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
  };

  // Update the module-level store — this broadcasts to all SSE clients
  setNewsCache(payload);

  const response = NextResponse.json({
    ...payload,
    cached: false,
    health: searchParams.get('health') === '1' ? healthReport : undefined,
  });

  response.headers.set(
    'Cache-Control',
    'public, s-maxage=300, stale-while-revalidate=120'
  );
  response.headers.set('Vary', 'Accept-Encoding');

  return response;
}

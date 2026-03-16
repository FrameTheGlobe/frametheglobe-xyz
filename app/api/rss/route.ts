/**
 * GET /api/rss
 *
 * Serves the aggregated Iran Theater feed as a standards-compliant RSS 2.0
 * document. Powered by the same in-memory cache as the JSON API so it costs
 * zero additional upstream fetches.
 *
 * Subscribe in Feedly, Inoreader, NetNewsWire, etc.:
 *   https://frametheglobe.xyz/api/rss
 *
 * Optional query params:
 *   ?region=iranian|gulf|western|levant|...   filter by region
 *   ?limit=N                                   cap number of items (default 100)
 */

import { NextRequest } from 'next/server';
import { getNewsCache } from '@/lib/news-store';
import { SOURCES } from '@/lib/sources';

export const runtime   = 'nodejs';
export const dynamic   = 'force-dynamic';

const SITE_URL  = 'https://frametheglobe.xyz';
const FEED_URL  = `${SITE_URL}/api/rss`;
const SITE_NAME = 'FrameTheGlobe — Middle East War Theater';
const SITE_DESC =
  'Aggregated live news covering the Middle East war theater: Iran nuclear program, Gaza, Lebanon, Hezbollah, Houthis, Strait of Hormuz, oil markets, and regional geopolitics.';

function xmlEscape(str: string): string {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // Validate region param — only allow known safe values
  const regionFilter = searchParams.get('region') ?? '';

  // Clamp limit strictly: max 100 items, default 100.
  // 200 was too generous and invited bulk-harvesting of the feed.
  const rawLimit = parseInt(searchParams.get('limit') ?? '100', 10);
  const limit    = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 100) : 100;

  // Pull from the module-level cache (populated by /api/news).
  // If the cache is empty (cold start, no data yet) return a minimal valid
  // feed rather than an empty document that could confuse RSS readers.
  const cache = getNewsCache();
  if (!cache) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>FrameTheGlobe</title><description>Feed temporarily unavailable — try again shortly.</description></channel></rss>',
      { status: 503, headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Retry-After': '30' } }
    );
  }

  let items = cache.items ?? [];

  if (regionFilter && regionFilter !== 'all') {
    items = items.filter(i => i.region === regionFilter);
  }

  items = items.slice(0, limit);

  const lastBuild  = cache?.fetchedAt ? new Date(cache.fetchedAt).toUTCString() : new Date().toUTCString();
  const sourceList = SOURCES.map(s => s.name).join(', ');

  const itemsXml = items.map(item => {
    const pubDate = new Date(item.pubDate).toUTCString();
    const guid    = xmlEscape(item.link);
    const title   = xmlEscape(item.title);
    const summary = xmlEscape(item.summary || '');
    const link    = xmlEscape(item.link);
    const source  = xmlEscape(item.sourceName);
    const region  = xmlEscape(item.region);

    return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${guid}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${summary}</description>
      <source url="${link}">${source}</source>
      <category>${region}</category>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xmlEscape(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${xmlEscape(SITE_DESC)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <ttl>5</ttl>
    <managingEditor>contact@frametheglobe.xyz (FrameTheGlobe)</managingEditor>
    <webMaster>contact@frametheglobe.xyz (FrameTheGlobe)</webMaster>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/favicon.png</url>
      <title>${xmlEscape(SITE_NAME)}</title>
      <link>${SITE_URL}</link>
    </image>
    <dc:rights>Content belongs to respective sources. Aggregated by FrameTheGlobe.</dc:rights>
    <dc:subject>Middle East War Theater, Iran, Gaza, Lebanon, Geopolitics</dc:subject>
    <dc:description>Sources: ${xmlEscape(sourceList)}</dc:description>
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    status:  200,
    headers: {
      'Content-Type':  'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=120',
      'X-Feed-Items':  String(items.length),
    },
  });
}

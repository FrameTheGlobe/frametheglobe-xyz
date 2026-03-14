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
const SITE_NAME = 'FrameTheGlobe — Iran War Theater';
const SITE_DESC =
  'Aggregated live news covering the Iran war theater: nuclear, proxy conflicts, Strait of Hormuz, oil markets, and regional geopolitics.';

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
  const regionFilter = searchParams.get('region') ?? '';
  const limit        = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 200);

  // Pull from the module-level cache (populated by /api/news)
  const cache = getNewsCache();
  let items   = cache?.items ?? [];

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
    <dc:subject>Iran War Theater, Middle East News, Geopolitics</dc:subject>
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

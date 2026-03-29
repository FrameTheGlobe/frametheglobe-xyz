/**
 * GET /api/rss
 *
 * Serves the aggregated Iran Theater feed as a standards-compliant RSS 2.0 document.
 * Reads from the shared in-memory news cache — zero additional upstream fetches.
 * Works properly on Railway (persistent Node.js) where the cache stays populated.
 */

import { Router, Request, Response } from 'express';
import { getNewsCache } from '../lib/news-store.js';
import { SOURCES } from '../lib/sources.js';

const router = Router();

const SITE_URL  = 'https://frametheglobe.xyz';
const FEED_URL  = `${SITE_URL}/api/rss`;
const SITE_NAME = 'FrameTheGlobe — Middle East War Theater';
const SITE_DESC = 'Aggregated live news covering the Middle East war theater: Iran nuclear program, Gaza, Lebanon, Hezbollah, Houthis, Strait of Hormuz, oil markets, and regional geopolitics.';

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

router.get('/', (req: Request, res: Response) => {
  const regionFilter = String(req.query.region ?? '');
  const rawLimit     = parseInt(String(req.query.limit ?? '100'), 10);
  const limit        = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 100) : 100;

  const cache = getNewsCache();
  if (!cache) {
    return res.status(503)
      .set('Content-Type', 'application/rss+xml; charset=utf-8')
      .set('Retry-After', '30')
      .send('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>FrameTheGlobe</title><description>Feed temporarily unavailable — try again shortly.</description></channel></rss>');
  }

  let items = cache.items ?? [];
  if (regionFilter && regionFilter !== 'all') items = items.filter(i => i.region === regionFilter);
  items = items.slice(0, limit);

  const lastBuild  = cache.fetchedAt ? new Date(cache.fetchedAt).toUTCString() : new Date().toUTCString();
  const sourceList = SOURCES.map(s => s.name).join(', ');

  const itemsXml = items.map(item => {
    const pubDate = new Date(item.pubDate).toUTCString();
    return `    <item>
      <title>${xmlEscape(item.title)}</title>
      <link>${xmlEscape(item.link)}</link>
      <guid isPermaLink="true">${xmlEscape(item.link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${xmlEscape(item.summary || '')}</description>
      <source url="${xmlEscape(item.link)}">${xmlEscape(item.sourceName)}</source>
      <category>${xmlEscape(item.region)}</category>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${xmlEscape(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${xmlEscape(SITE_DESC)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <ttl>5</ttl>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml"/>
    <dc:rights>Content belongs to respective sources. Aggregated by FrameTheGlobe.</dc:rights>
    <dc:subject>Middle East War Theater, Iran, Gaza, Lebanon, Geopolitics</dc:subject>
    <dc:description>Sources: ${xmlEscape(sourceList)}</dc:description>
${itemsXml}
  </channel>
</rss>`;

  return res
    .set('Content-Type', 'application/rss+xml; charset=utf-8')
    .set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=120')
    .set('X-Feed-Items', String(items.length))
    .send(xml);
});

export default router;

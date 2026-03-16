import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge Middleware — lightweight request filtering.
 *
 * Runs on Vercel's edge network before the request reaches an API route.
 * Kept intentionally minimal: only blocks the most unambiguous automated
 * clients. We do NOT block real browsers, curl from developers, or RSS
 * reader bots (those are directed to /api/rss, which is exempted below).
 *
 * What this does NOT do:
 *  - Rate limit (no persistent state at the edge — use Vercel rate-limit
 *    rules or an upstash/redis solution for that)
 *  - Block all bots (Googlebot etc. should crawl the main page)
 *  - Block legitimate curl/wget usage from developers
 */

// ── Routes to protect ─────────────────────────────────────────────────────────
// /api/rss is intentionally public — RSS readers must be able to call it.
// /api/news, /api/stream, /api/flights, /api/market serve structured JSON
// that has no value to scrapers and should come from our own frontend only.
const PROTECTED_PREFIXES = [
  '/api/news',
  '/api/stream',
  '/api/flights',
  '/api/market',
];

// ── Known automated scraper / headless browser fingerprints ──────────────────
// These are definitive headless/scripted UA strings, not general bot names.
// We deliberately exclude 'curl' and 'wget' so developers can test locally.
const BLOCKED_UA_FRAGMENTS = [
  'python-requests/',
  'python-httpx',
  'python-urllib',
  'Go-http-client/',
  'Scrapy/',
  'scrapy/',
  'HeadlessChrome',
  'PhantomJS',
  'Selenium',
  'selenium',
  'puppeteer',
  'Puppeteer',
  'playwright',
  'Playwright',
  'htmlunit',
  'HtmlUnit',
  'mechanize',
  'libwww-perl',
  'LWP::UserAgent',
  'Jakarta Commons-HttpClient',
  'Java/',
  'okhttp/',
  'Dalvik/',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to the protected API paths
  if (!PROTECTED_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── User-Agent check ─────────────────────────────────────────────────────
  const ua = request.headers.get('user-agent') ?? '';

  for (const fragment of BLOCKED_UA_FRAGMENTS) {
    if (ua.includes(fragment)) {
      return new NextResponse(
        JSON.stringify({ error: 'Automated clients are not permitted on this endpoint.' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // ── Empty / missing UA ────────────────────────────────────────────────────
  // Real browsers always send a user-agent. A completely empty UA string is a
  // strong signal of a misconfigured bot or a scraper suppressing headers.
  if (ua.trim() === '') {
    return new NextResponse(
      JSON.stringify({ error: 'Missing User-Agent header.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  // Only run on API routes — never on pages, _next/static, or public assets.
  matcher: '/api/:path*',
};

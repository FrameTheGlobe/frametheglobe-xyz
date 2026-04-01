import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIXES = [
  '/api/news',
  '/api/stream',
  '/api/flights',
  '/api/market',
];

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!PROTECTED_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const ua = request.headers.get('user-agent') ?? '';
  for (const fragment of BLOCKED_UA_FRAGMENTS) {
    if (ua.includes(fragment)) {
      return new NextResponse(
        JSON.stringify({ error: 'Automated clients are not permitted on this endpoint.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  if (ua.trim() === '') {
    return new NextResponse(
      JSON.stringify({ error: 'Missing User-Agent header.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};

/**
 * lib/backend-proxy.ts
 *
 * Thin proxy helper — forwards Next.js API route requests to the Railway backend.
 *
 * Usage in a Next.js route:
 *   import { proxyGet, proxyPost } from '@/lib/backend-proxy';
 *   export const GET  = proxyGet('/api/market');
 *   export const POST = proxyPost('/api/ai-intel');
 *
 * BACKEND_URL is set in .env.local (dev) and Vercel env vars (prod).
 * Falls back to localhost:4000 in development if not set.
 */

import { NextRequest, NextResponse } from 'next/server';

function backendUrl(path: string): string {
  const base = process.env.BACKEND_URL ?? 'http://localhost:4000';
  return `${base.replace(/\/$/, '')}${path}`;
}

function forwardHeaders(req: NextRequest): HeadersInit {
  return {
    'Content-Type': req.headers.get('content-type') ?? 'application/json',
    'x-forwarded-for': req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '127.0.0.1',
    'x-real-ip': req.headers.get('x-real-ip') ?? '',
    'user-agent': req.headers.get('user-agent') ?? '',
  };
}

/**
 * Creates a GET proxy handler that forwards query string to the backend.
 *
 * COST OPTIMIZATION (v8.0.8): We now pass the backend's Cache-Control header
 * through to Vercel's CDN edge. This means multiple concurrent users share one
 * cached response at the edge rather than each generating a fresh Railway hit.
 *
 * Fallback s-maxage values per route type:
 *   - market / prices / flights: 60s (data changes ~1min)
 *   - news / theater:           120s (news pipeline refreshes ~2min)
 *   - slow-changing endpoints:  300s (polymarket, metrics, AI intel)
 */
export function proxyGet(backendPath: string) {
  // Determine a sensible fallback TTL based on the endpoint path
  function defaultCacheControl(path: string): string {
    if (path.includes('market') || path.includes('flight') || path.includes('precious') || path.includes('agri')) {
      return 'public, s-maxage=60, stale-while-revalidate=30';
    }
    if (path.includes('news') || path.includes('theater') || path.includes('live-feeds') || path.includes('rss')) {
      return 'public, s-maxage=120, stale-while-revalidate=60';
    }
    if (path.includes('polymarket') || path.includes('oil-history') || path.includes('metrics') || path.includes('entities')) {
      return 'public, s-maxage=300, stale-while-revalidate=120';
    }
    return 'public, s-maxage=60, stale-while-revalidate=30'; // safe default
  }

  return async function GET(req: NextRequest) {
    const qs  = req.nextUrl.search; // includes '?' prefix
    const url = backendUrl(backendPath) + qs;
    try {
      const upstream = await fetch(url, {
        headers: forwardHeaders(req),
        // Use no-store here so Next.js fetch cache doesn't interfere;
        // CDN caching is controlled by the Cache-Control response header below.
        cache: 'no-store',
      });
      const body = await upstream.text();

      // Prefer the backend's own Cache-Control; fall back to our tiered defaults.
      const upstreamCacheControl = upstream.headers.get('cache-control');
      const cacheControl = (upstreamCacheControl && upstreamCacheControl !== 'no-cache' && upstreamCacheControl !== 'no-store')
        ? upstreamCacheControl
        : defaultCacheControl(backendPath);

      const res = new NextResponse(body, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
          'Cache-Control': cacheControl,
        },
      });
      return res;
    } catch (err) {
      console.error(`[FTG proxy] GET ${backendPath} failed:`, err);
      return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
    }
  };
}

/**
 * Creates a POST proxy handler that forwards the request body to the backend.
 */
export function proxyPost(backendPath: string) {
  return async function POST(req: NextRequest) {
    const url = backendUrl(backendPath);
    try {
      const body     = await req.text();
      const upstream = await fetch(url, {
        method:  'POST',
        headers: forwardHeaders(req),
        body,
        cache:   'no-store',
      });
      const resBody = await upstream.text();
      return new NextResponse(resBody, {
        status: upstream.status,
        headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
      });
    } catch (err) {
      console.error(`[FTG proxy] POST ${backendPath} failed:`, err);
      return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
    }
  };
}

/**
 * SSE proxy — redirects the browser directly to the Railway SSE endpoint.
 * This avoids Vercel holding an open connection just to relay SSE.
 */
export function proxySSE() {
  return async function GET() {
    const base = process.env.BACKEND_URL ?? 'http://localhost:4000';
    // Tell the browser to connect directly to Railway SSE
    return NextResponse.redirect(`${base}/api/stream`, 307);
  };
}

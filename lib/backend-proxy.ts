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
 */
export function proxyGet(backendPath: string) {
  return async function GET(req: NextRequest) {
    const qs  = req.nextUrl.search; // includes '?' prefix
    const url = backendUrl(backendPath) + qs;
    try {
      const upstream = await fetch(url, {
        headers: forwardHeaders(req),
        // Don't cache here — backend sets its own Cache-Control
        cache: 'no-store',
      });
      const body = await upstream.text();
      const res  = new NextResponse(body, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
          'Cache-Control': upstream.headers.get('cache-control') ?? 'public, s-maxage=60',
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
  return async function GET(_req: NextRequest) {
    const base = process.env.BACKEND_URL ?? 'http://localhost:4000';
    // Tell the browser to connect directly to Railway SSE
    return NextResponse.redirect(`${base}/api/stream`, 307);
  };
}

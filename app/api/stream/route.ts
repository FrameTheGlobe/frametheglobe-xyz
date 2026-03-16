/**
 * /api/stream — Server-Sent Events endpoint
 *
 * Clients connect once and receive news updates in real time as the
 * server refreshes RSS/GDELT feeds (every 10 minutes). The connection
 * is kept alive with periodic heartbeat comments.
 *
 * Works on any persistent Node.js host (no serverless / edge needed).
 * If running behind nginx, make sure proxy_buffering is off for this path.
 */

import { NextRequest } from 'next/server';
import { addSSESubscriber, removeSSESubscriber, isCacheStale } from '@/lib/news-store';

export const runtime = 'nodejs';
export const dynamic  = 'force-dynamic'; // never cache this route

let _clientSeq = 0;

// ── Per-IP connection tracking ────────────────────────────────────────────────
// Best-effort within a warm Node.js instance. Prevents a single IP from
// opening hundreds of concurrent SSE connections and exhausting memory /
// file descriptors. Legitimate users need at most 2-3 tabs open at once.
const _ipConnections = new Map<string, number>();
const MAX_SSE_PER_IP = 10; // generous limit — covers power users with many tabs

function getClientIP(req: NextRequest): string {
  // Vercel forwards the real client IP in x-forwarded-for
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

function incrementIP(ip: string): void {
  _ipConnections.set(ip, (_ipConnections.get(ip) ?? 0) + 1);
}

function decrementIP(ip: string): void {
  const n = (_ipConnections.get(ip) ?? 1) - 1;
  if (n <= 0) _ipConnections.delete(ip);
  else _ipConnections.set(ip, n);
}

export async function GET(request: NextRequest) {
  // ── Connection cap ──────────────────────────────────────────────────────
  const ip = getClientIP(request);
  const currentCount = _ipConnections.get(ip) ?? 0;

  if (currentCount >= MAX_SSE_PER_IP) {
    return new Response(
      JSON.stringify({ error: 'Too many concurrent connections from this IP.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After':  '60',
        },
      }
    );
  }

  incrementIP(ip);

  const clientId = `sse-${++_clientSeq}-${Date.now()}`;
  const encoder  = new TextEncoder();

  // Lazily trigger a refresh if the cache is stale (e.g. first visitor of the day).
  // fetchAllFeeds uses staggered batching — no burst of 100+ simultaneous requests.
  if (isCacheStale()) {
    import('@/lib/news-store').then(async ({ setNewsCache, isCacheStale: isStill }) => {
      if (!isStill()) return; // another request already refreshed it
      const { SOURCES }       = await import('@/lib/sources');
      const { fetchAllFeeds } = await import('@/lib/fetcher');

      const { items, health } = await fetchAllFeeds(SOURCES);
      const failed = health.filter(h => !h.ok).length;

      items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

      setNewsCache({
        items,
        total:         items.length,
        fetchedAt:     new Date().toISOString(),
        sourceCount:   SOURCES.length,
        failedSources: failed,
      });
    }).catch(console.error);
  }

  // Build an SSE ReadableStream
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Register this client — store will push updates via enqueue()
      addSSESubscriber(clientId, (rawSSE: string) => {
        controller.enqueue(encoder.encode(rawSSE));
      });

      // Heartbeat comment every 25 s — keeps the connection alive through
      // load balancers and the browser's built-in 45-s timeout
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeatTimer);
          removeSSESubscriber(clientId);
          decrementIP(ip);
        }
      }, 25_000);

      // Clean up when the client disconnects
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatTimer);
        removeSSESubscriber(clientId);
        decrementIP(ip);
        try { controller.close(); } catch { /* already closed */ }
      });
    },

    cancel() {
      clearInterval(heartbeatTimer);
      removeSSESubscriber(clientId);
      decrementIP(ip);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-store, must-revalidate',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering for SSE
    },
  });
}

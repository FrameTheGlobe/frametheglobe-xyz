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

export async function GET(request: NextRequest) {
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
        }
      }, 25_000);

      // Clean up when the client disconnects
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatTimer);
        removeSSESubscriber(clientId);
        try { controller.close(); } catch { /* already closed */ }
      });
    },

    cancel() {
      clearInterval(heartbeatTimer);
      removeSSESubscriber(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',   // Disable nginx buffering for SSE
    },
  });
}

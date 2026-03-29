/**
 * GET /api/stream — Server-Sent Events (SSE)
 *
 * On Railway (persistent Node.js) this works as designed:
 *  - One process holds all SSE connections in memory
 *  - News updates broadcast to all subscribers at once
 *  - Heartbeat every 25s keeps connections alive through proxies
 *
 * This was previously on Vercel where it was extremely expensive
 * (each SSE connection kept a lambda alive indefinitely).
 */

import { Router, Request, Response } from 'express';
import {
  addSSESubscriber, removeSSESubscriber, isCacheStale, setNewsCache,
} from '../lib/news-store.js';
import { SOURCES } from '../lib/sources.js';
import { fetchAllFeeds } from '../lib/fetcher.js';

const router = Router();

// ── Per-IP connection tracking ─────────────────────────────────────────────
let _clientSeq = 0;
const _ipConnections = new Map<string, number>();
const MAX_SSE_PER_IP = 10;

function getClientIP(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.socket.remoteAddress
      ?? '127.0.0.1';
}

router.get('/', (req: Request, res: Response) => {
  const ip           = getClientIP(req);
  const currentCount = _ipConnections.get(ip) ?? 0;
  if (currentCount >= MAX_SSE_PER_IP) {
    return res.status(429).set('Retry-After', '60').json({ error: 'Too many concurrent connections.' });
  }

  _ipConnections.set(ip, currentCount + 1);
  const clientId = `sse-${++_clientSeq}-${Date.now()}`;

  // SSE headers
  res.set({
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache, no-store, must-revalidate',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  // Lazy refresh on stale cache
  if (isCacheStale()) {
    void (async () => {
      try {
        const { items, health } = await fetchAllFeeds(SOURCES);
        items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
        setNewsCache({ items, total: items.length, fetchedAt: new Date().toISOString(),
                       sourceCount: SOURCES.length, failedSources: health.filter(h => !h.ok).length });
      } catch (e) {
        console.error('[FTG stream] initial refresh error', e);
      }
    })();
  }

  // Register subscriber — news-store pushes SSE strings here
  addSSESubscriber(clientId, (rawSSE: string) => {
    res.write(rawSSE);
  });

  // Heartbeat every 25s
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); }
    catch { cleanup(); }
  }, 25_000);

  function cleanup() {
    clearInterval(heartbeat);
    removeSSESubscriber(clientId);
    const n = (_ipConnections.get(ip) ?? 1) - 1;
    if (n <= 0) _ipConnections.delete(ip);
    else _ipConnections.set(ip, n);
  }

  req.on('close', cleanup);
  req.on('error', cleanup);

  return undefined; // Express doesn't need res.end() for SSE
});

export default router;

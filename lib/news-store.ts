/**
 * news-store.ts
 *
 * Module-level singleton that holds the cached news payload and manages
 * the registry of live SSE subscribers. On a persistent Node.js server
 * this module is loaded once and stays in memory — the background refresh
 * interval keeps running between requests.
 */

import { FeedItem, SourceHealth, fetchAllFeeds } from './fetcher';
import { SOURCES } from './sources';

export type NewsPayload = {
  items: FeedItem[];
  total: number;
  fetchedAt: string;
  sourceCount: number;
  failedSources: number;
  /** Full per-source health report — included in SSE broadcasts and cached payloads */
  health?: SourceHealth[];
};

// ── Cache ─────────────────────────────────────────────────────────────────────
let _cache: NewsPayload | null = null;
let _lastFetch = 0;

/**
 * Store-level TTL: 10 minutes.
 *
 * This controls how often a full re-fetch of all sources is triggered.
 * Kept well above the per-source TTL (15 min) so the store is never
 * considered stale while individual sources are still fresh.
 */
export const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function getNewsCache(): NewsPayload | null {
  return _cache;
}

export function isCacheStale(): boolean {
  return Date.now() - _lastFetch > CACHE_TTL_MS;
}

// ── Forced-refresh rate limiting ──────────────────────────────────────────────
/**
 * Even an explicit ?refresh=1 request won't re-hit all 100+ feeds more often
 * than once every FORCE_REFRESH_COOLDOWN_MS. This prevents the refresh button
 * from being used to spam feed providers.
 */
export const FORCE_REFRESH_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
let _lastForcedRefresh = 0;

export function canForceRefresh(): boolean {
  return Date.now() - _lastForcedRefresh > FORCE_REFRESH_COOLDOWN_MS;
}

export function markForcedRefresh(): void {
  _lastForcedRefresh = Date.now();
}

export function nextForceRefreshIn(): number {
  const remaining = FORCE_REFRESH_COOLDOWN_MS - (Date.now() - _lastForcedRefresh);
  return Math.max(0, remaining);
}

// ── SSE subscriber registry ───────────────────────────────────────────────────
// Each subscriber is a function that enqueues a raw SSE string into its stream.
type Enqueuer = (rawSSE: string) => void;
const _subscribers = new Map<string, Enqueuer>();

export function addSSESubscriber(id: string, enqueue: Enqueuer): void {
  _subscribers.set(id, enqueue);
  // Send current cache immediately so the client doesn't wait for the next refresh
  if (_cache) {
    try {
      enqueue(toSSE({ type: 'news', ..._cache }));
    } catch {
      _subscribers.delete(id);
    }
  }
}

export function removeSSESubscriber(id: string): void {
  _subscribers.delete(id);
}

export function getSubscriberCount(): number {
  return _subscribers.size;
}

// ── Publish ───────────────────────────────────────────────────────────────────
/**
 * Store a fresh payload in the cache and broadcast it to all SSE clients.
 * Called by the /api/news route after every successful fetch.
 */
export function setNewsCache(data: NewsPayload): void {
  _cache = data;
  _lastFetch = Date.now();

  if (_subscribers.size === 0) return;

  const msg = toSSE({ type: 'news', ...data });
  for (const [id, enqueue] of _subscribers) {
    try {
      enqueue(msg);
    } catch {
      _subscribers.delete(id);
    }
  }
}

// ── Background warm cache ────────────────────────────────────────────────────
/**
 * Proactively re-fetches all sources every 8 minutes so the cache is always
 * pre-warmed. First-time visitors get a cached response instantly instead of
 * waiting 3-8 s for a cold fetch.
 *
 * Guards against double-interval from HMR by tracking the reference.
 */
const BACKGROUND_REFRESH_MS = 8 * 60 * 1000; // 8 min — just under the 10-min store TTL
let _bgInterval: ReturnType<typeof setInterval> | null = null;

function startBackgroundRefresh(): void {
  if (_bgInterval) return; // already running (guard against HMR double-start)
  _bgInterval = setInterval(async () => {
    if (!isCacheStale()) return; // still fresh — nothing to do
    try {
      const { items, health } = await fetchAllFeeds(SOURCES);
      items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      setNewsCache({
        items,
        total:         items.length,
        fetchedAt:     new Date().toISOString(),
        sourceCount:   SOURCES.length,
        failedSources: health.filter(h => !h.ok).length,
        health,
      });
      console.log(`[FTG] Background refresh: ${items.length} items from ${SOURCES.length} sources`);
    } catch (err) {
      console.warn('[FTG] Background refresh failed:', (err as Error).message);
    }
  }, BACKGROUND_REFRESH_MS);
}

// Start only on the server (never in browser/edge builds)
if (typeof window === 'undefined') {
  startBackgroundRefresh();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toSSE(obj: object): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

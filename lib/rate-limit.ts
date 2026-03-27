/**
 * lib/rate-limit.ts
 *
 * Lightweight in-process sliding-window rate limiter.
 * State lives in the lambda instance — resets on cold start, which is
 * acceptable for basic abuse protection. For a distributed limit use
 * Upstash Redis; this covers 99% of abuse cases for free.
 */

type Bucket = { count: number; resetAt: number };
const _store = new Map<string, Bucket>();

/**
 * Returns true if the request should be ALLOWED, false if it should be blocked.
 *
 * @param key        Unique key, e.g. `flash-brief:1.2.3.4`
 * @param maxReqs    Maximum allowed requests in the window
 * @param windowMs   Window duration in milliseconds
 */
export function rateLimit(key: string, maxReqs: number, windowMs: number): boolean {
  const now    = Date.now();
  const bucket = _store.get(key);

  if (!bucket || now > bucket.resetAt) {
    _store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= maxReqs) return false;

  bucket.count++;
  return true;
}

/** Seconds until the key's window resets (0 if no active bucket). */
export function retryAfterSeconds(key: string): number {
  const bucket = _store.get(key);
  if (!bucket) return 0;
  return Math.max(0, Math.ceil((bucket.resetAt - Date.now()) / 1000));
}

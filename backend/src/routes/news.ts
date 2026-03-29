/**
 * GET /api/news
 * RSS news feed — uses shared news-store with 10-min cache.
 * On Railway the in-memory cache persists between requests (unlike Vercel).
 */

import { Router, Request, Response } from 'express';
import { SOURCES } from '../lib/sources.js';
import { fetchAllFeeds } from '../lib/fetcher.js';
import {
  setNewsCache, getNewsCache, isCacheStale,
  canForceRefresh, markForcedRefresh, nextForceRefreshIn,
} from '../lib/news-store.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const wantsForce  = req.query.refresh === '1';
  const forceRefresh = wantsForce && canForceRefresh();

  // Serve from cache if fresh
  if (!forceRefresh && !isCacheStale()) {
    const cached = getNewsCache();
    if (cached) {
      return res.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60')
                .json({ ...cached, cached: true });
    }
  }

  // Cooldown enforcement for forced refresh
  if (wantsForce && !forceRefresh) {
    const cached        = getNewsCache();
    const retryAfterSec = Math.ceil(nextForceRefreshIn() / 1000);
    return res.set('Retry-After', String(retryAfterSec))
              .json({ ...(cached ?? { items: [], total: 0, fetchedAt: new Date().toISOString(), sourceCount: 0, failedSources: 0 }),
                      cached: true, refreshCoolingDown: true, retryAfterSeconds: retryAfterSec });
  }

  if (forceRefresh) markForcedRefresh();

  const region     = typeof req.query.region === 'string' ? req.query.region : undefined;
  const rssSources = region && region !== 'all'
    ? SOURCES.filter(s => s.region === region)
    : SOURCES;

  const { items: allItems, health: healthReport } = await fetchAllFeeds(rssSources);
  const failedCount = healthReport.filter(h => !h.ok).length;
  allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  const payload = {
    items: allItems, total: allItems.length,
    fetchedAt: new Date().toISOString(), sourceCount: SOURCES.length,
    failedSources: failedCount, health: healthReport,
  };
  setNewsCache(payload);

  return res.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60').json(payload);
});

export default router;

/**
 * GET /api/polymarket/history
 * Returns historical probability data for Polymarket markets.
 * In-memory cache: 15 minutes (works properly on persistent Node.js).
 */

import { Router, Request, Response } from 'express';

const router = Router();

// ── Types ────────────────────────────────────────────────────────────────────
type PolymarketHistoryPoint = {
  timestamp: string;
  yesPrice: number;
  noPrice: number;
  volume?: number;
};

type PolymarketHistory = {
  conditionId: string;
  title: string;
  category: string;
  history: PolymarketHistoryPoint[];
};

// ── In-memory cache (persists between requests — unlike Vercel lambdas) ──────
// Map: conditionId -> { history: PolymarketHistoryPoint[], lastFetch: number }
let _historyCache = new Map<string, { history: PolymarketHistoryPoint[]; lastFetch: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// ── Fetch historical data from Polymarket Gamma API ─────────────────────────
async function fetchPolymarketHistory(conditionId: string): Promise<PolymarketHistoryPoint[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  
  try {
    // Polymarket Gamma API for orderbook (contains price history)
    const url = `https://gamma-api.polymarket.com/orderbooks?condition_id=${conditionId}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    
    if (!res.ok) return [];
    
    const data = await res.json() as any;
    const orderbook = data?.orderbook || [];
    
    // Extract price history from orderbook
    // The orderbook contains current prices, but for historical data we need to
    // use the events endpoint or store snapshots. For now, we'll return
    // current price as a single data point and expand later with proper history.
    
    const currentPoint: PolymarketHistoryPoint = {
      timestamp: new Date().toISOString(),
      yesPrice: orderbook[0]?.yes_price || 0,
      noPrice: orderbook[0]?.no_price || 0,
      volume: orderbook[0]?.volume,
    };
    
    // In a full implementation, we would:
    // 1. Store snapshots every 15 minutes
    // 2. Query the snapshots for historical data
    // 3. Return the full history
    
    // For now, return current point as a placeholder
    return [currentPoint];
  } catch (err) {
    console.error('[fetchPolymarketHistory]', err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const { conditionId } = req.query;
  
  if (!conditionId || typeof conditionId !== 'string') {
    return res.status(400).json({ error: 'conditionId is required' });
  }
  
  // Check cache
  const cached = _historyCache.get(conditionId);
  if (cached && Date.now() - cached.lastFetch < CACHE_TTL) {
    res.set('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=300');
    return res.json({ conditionId, history: cached.history });
  }
  
  // Fetch fresh data
  const history = await fetchPolymarketHistory(conditionId);
  
  // Update cache
  _historyCache.set(conditionId, { history, lastFetch: Date.now() });
  
  // Clean up old cache entries (keep last 50)
  if (_historyCache.size > 50) {
    const entries = Array.from(_historyCache.entries()).sort((a, b) => b[1].lastFetch - a[1].lastFetch);
    _historyCache = new Map(entries.slice(0, 50));
  }
  
  res.set('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=300');
  res.json({ conditionId, history });
});

export default router;

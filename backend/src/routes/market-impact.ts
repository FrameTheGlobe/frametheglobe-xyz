/**
 * GET /api/market-impact
 * Returns price changes for symbols around a given timestamp.
 * Used to correlate news clusters with market movements.
 * In-memory cache: 5 minutes (works properly on persistent Node.js).
 */

import { Router, Request, Response } from 'express';

const router = Router();

// ── Types ────────────────────────────────────────────────────────────────────
type Quote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
};

type MarketImpactRequest = {
  timestamp?: string; // ISO date string
  windowHours?: number; // How many hours before/after to look (default: 24)
  symbols?: string[]; // Specific symbols to fetch (default: all)
};

// ── In-memory cache (persists between requests — unlike Vercel lambdas) ──────
let _cache: Map<string, { data: Quote[]; at: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Yahoo Finance (historical data) ───────────────────────────────────────────
async function fetchYahooHistorical(yfSym: string, outSym: string, name: string, timestamp: string, windowHours: number): Promise<Quote | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const targetDate = new Date(timestamp);
    const startDate = new Date(targetDate.getTime() - windowHours * 60 * 60 * 1000);
    const endDate = new Date(targetDate.getTime() + windowHours * 60 * 60 * 1000);
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?interval=1d&period1=${Math.floor(startDate.getTime() / 1000)}&period2=${Math.floor(endDate.getTime() / 1000)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    
    if (!timestamps.length || !closes.length) return null;
    
    // Find the closest price to the target timestamp
    const targetMs = targetDate.getTime() / 1000;
    let closestIdx = 0;
    let minDiff = Math.abs(timestamps[0] - targetMs);
    
    for (let i = 1; i < timestamps.length; i++) {
      const diff = Math.abs(timestamps[i] - targetMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    
    const price = closes[closestIdx];
    if (!price || price <= 0) return null;
    
    // Calculate change from the beginning of the window
    const startPrice = closes[0];
    const change = price - startPrice;
    const changePercent = startPrice > 0 ? (change / startPrice) * 100 : 0;
    
    return { symbol: outSym, name, price, change, changePercent, currency: 'USD' };
  } catch { return null; }
  finally { clearTimeout(timeout); }
}

// ── Symbol definitions ────────────────────────────────────────────────────────
const SYMBOLS = [
  { yfSym: 'CL=F', outSym: 'CL=F', name: 'WTI Crude' },
  { yfSym: 'BZ=F', outSym: 'BZ=F', name: 'Brent Crude' },
  { yfSym: 'NG=F', outSym: 'NG=F', name: 'Natural Gas' },
  { yfSym: 'UX=F', outSym: 'UX=F', name: 'Uranium' },
  { yfSym: 'GC=F', outSym: 'GC=F', name: 'Gold' },
  { yfSym: 'SI=F', outSym: 'SI=F', name: 'Silver' },
  { yfSym: 'RB=F', outSym: 'RB=F', name: 'RBOB Gasoline' },
  { yfSym: 'HO=F', outSym: 'HO=F', name: 'Heating Oil' },
];

// ── Handler ──────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const { timestamp, windowHours, symbols } = req.query as MarketImpactRequest;
  
  // Default to current time if no timestamp provided
  const targetTimestamp = timestamp || new Date().toISOString();
  const window = windowHours ? parseInt(String(windowHours), 10) : 24;
  
  // Build cache key
  const cacheKey = `${targetTimestamp}-${window}-${(symbols || []).join(',')}`;
  
  // Serve from cache if fresh
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.json(cached.data);
  }
  
  // Determine which symbols to fetch
  const symbolsToFetch = symbols && symbols.length > 0 
    ? SYMBOLS.filter(s => symbols.includes(s.outSym))
    : SYMBOLS;
  
  // Fetch all symbols in parallel
  const quotes = await Promise.all(
    symbolsToFetch.map(s => fetchYahooHistorical(s.yfSym, s.outSym, s.name, targetTimestamp, window))
  );
  
  const validQuotes = quotes.filter((q): q is Quote => q !== null);
  
  // Cache the result
  _cache.set(cacheKey, { data: validQuotes, at: Date.now() });
  
  // Clean up old cache entries (keep last 20)
  if (_cache.size > 20) {
    const entries = Array.from(_cache.entries()).sort((a, b) => b[1].at - a[1].at);
    _cache = new Map(entries.slice(0, 20));
  }
  
  res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
  res.json(validQuotes);
});

export default router;

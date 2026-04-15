/**
 * POST /api/share
 * Create a shareable link with current filter/lens state.
 * GET /api/share/:token
 * Retrieve shared filter/lens state by token.
 * In-memory cache with 24h TTL.
 */

import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';

const router = Router();

// ── Types ────────────────────────────────────────────────────────────────────
type SharedState = {
  token: string;
  lenses: string[];
  sources: string[];
  regions: string[];
  search?: string;
  createdAt: number;
};

// ── In-memory cache (persists between requests — unlike Vercel lambdas) ──────
let _shareCache = new Map<string, SharedState>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ── Generate short token ─────────────────────────────────────────────────────
function generateToken(): string {
  return randomBytes(6).toString('base64url');
}

// ── Clean expired entries ───────────────────────────────────────────────────
function cleanExpired() {
  const now = Date.now();
  for (const [token, state] of _shareCache.entries()) {
    if (now - state.createdAt > CACHE_TTL) {
      _shareCache.delete(token);
    }
  }
}

// ── POST: Create shareable link ──────────────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
  cleanExpired();
  
  const { lenses, sources, regions, search } = req.body as {
    lenses?: string[];
    sources?: string[];
    regions?: string[];
    search?: string;
  };
  
  const token = generateToken();
  const state: SharedState = {
    token,
    lenses: lenses || [],
    sources: sources || [],
    regions: regions || [],
    search,
    createdAt: Date.now(),
  };
  
  _shareCache.set(token, state);
  
  // Clean up if cache gets too large (keep last 1000 entries)
  if (_shareCache.size > 1000) {
    const entries = Array.from(_shareCache.entries()).sort((a, b) => b[1].createdAt - a[1].createdAt);
    _shareCache = new Map(entries.slice(0, 1000));
  }
  
  res.json({ token, url: `${req.protocol}://${req.get('host')}/?share=${token}` });
});

// ── GET: Retrieve shared state ────────────────────────────────────────────────
router.get('/:token', (req: Request, res: Response) => {
  cleanExpired();
  
  const { token } = req.params;
  const state = _shareCache.get(token);
  
  if (!state) {
    return res.status(404).json({ error: 'Share link not found or expired' });
  }
  
  res.json({
    lenses: state.lenses,
    sources: state.sources,
    regions: state.regions,
    search: state.search,
  });
});

export default router;

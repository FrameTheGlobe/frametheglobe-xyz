// GET /api/rss — thin proxy to Railway backend.
// The RSS feed reads from the news-store in-memory cache which only works
// on the persistent Railway process, not on Vercel cold lambdas.
import { proxyGet } from '@/lib/backend-proxy';
export const runtime = 'nodejs';
export const GET = proxyGet('/api/rss');

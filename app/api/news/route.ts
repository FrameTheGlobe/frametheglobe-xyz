// GET /api/news — thin proxy to Railway backend.
import { proxyGet } from '@/lib/backend-proxy';
export const runtime = 'nodejs';
export const GET = proxyGet('/api/news');

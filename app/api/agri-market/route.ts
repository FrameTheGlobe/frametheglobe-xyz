// GET /api/agri-market — thin proxy to Railway backend.
import { proxyGet } from '@/lib/backend-proxy';
export const runtime = 'nodejs';
export const GET = proxyGet('/api/agri-market');

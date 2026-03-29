// POST /api/article-brief — thin proxy to Railway backend.
import { proxyPost } from '@/lib/backend-proxy';
export const runtime = 'nodejs';
export const POST = proxyPost('/api/article-brief');

export type { ArticleBriefPayload } from './types';

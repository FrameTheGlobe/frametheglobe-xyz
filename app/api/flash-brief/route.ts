// POST /api/flash-brief — thin proxy to Railway backend.
import { proxyPost } from '@/lib/backend-proxy';
export const runtime = 'nodejs';
export const POST = proxyPost('/api/flash-brief');
export const GET  = proxyPost('/api/flash-brief');

export type { FlashBriefPayload } from './types';

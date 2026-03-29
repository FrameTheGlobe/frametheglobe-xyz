// POST /api/analyst-briefing — thin proxy to Railway backend.
import { proxyPost } from '@/lib/backend-proxy';
export const runtime = 'nodejs';
export const POST = proxyPost('/api/analyst-briefing');

export type { BriefingResult } from './types';

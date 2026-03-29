// POST /api/analyze-ticker — thin proxy to Railway backend.
import { proxyPost } from '@/lib/backend-proxy';
export const runtime = 'nodejs';
export const POST = proxyPost('/api/analyze-ticker');

export type { TickerCategory, TickerClickPayload, TickerAnalysisResult } from './types';

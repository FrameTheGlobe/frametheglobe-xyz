/**
 * POST /api/ai-intel — thin proxy to Railway backend.
 * All business logic + Groq calls live in backend/src/routes/ai-intel.ts.
 *
 * Re-exporting types so client components can still import them from here.
 */
import { proxyPost } from '@/lib/backend-proxy';
export const runtime = 'nodejs';
export const POST = proxyPost('/api/ai-intel');
export const GET  = proxyPost('/api/ai-intel'); // returns 405 from backend

// Re-export types so existing component imports don't break
export type { ThreatLevel, Theater, CountryInstability, Forecast, SigintItem, AIIntelPayload } from './types';

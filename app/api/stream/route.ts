/**
 * GET /api/stream — SSE proxy.
 * Redirects the browser directly to the Railway backend SSE endpoint,
 * so Vercel never holds a persistent connection (which was expensive).
 */
import { proxySSE } from '@/lib/backend-proxy';
export const runtime = 'nodejs';
export const GET = proxySSE();

/**
 * POST /api/share
 * Create a shareable link with current filter/lens state.
 */

import { proxyPost } from '@/lib/backend-proxy';

export const POST = proxyPost('/api/share');

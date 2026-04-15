/**
 * POST /api/entities
 * Extract entities from provided news articles.
 */

import { proxyPost } from '@/lib/backend-proxy';

export const POST = proxyPost('/api/entities');

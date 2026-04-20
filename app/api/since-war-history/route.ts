import { proxyGet } from '@/lib/backend-proxy';

export const runtime = 'nodejs';
export const GET = proxyGet('/api/since-war-history');

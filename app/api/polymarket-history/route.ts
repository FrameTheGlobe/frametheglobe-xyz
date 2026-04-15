/**
 * GET /api/polymarket-history
 * Proxy to Railway backend for Polymarket historical probability data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '@/lib/backend-proxy';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const conditionId = searchParams.get('conditionId');

  if (!conditionId) {
    return NextResponse.json({ error: 'conditionId is required' }, { status: 400 });
  }

  const path = `/api/polymarket-history?conditionId=${encodeURIComponent(conditionId)}`;
  const handler = proxyGet(path);
  return handler(request);
}

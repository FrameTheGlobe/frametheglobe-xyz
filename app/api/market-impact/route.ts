/**
 * GET /api/market-impact
 * Proxy to Railway backend for market impact data.
 * Returns price changes for symbols around a given timestamp.
 */

import { NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '@/lib/backend-proxy';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const timestamp = searchParams.get('timestamp');
  const windowHours = searchParams.get('windowHours');
  const symbols = searchParams.get('symbols');

  const params = new URLSearchParams();
  if (timestamp) params.set('timestamp', timestamp);
  if (windowHours) params.set('windowHours', windowHours);
  if (symbols) params.set('symbols', symbols);

  const queryString = params.toString();
  const path = `/api/market-impact${queryString ? `?${queryString}` : ''}`;

  const handler = proxyGet(path);
  return handler(request);
}

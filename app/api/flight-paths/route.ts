/**
 * GET /api/flight-paths
 * Proxy to backend flight path tracking endpoint.
 */

import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/backend-proxy';

export const GET = (req: NextRequest) => {
  const url = new URL(req.url);
  const strategic = url.searchParams.get('strategic');
  const geojson = url.searchParams.get('geojson');
  const hex = url.searchParams.get('hex');

  const queryParams = new URLSearchParams();
  if (strategic) queryParams.set('strategic', strategic);
  if (geojson) queryParams.set('geojson', geojson);
  if (hex) queryParams.set('hex', hex);

  const backendPath = `/api/flight-paths${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return proxyGet(backendPath)(req);
};

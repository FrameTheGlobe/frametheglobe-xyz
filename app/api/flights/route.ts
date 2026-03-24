/**
 * GET /api/flights
 *
 * Returns live aircraft positions for the Iran War Theater, sourced from
 * the adsb.lol community ADS-B network (no API key required).
 *
 * The server-side 5-minute cache means the upstream API is called at most
 * ~288 times/day regardless of how many clients are connected.
 *
 * Optional query params:
 *   ?strategic=1   only return strategically interesting aircraft
 *   ?format=geojson  return GeoJSON FeatureCollection (for other map libs)
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchFlights, getFlightsCache, isFlightCacheStale } from '@/lib/flights';

export const runtime   = 'nodejs';
export const dynamic   = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const strategicOnly    = searchParams.get('strategic') === '1';
  const forceRefresh     = searchParams.get('refresh')   === '1';

  // Return cached data if fresh (don't hit upstream on every client poll)
  let payload = (!forceRefresh && !isFlightCacheStale())
    ? getFlightsCache()
    : null;

  if (!payload) {
    payload = await fetchFlights();
  }

  let aircraft = payload.aircraft;
  if (strategicOnly) {
    aircraft = aircraft.filter(a => a.isStrategic);
  }

  const body = {
    aircraft,
    total:     payload.total,
    strategic: payload.strategic,
    fetchedAt: payload.fetchedAt,
    source:    payload.source,
    cached:    !isFlightCacheStale(),
  };

  const res = NextResponse.json(body);
  res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
  res.headers.set('X-Flight-Source', payload.source);
  res.headers.set('X-Aircraft-Count', String(aircraft.length));
  return res;
}

/**
 * GET /api/flights
 * Live ADS-B aircraft positions — uses shared flights lib with 5-min cache.
 */

import { Router, Request, Response } from 'express';
import { fetchFlights, getFlightsCache, isFlightCacheStale } from '../lib/flights.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const strategicOnly = req.query.strategic === '1';
  const forceRefresh  = req.query.refresh   === '1';

  let payload = (!forceRefresh && !isFlightCacheStale()) ? getFlightsCache() : null;
  if (!payload) payload = await fetchFlights();

  let aircraft = payload.aircraft;
  if (strategicOnly) aircraft = aircraft.filter(a => a.isStrategic);

  res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30')
     .set('X-Flight-Source', payload.source)
     .set('X-Aircraft-Count', String(aircraft.length))
     .json({ aircraft, total: payload.total, strategic: payload.strategic,
             fetchedAt: payload.fetchedAt, source: payload.source, cached: !isFlightCacheStale() });
});

export default router;

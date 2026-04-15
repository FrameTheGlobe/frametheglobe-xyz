/**
 * GET /api/flight-paths
 * Returns aircraft position history (flight paths) with optional filtering.
 * Query params:
 *   - strategic=1: strategic aircraft only
 *   - geojson=1: return GeoJSON format
 *   - hex=<icao>: specific aircraft path
 */

import { Router, Request, Response } from 'express';
import { getPaths, getStrategicPaths, getPathByHex, pathsToGeoJSON } from '../lib/flight-paths.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const strategicOnly = req.query.strategic === '1';
  const asGeoJSON = req.query.geojson === '1';
  const hex = req.query.hex as string | undefined;

  let paths;
  if (hex) {
    const single = getPathByHex(hex);
    paths = single ? [single] : [];
  } else {
    paths = strategicOnly ? getStrategicPaths() : getPaths();
  }

  if (asGeoJSON) {
    res.json(pathsToGeoJSON(paths));
  } else {
    res.json({
      paths,
      count: paths.length,
      strategicCount: paths.filter(p => p.isStrategic).length,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

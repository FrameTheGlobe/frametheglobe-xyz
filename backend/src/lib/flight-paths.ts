/**
 * lib/flight-paths.ts
 *
 * Tracks aircraft position history to enable flight path visualization.
 * Maintains a rolling buffer of recent positions per aircraft (15 min).
 */

import type { Aircraft } from './flights.js';

export type PositionPoint = {
  lat: number;
  lon: number;
  altFt: number;
  speedKts: number;
  heading: number;
  timestamp: number;
};

export type AircraftPath = {
  hex: string;
  callsign: string;
  isStrategic: boolean;
  strategicHint: string;
  positions: PositionPoint[];
  lastUpdated: number;
};

// Rolling position history per aircraft (15 minutes)
const PATH_HISTORY_MS = 15 * 60 * 1000;
const _paths = new Map<string, AircraftPath>();

/**
 * Update aircraft paths with new positions.
 * Call this whenever fresh flight data arrives.
 */
export function updatePaths(aircraft: Aircraft[]): void {
  const now = Date.now();

  for (const ac of aircraft) {
    const existing = _paths.get(ac.hex);
    const newPoint: PositionPoint = {
      lat: ac.lat,
      lon: ac.lon,
      altFt: ac.altFt,
      speedKts: ac.speedKts,
      heading: ac.heading,
      timestamp: now,
    };

    if (existing) {
      // Add new position and filter old ones
      existing.positions.push(newPoint);
      existing.positions = existing.positions.filter(p => now - p.timestamp <= PATH_HISTORY_MS);
      existing.callsign = ac.callsign || existing.callsign;
      existing.isStrategic = ac.isStrategic;
      existing.strategicHint = ac.strategicHint;
      existing.lastUpdated = now;
    } else {
      // New aircraft
      _paths.set(ac.hex, {
        hex: ac.hex,
        callsign: ac.callsign || ac.hex,
        isStrategic: ac.isStrategic,
        strategicHint: ac.strategicHint,
        positions: [newPoint],
        lastUpdated: now,
      });
    }
  }

  // Cleanup stale aircraft (not seen in 20 minutes)
  for (const [hex, path] of _paths.entries()) {
    if (now - path.lastUpdated > 20 * 60 * 1000) {
      _paths.delete(hex);
    }
  }
}

/**
 * Get all current paths with their position history.
 */
export function getPaths(): AircraftPath[] {
  const now = Date.now();
  return Array.from(_paths.values()).filter(p => now - p.lastUpdated <= PATH_HISTORY_MS);
}

/**
 * Get paths for strategic aircraft only.
 */
export function getStrategicPaths(): AircraftPath[] {
  return getPaths().filter(p => p.isStrategic);
}

/**
 * Get a specific aircraft's path by hex code.
 */
export function getPathByHex(hex: string): AircraftPath | undefined {
  return _paths.get(hex.toLowerCase());
}

/**
 * Calculate distance between two points in nautical miles.
 */
export function distanceNm(p1: PositionPoint, p2: PositionPoint): number {
  const R = 3440; // Earth's radius in nautical miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lon - p1.lon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate total path distance in nautical miles.
 */
export function pathDistanceNm(positions: PositionPoint[]): number {
  if (positions.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < positions.length; i++) {
    total += distanceNm(positions[i - 1], positions[i]);
  }
  return total;
}

/**
 * Estimate time to destination based on current speed and heading.
 */
export function estimateTimeToPosition(
  current: PositionPoint,
  destLat: number,
  destLon: number
): { distanceNm: number; timeMinutes: number | null } {
  const destPoint = { lat: destLat, lon: destLon, altFt: 0, speedKts: 0, heading: 0, timestamp: 0 };
  const dist = distanceNm(current, destPoint);
  const time = current.speedKts > 0 ? (dist / current.speedKts) * 60 : null;
  return { distanceNm: dist, timeMinutes: time };
}

/**
 * Detect if aircraft is orbiting (circular pattern).
 */
export function detectOrbitPattern(positions: PositionPoint[]): { isOrbiting: boolean; center?: [number, number]; radiusNm?: number } {
  if (positions.length < 8) return { isOrbiting: false };

  // Check for heading changes indicating a loop
  const headingChanges: number[] = [];
  for (let i = 1; i < positions.length; i++) {
    let change = positions[i].heading - positions[i - 1].heading;
    // Normalize to -180 to 180
    while (change > 180) change -= 360;
    while (change < -180) change += 360;
    headingChanges.push(change);
  }

  // Sum changes - full circle would be ~360
  const totalChange = headingChanges.reduce((a, b) => a + b, 0);
  const isOrbiting = Math.abs(totalChange) > 270;

  if (!isOrbiting) return { isOrbiting: false };

  // Calculate center from bounding box
  const lats = positions.map(p => p.lat);
  const lons = positions.map(p => p.lon);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;

  // Estimate radius
  const avgDist = positions.reduce((sum, p) => {
    const d = distanceNm({ lat: centerLat, lon: centerLon, altFt: 0, speedKts: 0, heading: 0, timestamp: 0 }, p);
    return sum + d;
  }, 0) / positions.length;

  return { isOrbiting: true, center: [centerLat, centerLon], radiusNm: avgDist };
}

/**
 * Export paths in GeoJSON format for map rendering.
 */
export function pathsToGeoJSON(paths: AircraftPath[]): {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'LineString'; coordinates: [number, number, number][] };
    properties: { hex: string; callsign: string; isStrategic: boolean; strategicHint: string };
  }>;
} {
  return {
    type: 'FeatureCollection',
    features: paths.map(path => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: path.positions.map(p => [p.lon, p.lat, p.altFt]),
      },
      properties: {
        hex: path.hex,
        callsign: path.callsign,
        isStrategic: path.isStrategic,
        strategicHint: path.strategicHint,
      },
    })),
  };
}

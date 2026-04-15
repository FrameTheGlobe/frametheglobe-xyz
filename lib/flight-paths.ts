/**
 * lib/flight-paths.ts
 * Frontend types and utilities for flight path visualization.
 */

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

export type FlightPathsResponse = {
  paths: AircraftPath[];
  count: number;
  strategicCount: number;
  timestamp: string;
};

/**
 * Fetch flight paths from the API.
 */
export async function fetchFlightPaths(options?: {
  strategicOnly?: boolean;
  hex?: string;
}): Promise<FlightPathsResponse> {
  const params = new URLSearchParams();
  if (options?.strategicOnly) params.set('strategic', '1');
  if (options?.hex) params.set('hex', options.hex);

  const url = `/api/flight-paths${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch flight paths: ${res.status}`);
  return res.json();
}

/**
 * Calculate path length in nautical miles.
 */
export function pathLengthNm(positions: PositionPoint[]): number {
  if (positions.length < 2) return 0;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3440; // Earth's radius in nautical miles

  let total = 0;
  for (let i = 1; i < positions.length; i++) {
    const p1 = positions[i - 1];
    const p2 = positions[i];
    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lon - p1.lon);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += R * c;
  }
  return total;
}

/**
 * Get color for path based on altitude.
 */
export function getPathColor(altFt: number): string {
  if (altFt > 35000) return '#8b5cf6'; // High altitude - purple
  if (altFt > 25000) return '#3b82f6'; // Medium-high - blue
  if (altFt > 15000) return '#10b981'; // Medium - green
  if (altFt > 5000) return '#f59e0b';  // Low - yellow
  return '#ef4444'; // Very low - red
}

/**
 * Format flight duration from milliseconds.
 */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

/**
 * Detect if aircraft is in holding pattern (circular/orbit).
 */
export function detectHoldingPattern(positions: PositionPoint[]): {
  isHolding: boolean;
  turns?: number;
} {
  if (positions.length < 10) return { isHolding: false };

  // Calculate heading changes
  let totalTurn = 0;
  for (let i = 2; i < positions.length; i++) {
    const h1 = positions[i - 2].heading;
    const h2 = positions[i - 1].heading;
    const h3 = positions[i].heading;

    let change1 = h2 - h1;
    let change2 = h3 - h2;

    // Normalize to -180 to 180
    while (change1 > 180) change1 -= 360;
    while (change1 < -180) change1 += 360;
    while (change2 > 180) change2 -= 360;
    while (change2 < -180) change2 += 360;

    // Consistent turn direction
    if (Math.sign(change1) === Math.sign(change2) && Math.abs(change1) > 5 && Math.abs(change2) > 5) {
      totalTurn += Math.abs(change1);
    }
  }

  // 360+ degrees of turning suggests a pattern
  const turns = totalTurn / 360;
  return { isHolding: turns >= 0.8, turns: Math.floor(turns) };
}

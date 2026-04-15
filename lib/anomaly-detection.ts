/**
 * lib/anomaly-detection.ts
 *
 * Advanced anomaly detection for identifying unusual patterns in news data.
 * Uses statistical methods and heuristics to flag outliers.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnomalySeverity = 'info' | 'warning' | 'critical';

export type AnomalyType =
  | 'volume_spike'        // Unusual news volume
  | 'source_burst'        // Unusual activity from specific source
  | 'keyword_surge'       // Sudden spike in keyword mentions
  | 'contradiction'       // Conflicting reports
  | 'geographic_shift'    // News moving to new regions
  | 'temporal_cluster'    // Unusual clustering in time
  | 'market_news_divergence'  // Market not reacting to major news
  | 'trust_anomaly';     // Low-trust sources dominating

export type Anomaly = {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  detectedAt: number;
  confidence: number;      // 0-1
  affectedItems?: string[]; // IDs of affected items
  metadata?: Record<string, unknown>;
  recommendation?: string;
};

export type BaselineStats = {
  avgVolumePerHour: number;
  avgBySource: Map<string, number>;
  keywordBaseline: Map<string, number>;
  typicalRegions: string[];
  lastUpdated: number;
};

// ── Statistical Utilities ───────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = mean(values.map((v) => Math.pow(v - m, 2)));
  return Math.sqrt(variance);
}

function zScore(value: number, m: number, sd: number): number {
  if (sd === 0) return 0;
  return (value - m) / sd;
}

// ── Anomaly Detectors ─────────────────────────────────────────────────────────

type Detector = (
  items: Array<{
    id?: string;
    title: string;
    summary: string;
    pubDate: string;
    sourceId?: string;
    sourceName?: string;
    region?: string;
  }>,
  baseline?: BaselineStats
) => Anomaly[];

/**
 * Detect volume spikes - unusually high number of articles.
 */
const detectVolumeSpike: Detector = (items, baseline) => {
  const anomalies: Anomaly[] = [];
  if (items.length === 0) return anomalies;

  // Group by hour
  const byHour = new Map<string, number>();
  items.forEach((item) => {
    const hour = item.pubDate.slice(0, 13); // YYYY-MM-DDTHH
    byHour.set(hour, (byHour.get(hour) || 0) + 1);
  });

  const volumes = Array.from(byHour.values());
  const avgVolume = baseline?.avgVolumePerHour || mean(volumes);
  const sd = stdDev(volumes);

  // Check last few hours for spikes
  const sortedHours = Array.from(byHour.entries()).sort().slice(-3);
  for (const [hour, count] of sortedHours) {
    const z = zScore(count, avgVolume, sd);
    if (z > 2.5) {
      anomalies.push({
        id: `vol-${hour}`,
        type: 'volume_spike',
        severity: z > 4 ? 'critical' : z > 3 ? 'warning' : 'info',
        title: 'News Volume Spike Detected',
        description: `${count} articles in hour ${hour} (avg: ${avgVolume.toFixed(1)}, z-score: ${z.toFixed(2)})`,
        detectedAt: Date.now(),
        confidence: Math.min(z / 4, 0.95),
        metadata: { hour, count, expected: avgVolume, zScore: z },
        recommendation: 'Review breaking developments - unusual news volume often precedes major events.',
      });
    }
  }

  return anomalies;
};

/**
 * Detect source bursts - one source publishing unusually frequently.
 */
const detectSourceBurst: Detector = (items, baseline) => {
  const anomalies: Anomaly[] = [];

  // Count by source in recent window (last 2 hours)
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  const recentItems = items.filter((i) => new Date(i.pubDate).getTime() > cutoff);

  const bySource = new Map<string, number>();
  recentItems.forEach((item) => {
    const sid = item.sourceId || 'unknown';
    bySource.set(sid, (bySource.get(sid) || 0) + 1);
  });

  for (const [source, count] of bySource.entries()) {
    const baselineAvg = baseline?.avgBySource.get(source) || 2;
    if (count > baselineAvg * 3 && count > 5) {
      anomalies.push({
        id: `src-${source}-${Date.now()}`,
        type: 'source_burst',
        severity: count > baselineAvg * 5 ? 'critical' : 'warning',
        title: 'Source Activity Burst',
        description: `${source} published ${count} articles in last 2h (typical: ~${baselineAvg})`,
        detectedAt: Date.now(),
        confidence: Math.min(count / (baselineAvg * 5), 0.9),
        metadata: { source, count, baseline: baselineAvg },
        recommendation: 'Verify source reliability - burst activity may indicate developing story or source-specific issue.',
      });
    }
  }

  return anomalies;
};

/**
 * Detect keyword surges - sudden spikes in keyword mentions.
 */
const detectKeywordSurge: Detector = (items) => {
  const anomalies: Anomaly[] = [];
  if (items.length < 10) return anomalies;

  // Split into two time windows
  const mid = Math.floor(items.length / 2);
  const firstHalf = items.slice(0, mid);
  const secondHalf = items.slice(mid);

  const keywords = ['missile', 'strike', 'attack', 'cyber', 'nuclear', 'sanctions', 'embassy'];

  for (const keyword of keywords) {
    const firstCount = firstHalf.filter((i) =>
      `${i.title} ${i.summary}`.toLowerCase().includes(keyword)
    ).length;
    const secondCount = secondHalf.filter((i) =>
      `${i.title} ${i.summary}`.toLowerCase().includes(keyword)
    ).length;

    if (secondCount > firstCount * 2 && secondCount > 3) {
      anomalies.push({
        id: `kw-${keyword}-${Date.now()}`,
        type: 'keyword_surge',
        severity: secondCount > firstCount * 4 ? 'critical' : 'warning',
        title: `Keyword Surge: "${keyword}"`,
        description: `Mentions of "${keyword}" increased ${(secondCount / Math.max(firstCount, 1)).toFixed(1)}x in recent period`,
        detectedAt: Date.now(),
        confidence: Math.min(secondCount / 10, 0.9),
        metadata: { keyword, before: firstCount, after: secondCount },
        recommendation: `Monitor for developments related to ${keyword} - significant increase in mentions detected.`,
      });
    }
  }

  return anomalies;
};

/**
 * Detect contradictions in reporting.
 */
const detectContradictions: Detector = (items) => {
  const anomalies: Anomaly[] = [];

  // Look for negation patterns
  const contradictionPatterns = [
    { pos: 'confirmed', neg: 'denied|denies|refuted' },
    { pos: 'attack', neg: 'false alarm|not attack' },
    { pos: 'killed', neg: 'survived|unharmed' },
    { pos: 'destroyed', neg: 'intact|undamaged' },
  ];

  for (const { pos, neg } of contradictionPatterns) {
    const posItems = items.filter((i) =>
      new RegExp(`\\b${pos}\\b`, 'i').test(`${i.title} ${i.summary}`)
    );
    const negItems = items.filter((i) =>
      new RegExp(`\\b(${neg})\\b`, 'i').test(`${i.title} ${i.summary}`)
    );

    if (posItems.length > 0 && negItems.length > 0) {
      // Check if they're about same general topic/time
      const posTime = new Date(posItems[0].pubDate).getTime();
      const negTime = new Date(negItems[0].pubDate).getTime();
      const timeDiff = Math.abs(posTime - negTime);

      if (timeDiff < 24 * 60 * 60 * 1000) {
        anomalies.push({
          id: `contra-${pos}-${Date.now()}`,
          type: 'contradiction',
          severity: 'warning',
          title: 'Conflicting Reports Detected',
          description: `Contradictory statements about "${pos}" within ${Math.round(timeDiff / 3600000)}h`,
          detectedAt: Date.now(),
          confidence: 0.7,
          affectedItems: [posItems[0].id || '', negItems[0].id || ''].filter(Boolean),
          metadata: { positiveCount: posItems.length, negativeCount: negItems.length },
          recommendation: 'Cross-verify with primary sources - conflicting information requires validation.',
        });
      }
    }
  }

  return anomalies;
};

/**
 * Detect geographic shift - news moving to unexpected regions.
 */
const detectGeographicShift: Detector = (items, baseline) => {
  const anomalies: Anomaly[] = [];

  const recentItems = items.slice(-20);
  const regionCounts = new Map<string, number>();
  recentItems.forEach((i) => {
    const r = i.region || 'unknown';
    regionCounts.set(r, (regionCounts.get(r) || 0) + 1);
  });

  const typicalRegions = baseline?.typicalRegions || [];
  const dominantRegion = Array.from(regionCounts.entries()).sort((a, b) => b[1] - a[1])[0];

  if (dominantRegion && !typicalRegions.includes(dominantRegion[0]) && dominantRegion[1] > 5) {
    anomalies.push({
      id: `geo-${dominantRegion[0]}-${Date.now()}`,
      type: 'geographic_shift',
      severity: 'info',
      title: 'Geographic Focus Shift',
      description: `Unusual concentration of news from ${dominantRegion[0]} region`,
      detectedAt: Date.now(),
      confidence: Math.min(dominantRegion[1] / 10, 0.8),
      metadata: { region: dominantRegion[0], count: dominantRegion[1] },
      recommendation: 'Monitor for regional escalation - news focus has shifted to this region.',
    });
  }

  return anomalies;
};

/**
 * Detect temporal clustering - unusual timing patterns.
 */
const detectTemporalCluster: Detector = (items) => {
  const anomalies: Anomaly[] = [];
  if (items.length < 20) return anomalies;

  // Check for unusual clustering within short time windows
  const timeWindows = new Map<string, number>();
  items.forEach((item) => {
    const min = Math.floor(new Date(item.pubDate).getTime() / (5 * 60 * 1000)).toString(); // 5-min windows
    timeWindows.set(min, (timeWindows.get(min) || 0) + 1);
  });

  const clusters = Array.from(timeWindows.values()).filter((c) => c > 5);
  if (clusters.length > 0) {
    const maxCluster = Math.max(...clusters);
    anomalies.push({
      id: `temporal-${Date.now()}`,
      type: 'temporal_cluster',
      severity: maxCluster > 10 ? 'warning' : 'info',
      title: 'Temporal Clustering Detected',
      description: `${clusters.length} time windows with ${maxCluster}+ articles each`,
      detectedAt: Date.now(),
      confidence: Math.min(maxCluster / 15, 0.85),
      metadata: { clusterCount: clusters.length, maxSize: maxCluster },
      recommendation: 'Check for coordinated news releases or breaking event with rapid coverage.',
    });
  }

  return anomalies;
};

// ── Main Detection Function ─────────────────────────────────────────────────

/**
 * Run all anomaly detectors on a set of items.
 */
export function detectAnomalies(
  items: Array<{
    id?: string;
    title: string;
    summary: string;
    pubDate: string;
    sourceId?: string;
    sourceName?: string;
    region?: string;
  }>,
  baseline?: BaselineStats
): Anomaly[] {
  const detectors: Detector[] = [
    detectVolumeSpike,
    detectSourceBurst,
    detectKeywordSurge,
    detectContradictions,
    detectGeographicShift,
    detectTemporalCluster,
  ];

  const allAnomalies = detectors.flatMap((d) => d(items, baseline));

  // Sort by severity then confidence
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  return allAnomalies.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });
}

/**
 * Build baseline statistics from historical data.
 */
export function buildBaseline(
  historicalItems: Array<{
    title: string;
    summary: string;
    pubDate: string;
    sourceId?: string;
    region?: string;
  }>
): BaselineStats {
  // Group by hour for volume baseline
  const byHour = new Map<string, number>();
  historicalItems.forEach((item) => {
    const hour = item.pubDate.slice(0, 13);
    byHour.set(hour, (byHour.get(hour) || 0) + 1);
  });
  const avgVolumePerHour = mean(Array.from(byHour.values()));

  // Baseline by source
  const bySource = new Map<string, number[]>();
  historicalItems.forEach((item) => {
    const sid = item.sourceId || 'unknown';
    if (!bySource.has(sid)) bySource.set(sid, []);
    bySource.get(sid)!.push(1);
  });
  const avgBySource = new Map(
    Array.from(bySource.entries()).map(([k, v]) => [k, mean(v)])
  );

  // Typical regions
  const regionCounts = new Map<string, number>();
  historicalItems.forEach((i) => {
    const r = i.region || 'unknown';
    regionCounts.set(r, (regionCounts.get(r) || 0) + 1);
  });
  const typicalRegions = Array.from(regionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([r]) => r);

  return {
    avgVolumePerHour,
    avgBySource,
    keywordBaseline: new Map(),
    typicalRegions,
    lastUpdated: Date.now(),
  };
}

// ── Formatting Utilities ───────────────────────────────────────────────────

export function getAnomalyIcon(type: AnomalyType): string {
  const icons: Record<AnomalyType, string> = {
    volume_spike: '📈',
    source_burst: '📰',
    keyword_surge: '🔍',
    contradiction: '⚡',
    geographic_shift: '🌍',
    temporal_cluster: '⏱️',
    market_news_divergence: '📉',
    trust_anomaly: '⚠️',
  };
  return icons[type];
}

export function getSeverityColor(severity: AnomalySeverity): string {
  const colors: Record<AnomalySeverity, string> = {
    info: '#3b82f6',
    warning: '#f59e0b',
    critical: '#ef4444',
  };
  return colors[severity];
}

export function formatConfidence(c: number): string {
  return `${(c * 100).toFixed(0)}%`;
}

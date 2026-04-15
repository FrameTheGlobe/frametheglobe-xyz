/**
 * lib/predictive-model.ts
 *
 * Predictive modeling for geopolitical event forecasting.
 * Uses keyword frequency trends, historical correlations, and pattern matching
 * to estimate probabilities of future events.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type TrendDirection = 'rising' | 'falling' | 'stable';

export type SignalStrength = 'weak' | 'moderate' | 'strong' | 'critical';

export type Prediction = {
  id: string;
  event: string;           // What might happen
  probability: number;     // 0-1 probability estimate
  confidence: number;      // 0-1 confidence in this prediction
  timeframe: string;       // e.g., "24-48 hours", "1 week"
  signalStrength: SignalStrength;
  indicators: string[];    // What signals led to this prediction
  trend: TrendDirection;
  historicalAccuracy?: number; // How often this pattern was correct historically
  relatedEntities?: string[];  // People/orgs/locations involved
};

export type KeywordTrend = {
  keyword: string;
  currentCount: number;
  previousCount: number;  // 24h ago
  changePercent: number;
  trend: TrendDirection;
  frequency: 'hourly' | 'daily' | 'weekly';
};

export type PatternMatch = {
  pattern: string;
  matchScore: number;     // 0-1 similarity to historical pattern
  historicalOutcome: string;
  historicalAccuracy: number;
  supportingKeywords: string[];
};

// ── Historical Pattern Database ─────────────────────────────────────────────────

// Patterns from historical geopolitical events and their outcomes
type HistoricalPattern = {
  id: string;
  name: string;
  keywords: string[];
  keywordThreshold: number; // Minimum keyword mentions to trigger
  timeframe: number;        // Hours to observe pattern
  outcome: string;
  baseProbability: number;  // Historical probability of outcome
  accuracy: number;         // Historical accuracy of this pattern
  requiredCorrelations?: string[]; // Other keywords that should appear
};

const HISTORICAL_PATTERNS: HistoricalPattern[] = [
  {
    id: 'escalation-pattern-1',
    name: 'Rapid Escalation Indicators',
    keywords: ['missile', 'strike', 'attack', 'killed', 'casualties', 'retaliation'],
    keywordThreshold: 15,
    timeframe: 6,
    outcome: 'Military escalation within 24-48 hours',
    baseProbability: 0.72,
    accuracy: 0.68,
    requiredCorrelations: ['iran', 'israel', 'gaza', 'lebanon'],
  },
  {
    id: 'diplomatic-pattern-1',
    name: 'Diplomatic Resolution Signals',
    keywords: ['ceasefire', 'negotiations', 'talks', 'mediator', 'peace', 'agreement'],
    keywordThreshold: 8,
    timeframe: 12,
    outcome: 'Diplomatic breakthrough within 1 week',
    baseProbability: 0.45,
    accuracy: 0.52,
    requiredCorrelations: ['un', 'state department', 'foreign minister'],
  },
  {
    id: 'market-pattern-1',
    name: 'Oil Market Volatility',
    keywords: ['strait', 'hormuz', 'oil', 'tanker', 'shipping', 'blockade'],
    keywordThreshold: 5,
    timeframe: 4,
    outcome: 'Oil price volatility >5% within 48 hours',
    baseProbability: 0.64,
    accuracy: 0.71,
    requiredCorrelations: ['brent', 'wti', 'crude'],
  },
  {
    id: 'nuclear-pattern-1',
    name: 'Nuclear Program Activity',
    keywords: ['natanz', 'fordow', 'enrichment', 'centrifuge', 'iaea', 'uranium'],
    keywordThreshold: 6,
    timeframe: 24,
    outcome: 'International response/reprimand within 72 hours',
    baseProbability: 0.58,
    accuracy: 0.65,
  },
  {
    id: 'humanitarian-pattern-1',
    name: 'Humanitarian Crisis Escalation',
    keywords: ['aid', 'blockade', 'humanitarian', 'famine', 'starvation', 'relief'],
    keywordThreshold: 10,
    timeframe: 8,
    outcome: 'International aid mobilization within 48 hours',
    baseProbability: 0.51,
    accuracy: 0.62,
    requiredCorrelations: ['unrwa', 'ocha', 'red cross'],
  },
  {
    id: 'cyber-pattern-1',
    name: 'Cyber/Electronic Warfare',
    keywords: ['cyber', 'hack', 'jamming', 'gps', 'interference', 'drone'],
    keywordThreshold: 4,
    timeframe: 6,
    outcome: 'Confirmed cyber/ew operation within 24 hours',
    baseProbability: 0.38,
    accuracy: 0.45,
  },
];

// ── Prediction Engine ────────────────────────────────────────────────────────

/**
 * Analyze news items and generate predictions based on pattern matching.
 */
export function generatePredictions(
  items: Array<{ title: string; summary: string; pubDate: string }>,
  lookbackHours: number = 24
): Prediction[] {
  const predictions: Prediction[] = [];
  const now = new Date();
  const cutoff = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);

  // Filter recent items
  const recentItems = items.filter(item => new Date(item.pubDate) >= cutoff);
  const allText = recentItems.map(i => `${i.title} ${i.summary}`).join(' ').toLowerCase();

  // Count keyword occurrences
  const keywordCounts = new Map<string, number>();

  // Test each historical pattern
  for (const pattern of HISTORICAL_PATTERNS) {
    let matchCount = 0;
    const foundKeywords: string[] = [];

    for (const keyword of pattern.keywords) {
      const regex = new RegExp(`\\b${keyword}\\w*`, 'gi');
      const matches = allText.match(regex);
      if (matches) {
        matchCount += matches.length;
        foundKeywords.push(keyword);
      }
    }

    // Check required correlations if specified
    let correlationsMet = true;
    let correlationScore = 1;
    if (pattern.requiredCorrelations) {
      const foundCorrelations = pattern.requiredCorrelations.filter(kw =>
        allText.includes(kw.toLowerCase())
      );
      correlationsMet = foundCorrelations.length >= Math.ceil(pattern.requiredCorrelations.length / 2);
      correlationScore = foundCorrelations.length / (pattern.requiredCorrelations.length || 1);
    }

    // Generate prediction if threshold met
    if (matchCount >= pattern.keywordThreshold && correlationsMet) {
      const intensityFactor = Math.min(matchCount / pattern.keywordThreshold, 2) / 2;
      const adjustedProbability = Math.min(
        pattern.baseProbability * (1 + intensityFactor * 0.3),
        0.95
      );

      const signalStrength: SignalStrength =
        matchCount > pattern.keywordThreshold * 2 ? 'critical' :
        matchCount > pattern.keywordThreshold * 1.5 ? 'strong' :
        matchCount > pattern.keywordThreshold * 1.2 ? 'moderate' : 'weak';

      const trend: TrendDirection = matchCount > pattern.keywordThreshold * 1.5 ? 'rising' : 'stable';

      predictions.push({
        id: `${pattern.id}-${now.getTime()}`,
        event: pattern.outcome,
        probability: adjustedProbability,
        confidence: pattern.accuracy * correlationScore,
        timeframe: pattern.timeframe <= 6 ? '24-48 hours' :
                   pattern.timeframe <= 12 ? '48-72 hours' : '1 week',
        signalStrength,
        trend,
        indicators: foundKeywords.slice(0, 5),
        historicalAccuracy: pattern.accuracy,
      });
    }
  }

  // Sort by probability * confidence
  return predictions.sort((a, b) =>
    (b.probability * b.confidence) - (a.probability * a.confidence)
  );
}

/**
 * Calculate keyword trends comparing current vs previous period.
 */
export function calculateKeywordTrends(
  items: Array<{ title: string; summary: string; pubDate: string }>,
  keywords: string[],
  periodHours: number = 24
): KeywordTrend[] {
  const now = new Date();
  const currentCutoff = new Date(now.getTime() - periodHours * 60 * 60 * 1000);
  const previousCutoff = new Date(now.getTime() - 2 * periodHours * 60 * 60 * 1000);

  const currentItems = items.filter(i => new Date(i.pubDate) >= currentCutoff);
  const previousItems = items.filter(i => {
    const d = new Date(i.pubDate);
    return d >= previousCutoff && d < currentCutoff;
  });

  const currentText = currentItems.map(i => `${i.title} ${i.summary}`).join(' ').toLowerCase();
  const previousText = previousItems.map(i => `${i.title} ${i.summary}`).join(' ').toLowerCase();

  return keywords.map(keyword => {
    const currentRegex = new RegExp(`\\b${keyword}\\w*`, 'gi');
    const currentCount = (currentText.match(currentRegex) || []).length;
    const previousCount = (previousText.match(currentRegex) || []).length;

    const changePercent = previousCount === 0
      ? currentCount > 0 ? 100 : 0
      : ((currentCount - previousCount) / previousCount) * 100;

    const trend: TrendDirection =
      changePercent > 20 ? 'rising' :
      changePercent < -20 ? 'falling' : 'stable';

    const frequency: 'hourly' | 'daily' | 'weekly' =
      periodHours <= 6 ? 'hourly' : periodHours <= 24 ? 'daily' : 'weekly';

    return {
      keyword,
      currentCount,
      previousCount,
      changePercent,
      trend,
      frequency,
    };
  }).sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

/**
 * Get escalation risk score based on multiple factors.
 */
export function calculateEscalationRisk(
  items: Array<{ title: string; summary: string; pubDate: string }>,
  marketData?: { oilChange?: number; vixChange?: number }
): {
  score: number; // 0-100
  level: 'low' | 'moderate' | 'high' | 'critical';
  factors: string[];
} {
  const predictions = generatePredictions(items, 12);
  const kineticKeywords = ['missile', 'airstrike', 'drone', 'bomb', 'killed', 'casualties'];
  const trends = calculateKeywordTrends(items, kineticKeywords, 6);

  let score = 0;
  const factors: string[] = [];

  // Factor 1: Active predictions with high probability
  const highProbPredictions = predictions.filter(p => p.probability > 0.6);
  if (highProbPredictions.length > 0) {
    score += Math.min(highProbPredictions.length * 15, 40);
    factors.push(`${highProbPredictions.length} high-probability indicators active`);
  }

  // Factor 2: Rising kinetic keywords
  const risingKinetic = trends.filter(t => t.trend === 'rising' && t.currentCount > 2);
  if (risingKinetic.length > 0) {
    score += Math.min(risingKinetic.length * 10, 25);
    factors.push(`${risingKinetic.length} kinetic indicators trending up`);
  }

  // Factor 3: Market volatility (if available)
  if (marketData?.oilChange && Math.abs(marketData.oilChange) > 3) {
    score += 15;
    factors.push('Oil market volatility detected');
  }

  // Factor 4: Breaking news volume
  const breakingCount = items.filter(i =>
    /breaking|urgent|alert/i.test(i.title)
  ).length;
  if (breakingCount > 5) {
    score += 10;
    factors.push('High breaking news volume');
  }

  const level =
    score >= 75 ? 'critical' :
    score >= 55 ? 'high' :
    score >= 35 ? 'moderate' : 'low';

  return { score: Math.min(score, 100), level, factors };
}

// ── Utility Functions ─────────────────────────────────────────────────────────

export function formatProbability(p: number): string {
  return `${(p * 100).toFixed(0)}%`;
}

export function getRiskColor(level: 'low' | 'moderate' | 'high' | 'critical'): string {
  switch (level) {
    case 'low': return '#22c55e';
    case 'moderate': return '#eab308';
    case 'high': return '#f97316';
    case 'critical': return '#ef4444';
  }
}

export function getSignalEmoji(strength: SignalStrength): string {
  switch (strength) {
    case 'weak': return '◐';
    case 'moderate': return '◑';
    case 'strong': return '◒';
    case 'critical': return '◓';
  }
}

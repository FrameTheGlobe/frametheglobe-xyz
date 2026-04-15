'use client';

import { useMemo } from 'react';
import {
  generatePredictions,
  calculateKeywordTrends,
  calculateEscalationRisk,
  formatProbability,
  getRiskColor,
  getSignalEmoji,
  type Prediction,
  type KeywordTrend,
} from '@/lib/predictive-model';

const mono = 'var(--font-mono)';

const WATCH_KEYWORDS = [
  'missile', 'airstrike', 'drone', 'strike', 'attack', 'casualties',
  'ceasefire', 'negotiations', 'oil', 'hormuz', 'natanz', 'enrichment',
  'cyber', 'humanitarian', 'aid', 'blockade',
];

function PredictionCard({ prediction }: { prediction: Prediction }) {
  const signalColor =
    prediction.signalStrength === 'critical' ? '#ef4444' :
    prediction.signalStrength === 'strong' ? '#f97316' :
    prediction.signalStrength === 'moderate' ? '#eab308' : '#64748b';

  return (
    <div style={{
      padding: '12px 14px',
      border: '1px solid var(--border-light)',
      borderRadius: 6,
      background: 'var(--surface)',
      marginBottom: 8,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: signalColor,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {getSignalEmoji(prediction.signalStrength)} {prediction.signalStrength}
        </span>
        <span style={{
          fontSize: 10,
          color: 'var(--text-muted)',
        }}>
          {prediction.timeframe}
        </span>
      </div>

      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 8,
        lineHeight: 1.4,
      }}>
        {prediction.event}
      </div>

      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 8,
      }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Probability
          </div>
          <div style={{
            fontSize: 16,
            fontWeight: 800,
            color: prediction.probability > 0.7 ? '#ef4444' : prediction.probability > 0.5 ? '#f97316' : '#3b82f6',
          }}>
            {formatProbability(prediction.probability)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Confidence
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatProbability(prediction.confidence)}
          </div>
        </div>
        {prediction.historicalAccuracy && (
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Historical
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>
              {formatProbability(prediction.historicalAccuracy)}
            </div>
          </div>
        )}
      </div>

      {prediction.indicators.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          fontSize: 9,
        }}>
          <span style={{ color: 'var(--text-muted)' }}>Signals:</span>
          {prediction.indicators.map((ind, i) => (
            <span key={i} style={{
              background: 'var(--surface-muted)',
              padding: '2px 6px',
              borderRadius: 3,
              color: 'var(--text-secondary)',
            }}>
              {ind}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TrendRow({ trend }: { trend: KeywordTrend }) {
  const color = trend.trend === 'rising' ? '#22c55e' :
                trend.trend === 'falling' ? '#ef4444' : '#64748b';
  const arrow = trend.trend === 'rising' ? '↑' :
                trend.trend === 'falling' ? '↓' : '→';

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '6px 0',
      borderBottom: '1px solid var(--border-light)',
      fontSize: 11,
    }}>
      <span style={{ textTransform: 'capitalize' }}>{trend.keyword}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color, fontWeight: 700 }}>
          {arrow} {Math.abs(trend.changePercent).toFixed(0)}%
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
          {trend.currentCount} / {trend.previousCount}
        </span>
      </div>
    </div>
  );
}

function RiskMeter({ score, level, factors }: { score: number; level: 'low' | 'moderate' | 'high' | 'critical'; factors: string[] }) {
  const color = getRiskColor(level);

  return (
    <div style={{
      padding: '14px',
      border: `2px solid ${color}`,
      borderRadius: 8,
      background: `${color}10`,
      marginBottom: 16,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color,
        }}>
          Escalation Risk: {level}
        </span>
        <span style={{
          fontSize: 24,
          fontWeight: 800,
          color,
        }}>
          {score}
        </span>
      </div>

      {/* Risk bar */}
      <div style={{
        height: 6,
        background: 'var(--border-light)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 12,
      }}>
        <div style={{
          width: `${score}%`,
          height: '100%',
          background: color,
          borderRadius: 3,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {factors.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
          <div style={{ marginBottom: 4, color: 'var(--text-muted)' }}>Contributing factors:</div>
          {factors.map((f, i) => (
            <div key={i} style={{ marginLeft: 8, marginBottom: 2 }}>• {f}</div>
          ))}
        </div>
      )}
    </div>
  );
}

type Props = {
  items: Array<{ title: string; summary: string; pubDate: string }>;
  marketData?: { oilChange?: number; vixChange?: number };
};

export default function PredictivePanel({ items, marketData }: Props) {
  const predictions = useMemo(() => generatePredictions(items, 12), [items]);
  const trends = useMemo(() => calculateKeywordTrends(items, WATCH_KEYWORDS, 6), [items]);
  const risk = useMemo(() => calculateEscalationRisk(items, marketData), [items, marketData]);

  const topPredictions = predictions.slice(0, 5);
  const topTrends = trends.slice(0, 10);

  return (
    <div style={{ fontFamily: mono, fontSize: 12 }}>
      {/* Header */}
      <div style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.05em',
        color: 'var(--accent)',
        textTransform: 'uppercase',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '1px solid var(--border-light)',
      }}>
        Predictive Intelligence
      </div>

      {/* Risk Meter */}
      <RiskMeter score={risk.score} level={risk.level} factors={risk.factors} />

      {/* Predictions */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}>
          Active Predictions ({predictions.length})
        </div>
        {topPredictions.length === 0 ? (
          <div style={{
            padding: '16px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 12,
          }}>
            No strong predictive signals detected.
            <br />
            <span style={{ fontSize: 10 }}>Pattern matching against historical data...</span>
          </div>
        ) : (
          topPredictions.map(p => <PredictionCard key={p.id} prediction={p} />)
        )}
      </div>

      {/* Keyword Trends */}
      <div>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}>
          Keyword Trends (6h)
        </div>
        <div style={{
          border: '1px solid var(--border-light)',
          borderRadius: 6,
          padding: '8px 12px',
          background: 'var(--surface)',
        }}>
          {topTrends.map(t => <TrendRow key={t.keyword} trend={t} />)}
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{
        marginTop: 16,
        padding: '10px 12px',
        background: 'var(--surface-muted)',
        borderRadius: 4,
        fontSize: 9,
        color: 'var(--text-muted)',
        lineHeight: 1.5,
      }}>
        <strong>Disclaimer:</strong> Predictions are based on keyword pattern matching against
        historical events. They represent statistical probabilities, not certainties.
        Always verify with primary sources.
      </div>
    </div>
  );
}

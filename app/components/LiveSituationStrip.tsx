'use client';

import {
  LIVE_SITUATION_METRICS,
  liveSituationLatestAsOf,
  situationMetricBasisLabel,
  type LiveSituationMetric,
} from '@/lib/live-situation-metrics';
import { useState, useEffect } from 'react';

const mono = 'var(--font-mono)';

const REGION_CLASS: Record<LiveSituationMetric['regionCode'], string> = {
  gaza: 'ftg-live-metric--gaza',
  lebanon: 'ftg-live-metric--lebanon',
  west_bank: 'ftg-live-metric--wb',
  regional: 'ftg-live-metric--regional',
};

function formatAsOfShort(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function MetricCard({
  m,
  dense,
  loading,
}: {
  m: LiveSituationMetric;
  dense: boolean;
  loading: boolean;
}) {
  const showValue = m.valueDisplay != null && m.valueDisplay !== '';

  return (
    <a
      href={m.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`ftg-live-metric-card ${REGION_CLASS[m.regionCode]}`}
      aria-label={`${m.regionLabel}: ${m.metricLabel}. Open ${m.sourceName}.`}
    >
      {/* Region label */}
      <div
        className="ftg-live-metric-card__region"
        style={{
          fontFamily: mono,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 6,
        }}
      >
        {m.regionLabel}
      </div>

      {/* Value */}
      <div
        className="ftg-live-metric-card__value"
        style={{
          fontFamily: mono,
          fontSize: dense ? 24 : 30,
          fontWeight: 900,
          letterSpacing: '-0.03em',
          color: 'var(--text-primary)',
          lineHeight: 1,
          marginBottom: 4,
          opacity: loading ? 0.45 : 1,
          transition: 'opacity 0.3s ease',
        }}
      >
        {loading ? '···' : showValue ? m.valueDisplay : '—'}
      </div>

      {/* Qualifier */}
      {m.valueQualifier && !loading && (
        <div
          style={{
            fontFamily: mono,
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            marginBottom: 4,
          }}
        >
          {m.valueQualifier}
        </div>
      )}

      {/* Metric label */}
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: dense ? 12 : 13,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: 6,
          lineHeight: 1.4,
        }}
      >
        {m.metricLabel}
      </div>

      {/* Since label */}
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          lineHeight: 1.4,
          marginBottom: 10,
        }}
      >
        {m.sinceLabel}
      </div>

      {/* Source + basis */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          marginTop: 'auto',
        }}
      >
        <span
          style={{
            fontFamily: mono,
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '2px 7px',
            borderRadius: 4,
            background: 'var(--accent-light)',
            color: 'var(--accent)',
          }}
        >
          {situationMetricBasisLabel(m.basis)}
        </span>
        <span
          style={{
            fontFamily: mono,
            fontSize: 9,
            color: 'var(--accent)',
            fontWeight: 700,
          }}
        >
          {m.sourceName} →
        </span>
      </div>

      {/* Caveat (comfortable mode only) */}
      {!dense && m.caveat ? (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 11,
            lineHeight: 1.45,
            color: 'var(--text-muted)',
            borderTop: '1px solid var(--border-light)',
            paddingTop: 8,
          }}
        >
          {m.caveat}
        </p>
      ) : null}

      {/* Sync date */}
      <div
        style={{
          fontFamily: mono,
          fontSize: 8,
          color: 'var(--text-muted)',
          marginTop: dense ? 6 : 8,
          letterSpacing: '0.04em',
        }}
      >
        Editor sync {formatAsOfShort(m.asOf)}
      </div>
    </a>
  );
}

export function LiveSituationStrip({
  density,
  layout = 'scroll',
}: {
  density: 'compact' | 'comfortable';
  layout?: 'scroll' | 'grid';
}) {
  const [metrics, setMetrics] = useState<LiveSituationMetric[]>(LIVE_SITUATION_METRICS);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/live-metrics');
        if (!res.ok) throw new Error('Failed to fetch live metrics');
        const data = await res.json();
        if (mounted && data?.metrics && Array.isArray(data.metrics)) {
          setMetrics((prev) =>
            prev.map((m) => {
              const live = data.metrics.find((x: LiveSituationMetric) => x.id === m.id);
              if (live) {
                return { ...m, ...live };
              }
              return m;
            })
          );
        }
      } catch (err) {
        console.error('[LiveSituationStrip] Fetch error:', err);
      } finally {
        if (mounted) setFetching(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const latest = liveSituationLatestAsOf(metrics);
  const dense = density === 'compact';

  return (
    <section
      className="ftg-live-situation"
      aria-labelledby="ftg-live-situation-heading"
    >
      <div className="ftg-live-situation__head">
        <h3
          id="ftg-live-situation-heading"
          className="ftg-live-situation__title"
        >
          Live situation
        </h3>
        {latest ? (
          <span className="ftg-live-situation__meta">
            Rows synced {formatAsOfShort(latest)}
          </span>
        ) : null}
      </div>
      <div
        className={
          layout === 'grid'
            ? 'ftg-live-situation__grid'
            : `ftg-live-situation__scroller${dense ? ' ftg-live-situation__scroller--compact' : ' ftg-live-situation__scroller--comfortable'}`
        }
      >
        {metrics.map((m) => (
          <MetricCard key={m.id} m={m} dense={dense} loading={fetching} />
        ))}
      </div>
    </section>
  );
}

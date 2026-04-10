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
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function MetricCard({
  m,
  dense,
  loading,
  showCaveat,
}: {
  m: LiveSituationMetric;
  dense: boolean;
  loading: boolean;
  showCaveat: boolean;
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
      <div className="ftg-live-metric-card__region">
        {m.regionLabel}
      </div>

      {/* Value — the hero number */}
      <div
        className="ftg-live-metric-card__value"
        style={{ opacity: loading ? 0.35 : 1, transition: 'opacity 0.4s ease' }}
      >
        {loading ? '···' : showValue ? m.valueDisplay : '—'}
      </div>

      {/* Qualifier badge (if any) */}
      {m.valueQualifier && !loading && (
        <div className="ftg-live-metric-card__qualifier">
          {m.valueQualifier}
        </div>
      )}

      {/* Metric label */}
      <div className="ftg-live-metric-card__label">
        {m.metricLabel}
      </div>

      {/* Since label */}
      <div className="ftg-live-metric-card__since">
        {m.sinceLabel}
      </div>

      {/* Source + basis badges */}
      <div className="ftg-live-metric-card__footer">
        <span className="ftg-live-metric-card__basis">
          {situationMetricBasisLabel(m.basis)}
        </span>
        <span className="ftg-live-metric-card__source">
          {m.sourceName} →
        </span>
      </div>

      {/* Caveat — only in full page mode */}
      {showCaveat && m.caveat && (
        <p className="ftg-live-metric-card__caveat">
          {m.caveat}
        </p>
      )}

      {/* Sync date */}
      <div className="ftg-live-metric-card__sync">
        Editor sync {formatAsOfShort(m.asOf)}
      </div>
    </a>
  );
}

export function LiveSituationStrip({
  density,
  layout = 'scroll',
  panelMode = false,
}: {
  density: 'compact' | 'comfortable';
  layout?: 'scroll' | 'grid';
  /** When true, suppresses caveats and the section heading (caller provides its own) */
  panelMode?: boolean;
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
              return live ? { ...m, ...live } : m;
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
      {/* Section heading — only rendered when not in panel mode (full page) */}
      {!panelMode && (
        <div className="ftg-live-situation__head">
          <h3 id="ftg-live-situation-heading" className="ftg-live-situation__title">
            Live situation
          </h3>
          {latest ? (
            <span className="ftg-live-situation__meta">
              Rows synced {formatAsOfShort(latest)}
            </span>
          ) : null}
        </div>
      )}
      {/* Hidden heading for accessibility when panelMode */}
      {panelMode && (
        <h3 id="ftg-live-situation-heading" className="sr-only">
          Live situation metrics
        </h3>
      )}
      <div
        className={
          layout === 'grid'
            ? 'ftg-live-situation__grid'
            : `ftg-live-situation__scroller${dense ? ' ftg-live-situation__scroller--compact' : ' ftg-live-situation__scroller--comfortable'}`
        }
      >
        {metrics.map((m) => (
          <MetricCard
            key={m.id}
            m={m}
            dense={dense}
            loading={fetching}
            showCaveat={!panelMode}
          />
        ))}
      </div>
    </section>
  );
}

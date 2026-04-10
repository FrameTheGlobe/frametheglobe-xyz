'use client';

import {
  LIVE_SITUATION_METRICS,
  liveSituationLatestAsOf,
  situationMetricBasisLabel,
  type LiveSituationMetric,
} from '@/lib/live-situation-metrics';

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
}: {
  m: LiveSituationMetric;
  dense: boolean;
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
      <div
        className="ftg-live-metric-card__region"
        style={{
          fontFamily: mono,
          fontSize: dense ? 9 : 10,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 4,
        }}
      >
        {m.regionLabel}
      </div>
      <div
        className="ftg-live-metric-card__value"
        style={{
          fontFamily: mono,
          fontSize: dense ? 20 : 24,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
          lineHeight: 1.1,
          marginBottom: 4,
        }}
      >
        {showValue ? m.valueDisplay : '—'}
      </div>
      <div
        style={{
          fontFamily: mono,
          fontSize: dense ? 9 : 10,
          fontWeight: 700,
          color: 'var(--text-secondary)',
          marginBottom: 6,
          lineHeight: 1.35,
        }}
      >
        {m.metricLabel}
        {m.valueQualifier ? (
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
            {' '}
            · {m.valueQualifier}
          </span>
        ) : null}
      </div>
      <div
        style={{
          fontSize: dense ? 10 : 11,
          color: 'var(--text-muted)',
          lineHeight: 1.4,
          marginBottom: 8,
        }}
      >
        {m.sinceLabel}
      </div>
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
  const latest = liveSituationLatestAsOf(LIVE_SITUATION_METRICS);
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
      <p
        className="ftg-live-situation__blurb"
        style={{
          margin: '0 0 10px',
          fontSize: dense ? 10 : 11,
          lineHeight: 1.45,
          color: 'var(--text-secondary)',
        }}
      >
        Editorial counters —{' '}
        <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          add verified figures
        </strong>{' '}
        in <code style={{ fontSize: '0.9em' }}>lib/live-situation-metrics.ts</code>
        . Until then, each card links to the primary source.
      </p>
      <div
        className={
          layout === 'grid'
            ? 'ftg-live-situation__grid'
            : `ftg-live-situation__scroller${dense ? ' ftg-live-situation__scroller--compact' : ' ftg-live-situation__scroller--comfortable'}`
        }
      >
        {LIVE_SITUATION_METRICS.map((m) => (
          <MetricCard key={m.id} m={m} dense={dense} />
        ))}
      </div>
    </section>
  );
}

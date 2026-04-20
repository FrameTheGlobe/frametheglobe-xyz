'use client';

/**
 * WarPremiumBoard — full expanded board for the War Premium Board.
 *
 * Renders all editorial rows from `lib/war-baselines.ts`, grouped by asset
 * class, with:
 *   - current price (live-overlaid when possible)
 *   - dual delta: SINCE WAR (primary, hero) and SINCE BASELINE (context)
 *   - sparkline timeline from 2025-11-28 → today with a red dashed tick at
 *     the war-start date (2026-02-28)
 *   - cited source URLs for baseline, war-start, and current readings
 *
 * Used both inline inside `WarPremiumCompact` and (in future) on a
 * standalone `/war-premium` page.
 */

import { useMemo, useState } from 'react';
import {
  WAR_ANCHOR,
  WAR_BASELINES,
  ASSET_CLASS_LABELS,
  percentChange,
  absoluteChange,
  formatPrice,
  formatSignedPct,
  formatSignedAbs,
  deltaColor,
  type AssetClassFilter,
  type WarBaselineRow,
} from '@/lib/war-baselines';

type Props = {
  livePrices?: Record<string, number>;
  liveRows?: Record<
    string,
    Partial<
      Pick<
        WarBaselineRow,
        | 'priceBaseline'
        | 'baselineDate'
        | 'priceAtWarStart'
        | 'warStartDate'
        | 'priceCurrent'
        | 'currentAsOf'
        | 'sparkline'
      >
    >
  >;
};

// ── Full timeline sparkline with war-start tick + dot markers ─────────────────
function TimelineSparkline({
  row,
  current,
  width = 180,
  height = 44,
}: {
  row: WarBaselineRow;
  current: number;
  width?: number;
  height?: number;
}) {
  // Build series: static sparkline points, with last point overridden to `current`
  const pts = row.sparkline.map((p, i, arr) =>
    i === arr.length - 1 ? { ...p, v: current } : p,
  );
  if (pts.length < 2) return null;

  const vs = pts.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const range = max - min || 1;

  const padY = 4;
  const innerH = height - padY * 2;

  const xs = pts.map((_, i) => (i / (pts.length - 1)) * width);
  const ys = pts.map((p) => padY + (innerH - ((p.v - min) / range) * innerH));

  const d = pts
    .map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i].toFixed(1)},${ys[i].toFixed(1)}`)
    .join(' ');

  // Filled area under the line (subtle)
  const areaD = `${d} L ${xs[pts.length - 1].toFixed(1)},${height} L ${xs[0].toFixed(1)},${height} Z`;

  // Find war-start index (first point on or after war start)
  const warStart = WAR_ANCHOR.warStart;
  let warIdx = -1;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].t >= warStart) { warIdx = i; break; }
  }

  const color = deltaColor(row, row.priceAtWarStart, current);

  return (
    <svg width={width} height={height} style={{ display: 'block' }} aria-hidden>
      <path d={areaD} fill={color} opacity={0.08} />
      {warIdx > 0 && (
        <>
          <line
            x1={xs[warIdx]}
            x2={xs[warIdx]}
            y1={0}
            y2={height}
            stroke="var(--neon-red)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.7}
          />
          <circle
            cx={xs[warIdx]}
            cy={ys[warIdx]}
            r={2.5}
            fill="var(--neon-red)"
          />
        </>
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={xs[pts.length - 1]}
        cy={ys[pts.length - 1]}
        r={2.5}
        fill={color}
      />
    </svg>
  );
}

// ── Single row card ───────────────────────────────────────────────────────────
function BoardRow({
  row,
  current,
}: {
  row: WarBaselineRow;
  current: number;
}) {
  const [open, setOpen] = useState(false);

  const pctSinceWar = percentChange(row.priceAtWarStart, current);
  const absSinceWar = absoluteChange(row.priceAtWarStart, current);
  const pctSinceBase = percentChange(row.priceBaseline, current);

  const warColor = deltaColor(row, row.priceAtWarStart, current);
  const baseColor = deltaColor(row, row.priceBaseline, current);

  const currency = row.unit === 'USD' || row.unit.startsWith('USD/') ? '$' : '';

  return (
    <div className={`ftg-wpb-row${open ? ' ftg-wpb-row--open' : ''}`}>
      <button
        type="button"
        className="ftg-wpb-row__summary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {/* Label column */}
        <div className="ftg-wpb-row__label-col">
          <div className="ftg-wpb-row__label">{row.label}</div>
          {row.sublabel && (
            <div className="ftg-wpb-row__sublabel">{row.sublabel}</div>
          )}
          <div className="ftg-wpb-row__unit">{row.unit}</div>
        </div>

        {/* Current price + deltas column */}
        <div className="ftg-wpb-row__value-col">
          <div className="ftg-wpb-row__current">
            {currency}{formatPrice(current, row.unit)}
          </div>
          <div className="ftg-wpb-row__delta-primary" style={{ color: warColor }}>
            {formatSignedPct(pctSinceWar)}{' '}
            <span className="ftg-wpb-row__delta-abs">
              ({formatSignedAbs(absSinceWar, row.unit)})
            </span>
          </div>
          <div className="ftg-wpb-row__delta-secondary" style={{ color: baseColor }}>
            vs baseline {formatSignedPct(pctSinceBase)}
          </div>
        </div>

        {/* Timeline sparkline column */}
        <div className="ftg-wpb-row__spark-col">
          <TimelineSparkline row={row} current={current} />
          <div className="ftg-wpb-row__spark-legend">
            <span>{row.baselineDate}</span>
            <span className="ftg-wpb-row__spark-war">War</span>
            <span>{row.currentAsOf}</span>
          </div>
        </div>
      </button>

      {open && (
        <div className="ftg-wpb-row__detail">
          <div className="ftg-wpb-row__detail-grid">
            <div>
              <div className="ftg-wpb-row__detail-label">Baseline · {row.baselineDate}</div>
              <div className="ftg-wpb-row__detail-value">
                {currency}{formatPrice(row.priceBaseline, row.unit)}
              </div>
              <a
                href={row.baselineSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ftg-wpb-row__detail-source"
              >
                {row.baselineSourceName} →
              </a>
            </div>
            <div>
              <div className="ftg-wpb-row__detail-label">War start · {row.warStartDate}</div>
              <div className="ftg-wpb-row__detail-value">
                {currency}{formatPrice(row.priceAtWarStart, row.unit)}
              </div>
              <a
                href={row.warStartSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ftg-wpb-row__detail-source"
              >
                {row.warStartSourceName} →
              </a>
            </div>
            <div>
              <div className="ftg-wpb-row__detail-label">Current · {row.currentAsOf}</div>
              <div className="ftg-wpb-row__detail-value">
                {currency}{formatPrice(current, row.unit)}
              </div>
              <a
                href={row.currentSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ftg-wpb-row__detail-source"
              >
                {row.currentSourceName} →
              </a>
            </div>
          </div>
          {row.note && (
            <p className="ftg-wpb-row__note">
              <strong>Note</strong> · {row.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main board ────────────────────────────────────────────────────────────────
export default function WarPremiumBoard({ livePrices = {}, liveRows = {} }: Props) {
  const [filter, setFilter] = useState<AssetClassFilter>('all');

  const rows = useMemo(() => {
    if (filter === 'all') return WAR_BASELINES;
    return WAR_BASELINES.filter((r) => r.assetClass === filter);
  }, [filter]);

  const filterIds: AssetClassFilter[] = ['all', 'energy', 'metals', 'agri', 'household', 'inflation'];

  return (
    <div className="ftg-wpb">
      {/* Filter row */}
      <div className="ftg-wpb__filters" role="tablist" aria-label="Asset class filter">
        {filterIds.map((id) => {
          const active = filter === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(id)}
              className={`ftg-wpb__filter${active ? ' ftg-wpb__filter--active' : ''}`}
            >
              {ASSET_CLASS_LABELS[id]}
            </button>
          );
        })}
      </div>

      {/* Rows */}
      <div className="ftg-wpb__rows">
        {rows.map((row) => {
          const merged = { ...row, ...(liveRows[row.id] ?? {}) } as WarBaselineRow;
          const current = livePrices[row.id] ?? merged.priceCurrent;
          return <BoardRow key={row.id} row={merged} current={current} />;
        })}
      </div>

      {/* Methodology footer */}
      <div className="ftg-wpb__footer">
        <p>
          <strong>Anchor</strong> · Iran war kinetic phase began <strong>{WAR_ANCHOR.warStart}</strong>.
          Baseline comparisons use prices from <strong>{WAR_ANCHOR.baseline}</strong> (T−3 months).
        </p>
        <p>
          <strong>Methodology</strong> · Each row cites its baseline, war-start, and current reading
          with a primary source. Household and inflation rows settle weekly (EIA) or monthly (BLS, FAO) —
          their &ldquo;current&rdquo; values reflect the most recent release, not real-time pricing.
          Commodity rows overlay live prices where a live feed is available; baseline, war-start,
          current, and sparkline values are hydrated from backend history feeds when available.
        </p>
      </div>
    </div>
  );
}

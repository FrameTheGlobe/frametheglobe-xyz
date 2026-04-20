'use client';

/**
 * WarPremiumCompact — sidebar hero card for the War Premium Board.
 *
 * Mounts in the left sidebar directly under SidebarTheaterPulse. Shows three
 * spotlighted rows (Brent · US Gasoline · FAO Food Index) with live-overlaid
 * current prices for the commodity row. A "View full board" action toggles
 * the expanded `WarPremiumBoard` inline below this card.
 *
 * Data source: `lib/war-baselines.ts` (editorial static) + `/api/market`,
 * `/api/precious-metals`, `/api/agri-market` overlay for the commodity rows.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useVisibilityPolling } from '@/lib/use-visibility-polling';
import {
  WAR_ANCHOR,
  WAR_BASELINES,
  HERO_ROW_IDS,
  percentChange,
  formatPrice,
  formatSignedPct,
  deltaColor,
  type WarBaselineRow,
} from '@/lib/war-baselines';
import WarPremiumBoard from './WarPremiumBoard';

type LivePrice = {
  symbol: string;
  price: number;
  change?: number;
  changePercent?: number;
};
type LiveRowPatch = {
  id: string;
  priceBaseline: number;
  baselineDate: string;
  priceAtWarStart: number;
  warStartDate: string;
  priceCurrent: number;
  currentAsOf: string;
  sparkline: Array<{ t: string; v: number }>;
};

const HERO_ROWS: WarBaselineRow[] = HERO_ROW_IDS.map(
  (id) => WAR_BASELINES.find((r) => r.id === id)!,
);

/** Tiny sparkline that also renders a vertical tick for the war-start date */
function MiniSparkline({
  row,
  width = 56,
  height = 18,
}: {
  row: WarBaselineRow;
  width?: number;
  height?: number;
}) {
  const pts = row.sparkline;
  if (pts.length < 2) return null;

  const vs = pts.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const range = max - min || 1;

  // Build path
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * width);
  const ys = pts.map((p) => height - ((p.v - min) / range) * height);
  const d = pts
    .map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i].toFixed(1)},${ys[i].toFixed(1)}`)
    .join(' ');

  // Find index of war-start date (closest on-or-before)
  const warStart = WAR_ANCHOR.warStart;
  let warIdx = -1;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].t >= warStart) { warIdx = i; break; }
  }

  const color = deltaColor(row, row.priceBaseline, row.priceCurrent);

  return (
    <svg width={width} height={height} style={{ display: 'block', flexShrink: 0 }} aria-hidden>
      {warIdx > 0 && (
        <line
          x1={xs[warIdx]}
          x2={xs[warIdx]}
          y1={0}
          y2={height}
          stroke="var(--neon-red)"
          strokeWidth={1}
          strokeDasharray="2 2"
          opacity={0.55}
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function WarPremiumCompact() {
  const [expanded, setExpanded] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [liveRows, setLiveRows] = useState<Record<string, LiveRowPatch>>({});

  // Live-price overlay. The function is stable (no deps) and shared between
  // the initial mount effect and the visibility-aware poll. We hit each
  // backend endpoint once, not per row, and merge symbol matches into state.
  const fetchLive = useCallback(async () => {
    const endpoints = new Set<string>();
    for (const row of HERO_ROWS) if (row.liveApi) endpoints.add(row.liveApi);

    const updates: Record<string, number> = {};
    await Promise.all(
      Array.from(endpoints).map(async (endpoint) => {
        try {
          const res = await fetch(endpoint);
          if (!res.ok) return;
          const data: LivePrice[] = await res.json();
          if (!Array.isArray(data)) return;
          for (const row of HERO_ROWS) {
            if (row.liveApi !== endpoint || !row.symbol) continue;
            const match = data.find(
              (d) => d.symbol?.toUpperCase() === row.symbol!.toUpperCase(),
            );
            if (match && Number.isFinite(match.price) && match.price > 0) {
              updates[row.id] = match.price;
            }
          }
        } catch {
          /* network errors fall back to static priceCurrent */
        }
      }),
    );
    if (Object.keys(updates).length) {
      setLivePrices((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  const fetchLiveRows = useCallback(async () => {
    const endpoints = ['/api/since-war-history', '/api/household-prices'];
    const merged: Record<string, LiveRowPatch> = {};
    await Promise.all(
      endpoints.map(async (endpoint) => {
        try {
          const res = await fetch(endpoint);
          if (!res.ok) return;
          const payload = await res.json();
          const rows = Array.isArray(payload?.rows) ? payload.rows : [];
          for (const row of rows) {
            if (!row?.id || !Array.isArray(row.sparkline)) continue;
            merged[row.id] = {
              id: row.id,
              priceBaseline: Number(row.priceBaseline),
              baselineDate: String(row.baselineDate),
              priceAtWarStart: Number(row.priceAtWarStart),
              warStartDate: String(row.warStartDate),
              priceCurrent: Number(row.priceCurrent),
              currentAsOf: String(row.currentAsOf),
              sparkline: row.sparkline
                .filter((p: { t?: unknown; v?: unknown }) => typeof p?.t === 'string' && Number.isFinite(Number(p?.v)))
                .map((p: { t: string; v: number }) => ({ t: p.t, v: Number(p.v) })),
            };
          }
        } catch {
          /* fallback to seeded baseline rows */
        }
      }),
    );
    if (Object.keys(merged).length) {
      setLiveRows(merged);
    }
  }, []);

  // Initial mount fetch — async IIFE so setState happens off the effect body
  // (same pattern as LiveSituationStrip).
  useEffect(() => {
    let mounted = true;
    (async () => {
      try { await fetchLive(); } catch { /* ignore */ }
      try { await fetchLiveRows(); } catch { /* ignore */ }
      if (!mounted) return;
    })();
    return () => { mounted = false; };
  }, [fetchLive, fetchLiveRows]);

  // Refresh every 3 min when tab is visible — cheap, matches IranOilBoard cadence
  useVisibilityPolling(fetchLive, 3 * 60 * 1000);
  useVisibilityPolling(fetchLiveRows, 10 * 60 * 1000);

  const heroMetrics = useMemo(
    () => HERO_ROWS.map((row) => {
      const patch = liveRows[row.id];
      const warStart = patch?.priceAtWarStart ?? row.priceAtWarStart;
      const current = livePrices[row.id] ?? patch?.priceCurrent ?? row.priceCurrent;
      const pctSinceWar = percentChange(warStart, current);
      return { row: { ...row, ...patch }, current, pctSinceWar, warStart };
    }),
    [livePrices, liveRows],
  );

  return (
    <div className="ftg-war-premium">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="ftg-war-premium__head">
        <div className="ftg-war-premium__head-left">
          <span className="ftg-war-premium__title">WAR PREMIUM BOARD</span>
          <span className="ftg-war-premium__anchor-badge" title={`Iran war kinetic phase began ${WAR_ANCHOR.warStart}`}>
            Since 28 Feb
          </span>
        </div>
        <div className="ftg-war-premium__sub">
          Markets & households since Iran war
        </div>
      </div>

      {/* ── Hero rows ────────────────────────────────────────────────────── */}
      <div className="ftg-war-premium__rows">
        {heroMetrics.map(({ row, current, pctSinceWar, warStart }) => {
          const color = deltaColor(row, warStart, current);
          return (
            <div key={row.id} className="ftg-war-premium__row">
              <div className="ftg-war-premium__row-main">
                <span className="ftg-war-premium__row-label" title={row.sublabel}>
                  {row.label}
                </span>
                <span className="ftg-war-premium__row-value">
                  {row.unit.startsWith('USD') || row.unit === 'USD' ? '$' : ''}
                  {formatPrice(current, row.unit)}
                </span>
                <span
                  className="ftg-war-premium__row-delta"
                  style={{ color }}
                >
                  {formatSignedPct(pctSinceWar)}
                </span>
              </div>
              <MiniSparkline row={row} />
            </div>
          );
        })}
      </div>

      {/* ── Toggle ───────────────────────────────────────────────────────── */}
      <button
        type="button"
        className="ftg-war-premium__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="ftg-war-premium-board"
      >
        {expanded ? 'Hide full board ▴' : 'View full board →'}
      </button>

      {/* ── Expanded full board ─────────────────────────────────────────── */}
      {expanded && (
        <div id="ftg-war-premium-board" className="ftg-war-premium__expanded">
          <WarPremiumBoard livePrices={livePrices} liveRows={liveRows} />
        </div>
      )}
    </div>
  );
}

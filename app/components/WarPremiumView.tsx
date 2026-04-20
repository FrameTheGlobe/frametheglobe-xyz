'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import WarPremiumBoard from './WarPremiumBoard';
import {
  HERO_ROW_IDS,
  WAR_BASELINES,
  percentChange,
  formatPrice,
  formatSignedPct,
  deltaColor,
  type WarBaselineRow,
} from '@/lib/war-baselines';
import { useVisibilityPolling } from '@/lib/use-visibility-polling';

type LivePrice = {
  symbol: string;
  price: number;
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

export default function WarPremiumView() {
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [liveRows, setLiveRows] = useState<Record<string, LiveRowPatch>>({});

  const fetchLive = useCallback(async () => {
    const endpoints = new Set<string>();
    for (const row of WAR_BASELINES) if (row.liveApi) endpoints.add(row.liveApi);

    const updates: Record<string, number> = {};
    await Promise.all(
      Array.from(endpoints).map(async (endpoint) => {
        try {
          const res = await fetch(endpoint);
          if (!res.ok) return;
          const data: LivePrice[] = await res.json();
          if (!Array.isArray(data)) return;
          for (const row of WAR_BASELINES) {
            if (row.liveApi !== endpoint || !row.symbol) continue;
            const match = data.find((d) => d.symbol?.toUpperCase() === row.symbol!.toUpperCase());
            if (match && Number.isFinite(match.price) && match.price > 0) {
              updates[row.id] = match.price;
            }
          }
        } catch {
          /* fallback to seeded data */
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
          /* fallback to seeded data */
        }
      }),
    );
    if (Object.keys(merged).length) {
      setLiveRows(merged);
    }
  }, []);

  useEffect(() => {
    void fetchLive();
    void fetchLiveRows();
  }, [fetchLive, fetchLiveRows]);

  useVisibilityPolling(fetchLive, 3 * 60 * 1000);
  useVisibilityPolling(fetchLiveRows, 10 * 60 * 1000);

  const heroMetrics = useMemo(
    () => HERO_ROWS.map((row) => {
      const patch = liveRows[row.id];
      const warStart = patch?.priceAtWarStart ?? row.priceAtWarStart;
      const current = livePrices[row.id] ?? patch?.priceCurrent ?? row.priceCurrent;
      return { row: { ...row, ...patch }, current, delta: percentChange(warStart, current), warStart };
    }),
    [livePrices, liveRows],
  );

  return (
    <section className="ftg-war-premium-view">
      <div className="ftg-war-premium-view__hero">
        <div>
          <h2 className="ftg-war-premium-view__title">War Premium Dashboard</h2>
          <p className="ftg-war-premium-view__sub">
            Real-time transmission from war shock to energy, food, and household stress.
          </p>
        </div>
        <div className="ftg-war-premium-view__chips">
          {heroMetrics.map(({ row, current, delta, warStart }) => (
            <div key={row.id} className="ftg-war-premium-view__chip">
              <span className="ftg-war-premium-view__chip-label">{row.label}</span>
              <span className="ftg-war-premium-view__chip-price">
                {row.unit.startsWith('USD') || row.unit === 'USD' ? '$' : ''}
                {formatPrice(current, row.unit)}
              </span>
              <span
                className="ftg-war-premium-view__chip-delta"
                style={{ color: deltaColor(row, warStart, current) }}
              >
                {formatSignedPct(delta)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="ftg-war-premium-view__board">
        <WarPremiumBoard livePrices={livePrices} liveRows={liveRows} />
      </div>
    </section>
  );
}

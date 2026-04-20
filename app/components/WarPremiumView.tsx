'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import WarPremiumBoard from './WarPremiumBoard';
import {
  WAR_BASELINES,
  WAR_ANCHOR,
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

type RangeKey = 'since-war' | '90d' | '30d' | '7d';
type ViewKey = 'overview' | 'panels' | 'board';
type ChartMode = 'price' | 'pct' | 'zscore';

const PANEL_DEFS = [
  { id: 'energy', title: 'Energy Shock', rows: ['brent', 'wti', 'natgas', 'us-gasoline', 'us-diesel'] },
  { id: 'agri', title: 'Agri + Fertilizer', rows: ['wheat', 'corn', 'soybeans', 'urea', 'fao-food-index'] },
  { id: 'household', title: 'Household Basket', rows: ['us-gasoline', 'us-diesel', 'bread-1lb', 'eggs-dozen', 'milk-gallon', 'electricity-kwh'] },
  { id: 'inflation', title: 'Inflation Regime', rows: ['cpi-headline', 'cpi-core', 'cpi-food-home', 'cpi-energy', 'us-5y-breakeven'] },
  { id: 'risk', title: 'Risk Regime', rows: ['gold', 'vix', 'dollar-index', 'us10y-yield', 'us-5y-breakeven'] },
] as const;

function StatsSparkline({
  series,
  color,
  width = 220,
  height = 60,
}: {
  series: Array<{ t: string; v: number }>;
  color: string;
  width?: number;
  height?: number;
}) {
  if (series.length < 2) return null;
  const values = series.map((s) => s.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xs = series.map((_, i) => (i / (series.length - 1)) * width);
  const ys = series.map((s) => height - ((s.v - min) / range) * height);
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3} fill={color} />
    </svg>
  );
}

export default function WarPremiumView() {
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [liveRows, setLiveRows] = useState<Record<string, LiveRowPatch>>({});
  const [range, setRange] = useState<RangeKey>('since-war');
  const [chartMode, setChartMode] = useState<ChartMode>('pct');
  const [view, setView] = useState<ViewKey>('overview');
  const [gasGallons, setGasGallons] = useState(50);
  const [dieselGallons, setDieselGallons] = useState(12);
  const [kwhMonthly, setKwhMonthly] = useState(900);
  const [grocerySpend, setGrocerySpend] = useState(950);
  const [alertThreshold, setAlertThreshold] = useState(20);
  const [lastAlert, setLastAlert] = useState<string | null>(null);

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

  const mergedRows = useMemo(() => {
    const out: Record<string, WarBaselineRow> = {};
    for (const row of WAR_BASELINES) {
      const patch = liveRows[row.id];
      const merged = { ...row, ...(patch ?? {}) } as WarBaselineRow;
      out[row.id] = {
        ...merged,
        priceCurrent: livePrices[row.id] ?? merged.priceCurrent,
      };
    }
    return out;
  }, [livePrices, liveRows]);

  const getWindowedSeries = useCallback((row: WarBaselineRow) => {
    const series = row.sparkline;
    if (series.length < 2) return series;
    const now = new Date(series[series.length - 1].t).getTime();
    const cutoffByRange: Record<RangeKey, number> = {
      'since-war': new Date(WAR_ANCHOR.warStart).getTime(),
      '90d': now - 90 * 24 * 3600 * 1000,
      '30d': now - 30 * 24 * 3600 * 1000,
      '7d': now - 7 * 24 * 3600 * 1000,
    };
    const cutoff = cutoffByRange[range];
    const sliced = series.filter((p) => new Date(p.t).getTime() >= cutoff);
    return sliced.length >= 2 ? sliced : series.slice(Math.max(0, series.length - 6));
  }, [range]);

  const transformSeries = useCallback((series: Array<{ t: string; v: number }>) => {
    if (chartMode === 'price') return series;
    if (chartMode === 'pct') {
      const base = series[0]?.v || 1;
      return series.map((p) => ({ t: p.t, v: percentChange(base, p.v) }));
    }
    const avg = series.reduce((a, b) => a + b.v, 0) / Math.max(1, series.length);
    const variance = series.reduce((a, b) => a + (b.v - avg) ** 2, 0) / Math.max(1, series.length);
    const std = Math.sqrt(variance) || 1;
    return series.map((p) => ({ t: p.t, v: (p.v - avg) / std }));
  }, [chartMode]);

  const kpis = useMemo(() => {
    const row = (id: string) => mergedRows[id];
    const delta = (id: string) => {
      const r = row(id);
      return r ? percentChange(r.priceAtWarStart, r.priceCurrent) : 0;
    };
    const spreadNow = (row('brent')?.priceCurrent ?? 0) - (row('wti')?.priceCurrent ?? 0);
    const spreadWar = (row('brent')?.priceAtWarStart ?? 0) - (row('wti')?.priceAtWarStart ?? 0);
    return [
      { label: 'Oil Shock', value: `${formatSignedPct(delta('brent'))}`, sub: `Spread ${spreadNow.toFixed(2)} (${formatSignedPct(percentChange(Math.max(0.01, spreadWar), spreadNow))})` },
      { label: 'Household Pain', value: `${formatSignedPct((delta('us-gasoline') + delta('us-diesel') + delta('electricity-kwh')) / 3)}`, sub: 'Fuel + power basket' },
      { label: 'Food Stress', value: `${formatSignedPct((delta('fao-food-index') + delta('cpi-food-home')) / 2)}`, sub: 'Global + US grocery' },
      { label: 'Inflation Regime', value: `${formatSignedPct((delta('cpi-headline') + delta('cpi-core') + delta('us-5y-breakeven')) / 3)}`, sub: 'CPI + market expectations' },
      { label: 'Agri Stress', value: `${formatSignedPct((delta('wheat') + delta('corn') + delta('soybeans') + delta('urea')) / 4)}`, sub: 'Staples + fertilizer' },
      { label: 'Risk Regime', value: `${formatSignedPct((delta('vix') + delta('gold') + delta('dollar-index')) / 3)}`, sub: 'Vol + safe havens' },
    ];
  }, [mergedRows]);

  const budgetImpact = useMemo(() => {
    const gas = mergedRows['us-gasoline'];
    const diesel = mergedRows['us-diesel'];
    const elec = mergedRows['electricity-kwh'];
    const food = mergedRows['cpi-food-home'];
    const gasDelta = gas ? gas.priceCurrent - gas.priceBaseline : 0;
    const dieselDelta = diesel ? diesel.priceCurrent - diesel.priceBaseline : 0;
    const elecDelta = elec ? elec.priceCurrent - elec.priceBaseline : 0;
    const foodPct = food ? percentChange(food.priceBaseline, food.priceCurrent) / 100 : 0;
    const monthly = gasDelta * gasGallons + dieselDelta * dieselGallons + elecDelta * kwhMonthly + grocerySpend * foodPct;
    return Math.max(0, monthly);
  }, [mergedRows, gasGallons, dieselGallons, kwhMonthly, grocerySpend]);

  const inflationDiffusion = useMemo(() => {
    const inflationRows = ['cpi-headline', 'cpi-core', 'cpi-food-home', 'cpi-energy', 'us-5y-breakeven'];
    const active = inflationRows
      .map((id) => mergedRows[id])
      .filter(Boolean) as WarBaselineRow[];
    if (!active.length) return 0;
    const elevated = active.filter((r) => percentChange(r.priceAtWarStart, r.priceCurrent) > 0).length;
    return (elevated / active.length) * 100;
  }, [mergedRows]);

  const transmissionLag = useMemo(() => {
    const brent = mergedRows.brent;
    const gas = mergedRows['us-gasoline'];
    if (!brent || !gas) return 'Insufficient data';
    const brentMove = percentChange(brent.priceAtWarStart, brent.priceCurrent);
    const gasMove = percentChange(gas.priceAtWarStart, gas.priceCurrent);
    const ratio = brentMove !== 0 ? gasMove / brentMove : 0;
    const lag = ratio > 0.8 ? 'Fast pass-through (1-2 weeks)' : ratio > 0.45 ? 'Moderate pass-through (2-4 weeks)' : 'Lagging pass-through (4+ weeks)';
    return `${lag} · Transmission ${Math.max(0, ratio * 100).toFixed(0)}%`;
  }, [mergedRows]);

  useEffect(() => {
    const exceeded = Object.values(mergedRows).find((row) => percentChange(row.priceAtWarStart, row.priceCurrent) >= alertThreshold);
    if (exceeded) {
      setLastAlert(`${exceeded.label} crossed ${alertThreshold}% since war`);
    }
  }, [mergedRows, alertThreshold]);

  const shareView = useCallback(async () => {
    const link = `${window.location.origin}/war-premium?range=${range}&mode=${chartMode}&view=${view}`;
    await navigator.clipboard.writeText(link);
    setLastAlert('Share link copied');
  }, [range, chartMode, view]);

  const exportSnapshot = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      range,
      chartMode,
      budgetImpact,
      inflationDiffusion,
      rows: Object.values(mergedRows).map((r) => ({
        id: r.id,
        label: r.label,
        sinceWarPct: percentChange(r.priceAtWarStart, r.priceCurrent),
        current: r.priceCurrent,
        currentAsOf: r.currentAsOf,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `war-premium-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [range, chartMode, budgetImpact, inflationDiffusion, mergedRows]);

  return (
    <section className="ftg-war-premium-view">
      <div className="ftg-war-premium-view__hero">
        <div>
          <h2 className="ftg-war-premium-view__title">War Impact Terminal</h2>
          <p className="ftg-war-premium-view__sub">
            Live transmission from war shock to markets, food systems, inflation, and household costs.
          </p>
        </div>
        <div className="ftg-war-premium-view__chips">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="ftg-war-premium-view__chip">
              <span className="ftg-war-premium-view__chip-label">{kpi.label}</span>
              <span className="ftg-war-premium-view__chip-price">{kpi.value}</span>
              <span className="ftg-war-premium-view__chip-delta">{kpi.sub}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ftg-war-premium-view__toolbar">
        <div className="ftg-war-premium-view__toggles">
          {(['overview', 'panels', 'board'] as ViewKey[]).map((v) => (
            <button key={v} type="button" className={`ftg-wpt-btn${view === v ? ' is-active' : ''}`} onClick={() => setView(v)}>
              {v.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="ftg-war-premium-view__toggles">
          {(['since-war', '90d', '30d', '7d'] as RangeKey[]).map((r) => (
            <button key={r} type="button" className={`ftg-wpt-btn${range === r ? ' is-active' : ''}`} onClick={() => setRange(r)}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="ftg-war-premium-view__toggles">
          {(['price', 'pct', 'zscore'] as ChartMode[]).map((m) => (
            <button key={m} type="button" className={`ftg-wpt-btn${chartMode === m ? ' is-active' : ''}`} onClick={() => setChartMode(m)}>
              {m === 'pct' ? '% Δ' : m.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="ftg-war-premium-view__actions">
          <button type="button" className="ftg-wpt-btn" onClick={shareView}>Share Snapshot</button>
          <button type="button" className="ftg-wpt-btn" onClick={exportSnapshot}>Export JSON</button>
        </div>
      </div>

      {lastAlert && <div className="ftg-war-premium-view__alert">{lastAlert}</div>}

      {view !== 'board' && (
        <>
          <div className="ftg-war-premium-view__analytics-grid">
            <div className="ftg-war-premium-view__analytic-card">
              <h3>Household Monthly Impact Estimator</h3>
              <div className="ftg-war-premium-view__slider-grid">
                <label>Gas gallons / month <input type="range" min={20} max={120} value={gasGallons} onChange={(e) => setGasGallons(Number(e.target.value))} /></label>
                <label>Diesel gallons / month <input type="range" min={0} max={40} value={dieselGallons} onChange={(e) => setDieselGallons(Number(e.target.value))} /></label>
                <label>kWh / month <input type="range" min={300} max={1800} value={kwhMonthly} onChange={(e) => setKwhMonthly(Number(e.target.value))} /></label>
                <label>Groceries ($ / month) <input type="range" min={400} max={2200} value={grocerySpend} onChange={(e) => setGrocerySpend(Number(e.target.value))} /></label>
              </div>
              <div className="ftg-war-premium-view__impact">Estimated added cost: <strong>${Math.round(budgetImpact)}/month</strong></div>
            </div>
            <div className="ftg-war-premium-view__analytic-card">
              <h3>Transmission + Diffusion</h3>
              <p><strong>Crude-to-pump lag:</strong> {transmissionLag}</p>
              <p><strong>Inflation diffusion:</strong> {inflationDiffusion.toFixed(0)}% of tracked inflation gauges still rising vs war start.</p>
              <label className="ftg-war-premium-view__threshold">
                Alert threshold (% since war)
                <input type="number" min={5} max={200} value={alertThreshold} onChange={(e) => setAlertThreshold(Number(e.target.value) || 20)} />
              </label>
            </div>
          </div>

          <div className="ftg-war-premium-view__panel-grid">
            {PANEL_DEFS.map((panel) => (
              <article key={panel.id} className="ftg-war-premium-view__panel">
                <h3>{panel.title}</h3>
                <div className="ftg-war-premium-view__panel-rows">
                  {panel.rows.map((id) => {
                    const row = mergedRows[id];
                    if (!row) return null;
                    const series = transformSeries(getWindowedSeries(row));
                    const color = deltaColor(row, row.priceAtWarStart, row.priceCurrent);
                    const sinceWar = percentChange(row.priceAtWarStart, row.priceCurrent);
                    return (
                      <div key={id} className="ftg-war-premium-view__panel-row">
                        <div className="ftg-war-premium-view__panel-row-head">
                          <span>{row.label}</span>
                          <span style={{ color }}>{formatSignedPct(sinceWar)}</span>
                        </div>
                        <div className="ftg-war-premium-view__panel-row-meta">
                          <span>
                            {row.unit.startsWith('USD') || row.unit === 'USD' ? '$' : ''}
                            {formatPrice(row.priceCurrent, row.unit)} · as of {row.currentAsOf}
                          </span>
                        </div>
                        <StatsSparkline series={series} color={color} />
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {(view === 'board' || view === 'overview') && (
        <div className="ftg-war-premium-view__board">
          <WarPremiumBoard livePrices={livePrices} liveRows={liveRows} />
        </div>
      )}
    </section>
  );
}

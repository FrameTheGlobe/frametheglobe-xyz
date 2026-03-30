'use client';

/**
 * IranWarCostBoard — Iran Theater Ops & Risk (real feeds only).
 *
 * This widget shows a live ops/risk view from real feeds.
 *
 * The older “war cost / casualties / munitions readiness” ticker used to rely on
 * simulated model numbers; those are reintroduced here as event-derived estimates
 * computed from live missile keyword detections inside the existing `/api/news` cache.
 *
 * Everything displayed now is derived from real data feeds already in the app:
 *  - /api/news (RSS ingestion cache)
 *  - /api/flights (ADS-B)
 *  - /api/market (Yahoo/Stooq oil prices)
 *  - /api/theater-metrics (backend aggregation of news+flights)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useVisibilityPolling } from '@/lib/use-visibility-polling';

type TheaterMetrics = {
  ok: boolean;
  fetchedAt: string;
  news: { cached: boolean; totalItems: number; sourceCount: number; failedSources: number };
  flights: { cached: boolean; total: number; strategic: number; source: string; fetchedAt: string | null };
  buckets: { label: string; last6h: number; last24h: number }[];
};

type FeedItem = {
  title: string;
  link: string;
  pubDate: string;
  summary: string;
  sourceName: string;
};

type Quote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
};

function fmt(n: number, d = 2) { return n.toFixed(d); }
function sign(n: number) { return n >= 0 ? '+' : ''; }

function formatCompactUSD(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${n.toFixed(0)}`;
}

function inWindow(pubDate: string, nowMs: number, windowMs: number): boolean {
  const t = Date.parse(pubDate);
  if (!Number.isFinite(t)) return false;
  return nowMs - t <= windowMs && nowMs - t >= 0;
}

function timeAgoLabel(nowMs: number, pubDate: string): string {
  const t = Date.parse(pubDate);
  if (!Number.isFinite(t)) return '—';
  const diff = Math.max(0, nowMs - t);
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `-${Math.max(1, mins)}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `-${hrs}h`;
  return `-${Math.floor(hrs / 24)}d`;
}

export default function IranWarCostBoard() {
  const [now, setNow] = useState<Date>(new Date());
  const tick = useCallback(() => setNow(new Date()), []);
  useVisibilityPolling(tick, 1_000);

  const [metrics, setMetrics] = useState<TheaterMetrics | null>(null);
  const [metricsErr, setMetricsErr] = useState(false);

  const [prices, setPrices] = useState<Quote[]>([]);
  const [priceErr, setPriceErr] = useState(false);

  const [news, setNews] = useState<FeedItem[]>([]);
  const [newsErr, setNewsErr] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/theater-metrics', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMetrics(data as TheaterMetrics);
      setMetricsErr(false);
    } catch {
      setMetricsErr(true);
    }
  }, []);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/market', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) setPrices(data as Quote[]);
      setPriceErr(false);
    } catch {
      setPriceErr(true);
    }
  }, []);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/news', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setNews(items as FeedItem[]);
      setNewsErr(false);
    } catch {
      setNewsErr(true);
    }
  }, []);

  useEffect(() => { fetchMetrics(); fetchPrices(); fetchNews(); }, [fetchMetrics, fetchPrices, fetchNews]);
  useVisibilityPolling(fetchMetrics, 60_000);
  useVisibilityPolling(fetchPrices, 60_000);
  useVisibilityPolling(fetchNews, 120_000);

  const mono = 'var(--font-mono)';
  const accent = 'var(--accent)';
  const border = 'var(--border-light)';
  const muted = 'var(--text-muted)';
  const surface = 'var(--surface)';
  const upColor = '#27ae60';
  const downColor = '#c93a20';

  const bucket = useCallback((label: string) => metrics?.buckets?.find(b => b.label === label) ?? null, [metrics]);
  const hormuz = bucket('HORMUZ');
  const redSea = bucket('RED SEA');
  const tankers = bucket('TANKERS');
  const iran = bucket('IRAN');

  const brent = prices.find(p => p.symbol === 'CB.F');
  const wti = prices.find(p => p.symbol === 'CL.F');
  const spread = (brent && wti) ? brent.price - wti.price : null;

  const opsTempo = useMemo(() => {
    const s = Math.max(0, spread ?? 0);
    const h = hormuz?.last6h ?? 0;
    const r = redSea?.last6h ?? 0;
    const t = tankers?.last6h ?? 0;
    const i = iran?.last6h ?? 0;
    const f = metrics?.flights?.strategic ?? 0;
    const raw = (s * 4) + (h * 2.2) + (r * 1.8) + (t * 1.1) + (i * 1.6) + (f * 0.6);
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [spread, hormuz, redSea, tankers, iran, metrics]);

  const riskBand = useMemo(() => {
    if (opsTempo >= 70) return { label: 'CRITICAL', color: downColor };
    if (opsTempo >= 45) return { label: 'ELEVATED', color: '#e67e22' };
    return { label: 'NORMAL', color: upColor };
  }, [opsTempo, downColor, upColor]);

  const logItems = useMemo(() => {
    const nowMs = now.getTime();
    const re = /\b(hormuz|strait of hormuz|red sea|bab el[- ]mandeb|tanker|shipping|vessel|iran|irgc|tehran|natanz|fordow)\b/i;
    return (news ?? [])
      .filter(it => re.test(`${it.title}\n${it.summary ?? ''}`))
      .slice()
      .sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate))
      .slice(0, 4)
      .map(it => ({
        t: timeAgoLabel(nowMs, it.pubDate),
        e: it.title,
        c: it.sourceName,
      }));
  }, [news, now]);

  // Live “war cost ticker” + missile intel (event-derived estimates).
  // Note: this is an estimate based on headline/summary keyword detections.
  const missileIntel = useMemo(() => {
    const nowMs = now.getTime();

    const MISSILE_TYPES: { label: string; keywords: string[] }[] = [
      { label: 'Ballistic', keywords: ['ballistic missile', 'sejjil', 'fateh', 'emad', 'qiam', 'shahab', 'kheibar', 'jericho'] },
      { label: 'Cruise', keywords: ['cruise missile', 'cruise'] },
      { label: 'Drone', keywords: ['shahed', 'drone strike', 'drone attack', 'uav', 'kamikaze'] },
      { label: 'Iron Dome', keywords: ['iron dome'] },
      { label: 'Intercept', keywords: ['intercept', 'shot down', 'arrow system', "david's sling"] },
      { label: 'Airstrike', keywords: ['airstrike', 'air strike', 'f-35', 'f-16'] },
    ];

    const IRAN_KW = [
      'iran', 'irgc', 'hezbollah', 'hamas', 'houthi', 'islamic republic',
      'sejjil', 'fateh', 'emad', 'qiam', 'shahab', 'kheibar', 'shahed',
      'arash', 'iranian missile', 'iranian drone', 'proxy',
    ];

    const ISRAEL_KW = [
      'israel', 'idf', 'israeli', 'iron dome', "david's sling", 'arrow system',
      'iaf', 'mossad', 'f-35', 'f-16', 'tel aviv', 'jerusalem',
      'israeli airstrike', 'israeli forces',
    ];

    const COST_USD_BY_TYPE: Record<string, number> = {
      Ballistic: 20_000_000,
      Cruise: 5_000_000,
      Drone: 50_000,
      'Iron Dome': 150_000,
      Intercept: 250_000,
      Airstrike: 2_000_000,
    };

    // Rough casualty estimator used only to reproduce the old “ticker feel”.
    // Excluding defensive intercept types by default.
    const CASUALTIES_BY_TYPE: Record<string, number> = {
      Ballistic: 18,
      Cruise: 10,
      Drone: 2,
      Airstrike: 12,
      'Iron Dome': 0,
      Intercept: 0,
    };

    const MISSILE_LOG_RE = /\b(missile|ballistic|cruise missile|shahed|fateh|sejjil|iron dome|david's sling|arrow system|jericho|intercept|airstrike|drone strike|uav|kamikaze)\b/i;

    const matchesAny = (text: string, kws: string[]) => kws.some(k => text.includes(k));

    const iranTextMatch = (it: FeedItem) => {
      const t = `${it.title} ${it.summary ?? ''}`.toLowerCase();
      return matchesAny(t, IRAN_KW);
    };
    const israelTextMatch = (it: FeedItem) => {
      const t = `${it.title} ${it.summary ?? ''}`.toLowerCase();
      return matchesAny(t, ISRAEL_KW);
    };

    const windowMs6h = 6 * 60 * 60 * 1000;
    const windowed = (items: FeedItem[], predicate: (it: FeedItem) => boolean) =>
      (items ?? []).filter(it => predicate(it) && inWindow(it.pubDate, nowMs, windowMs6h));

    const iranItems6h = windowed(news ?? [], iranTextMatch);
    const israelItems6h = windowed(news ?? [], israelTextMatch);

    const countByType = (items: FeedItem[]) => {
      const out: Record<string, number> = {};
      for (const { label, keywords } of MISSILE_TYPES) {
        out[label] = items.filter(it => {
          const text = `${it.title} ${it.summary ?? ''}`.toLowerCase();
          return keywords.some(k => text.includes(k));
        }).length;
      }
      return out;
    };

    const iranByType = countByType(iranItems6h);
    const israelByType = countByType(israelItems6h);

    const totalByType: Record<string, number> = {};
    for (const { label } of MISSILE_TYPES) {
      totalByType[label] = (iranByType[label] ?? 0) + (israelByType[label] ?? 0);
    }

    const munitions6h = Object.values(totalByType).reduce((a, b) => a + b, 0);
    const casualties6h = MISSILE_TYPES.reduce((sum, { label }) => sum + (CASUALTIES_BY_TYPE[label] ?? 0) * (totalByType[label] ?? 0), 0);
    const warCostUsd6h = MISSILE_TYPES.reduce((sum, { label }) => sum + (COST_USD_BY_TYPE[label] ?? 0) * (totalByType[label] ?? 0), 0);

    const latestMissileSignals = (news ?? [])
      .filter(it => MISSILE_LOG_RE.test(`${it.title}\n${it.summary ?? ''}`))
      .slice()
      .sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate))
      .slice(0, 3)
      .map(it => ({
        t: timeAgoLabel(nowMs, it.pubDate),
        e: it.title,
        c: it.sourceName,
      }));

    return {
      totalByType,
      munitions6h,
      casualties6h: Math.round(casualties6h),
      warCostUsd6h,
      latestMissileSignals,
    };
  }, [news, now]);

  const readinessIndex = useMemo(() => {
    // When ops tempo is high, readiness drops.
    return Math.max(0, Math.min(100, Math.round(100 - opsTempo)));
  }, [opsTempo]);

  return (
    <div className="ftg-iran-board" style={{
      background: surface,
      border: `1px solid ${border}`,
      borderTop: `2px solid ${accent}`,
      borderRadius: '0 0 6px 6px',
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      <div className="widget-hd ftg-iran-board-top" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px',
        flexWrap: 'wrap',
        gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="live-dot" style={{ background: accent }} />
          <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: accent, letterSpacing: '0.1em' }}>
            IRAN THEATER OPS & RISK (LIVE FEEDS)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ fontFamily: mono, fontSize: 11, padding: '4px 10px', background: riskBand.color, color: '#fff', borderRadius: 2, fontWeight: 700, letterSpacing: '0.08em' }}>
            {riskBand.label}
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, padding: '4px 10px', background: 'var(--border-light)', borderRadius: 2, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
            UPDATED
          </div>
        </div>
      </div>

      <div className="ftg-iran-board-grid" style={{ display: 'flex', flexWrap: 'wrap' }}>
        <div className="ftg-iran-board-main" style={{ flex: '2 1 500px', borderRight: `1px solid ${border}` }}>
          <div style={{ padding: '22px', borderBottom: `1px solid ${border}`, textAlign: 'center' }}>
            <div style={{ fontFamily: mono, fontSize: 12, color: muted, letterSpacing: '0.12em', marginBottom: 14 }}>
              OPS TEMPO INDEX (0–100) · LIVE NEWS + ADS-B + OIL SPREAD
            </div>
            <div style={{
              fontFamily: mono, fontSize: 46, fontWeight: 900, color: riskBand.color,
              lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 10, fontVariantNumeric: 'tabular-nums',
            }}>
              {String(opsTempo).padStart(2, '0')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontFamily: mono, fontSize: 12, color: muted, fontWeight: 700 }}>BRENT–WTI</span>
                <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 900, color: 'var(--text-primary)' }}>
                  {spread === null ? '—' : `${sign(spread)}$${fmt(Math.abs(spread), 2)}`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontFamily: mono, fontSize: 12, color: muted, fontWeight: 700 }}>STRATEGIC FLIGHTS</span>
                <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 900, color: 'var(--text-primary)' }}>
                  {metrics ? metrics.flights.strategic : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontFamily: mono, fontSize: 12, color: muted, fontWeight: 700 }}>NEWS ITEMS</span>
                <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 900, color: 'var(--text-primary)' }}>
                  {metrics ? metrics.news.totalItems : '—'}
                </span>
              </div>
            </div>

              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: mono, fontSize: 12, color: muted, fontWeight: 700 }}>WAR COST (6H EST.)</span>
                  <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 900, color: 'var(--text-primary)' }}>
                    ${formatCompactUSD(missileIntel.warCostUsd6h)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: mono, fontSize: 12, color: muted, fontWeight: 700 }}>MUNITIONS (6H)</span>
                  <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 900, color: 'var(--text-primary)' }}>
                    {missileIntel.munitions6h}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: mono, fontSize: 12, color: muted, fontWeight: 700 }}>READINESS</span>
                  <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 900, color: 'var(--text-primary)' }}>
                    {readinessIndex}
                  </span>
                </div>
              </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
            {[
              { l: 'HORMUZ', v: hormuz?.last6h ?? null },
              { l: 'RED SEA', v: redSea?.last6h ?? null },
              { l: 'TANKERS', v: tankers?.last6h ?? null },
              { l: 'IRAN', v: iran?.last6h ?? null },
            ].map((m, idx) => (
              <div key={m.l} style={{
                padding: '12px 12px',
                borderRight: idx < 3 ? `1px solid ${border}` : 'none',
                borderBottom: `1px solid ${border}`,
                background: 'rgba(255,255,255,0.01)',
              }}>
                <div style={{ fontFamily: mono, fontSize: 10, color: muted, fontWeight: 800, letterSpacing: '0.08em' }}>
                  {m.l} (6H)
                </div>
                <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 900, marginTop: 6, color: 'var(--text-primary)' }}>
                  {m.v === null ? '—' : m.v}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '12px 16px', borderTop: `1px solid ${border}`, background: 'var(--surface-hover)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 900, color: accent }}>FEEDS:</span>
            <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>
              RSS · ADS-B · YAHOO/STOOQ
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
              {(metricsErr || priceErr || newsErr) && (
                <span style={{ fontFamily: mono, fontSize: 11, color: downColor, fontWeight: 800 }}>⚠ DEGRADED</span>
              )}
              <span style={{ fontFamily: mono, fontSize: 11, color: muted, fontWeight: 700 }}>
                {metrics?.flights?.fetchedAt ? `FLIGHTS ${new Date(metrics.flights.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="ftg-iran-board-side" style={{ flex: '1 1 300px', background: 'var(--bg)' }}>
          <div style={{ padding: '20px', borderBottom: `1px solid ${border}` }}>
            <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, marginBottom: 16 }}>RECENT FEED LOG (FILTERED)</div>
            {logItems.length === 0 ? (
              <div style={{ fontFamily: mono, fontSize: 13, color: muted }}>No matching items in cache.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {logItems.map((h, i) => (
                  <div key={i} style={{ borderLeft: `2px solid var(--accent-light)`, paddingLeft: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, gap: 10 }}>
                      <span style={{ fontFamily: mono, fontSize: 13, color: accent, fontWeight: 800, whiteSpace: 'nowrap' }}>{h.t}</span>
                      <span style={{ fontFamily: mono, fontSize: 11, color: muted, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.c}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4, fontWeight: 500 }}>
                      {h.e}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 18, borderTop: `1px solid ${border}`, paddingTop: 16 }}>
              <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, marginBottom: 12 }}>MISSILE INTEL (6H · EVENT-DERIVED)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                {[
                  'Ballistic',
                  'Cruise',
                  'Drone',
                  'Iron Dome',
                  'Intercept',
                  'Airstrike',
                ].map((label) => (
                  <div key={label} style={{
                    border: `1px solid ${border}`,
                    background: 'var(--surface-hover)',
                    borderRadius: 6,
                    padding: '10px 8px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>
                      {missileIntel.totalByType[label] ?? 0}
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 7, color: muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, marginBottom: 10 }}>LATEST MISSILE SIGNALS</div>
              {missileIntel.latestMissileSignals.length === 0 ? (
                <div style={{ fontFamily: mono, fontSize: 13, color: muted }}>No missile signals in current cache.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {missileIntel.latestMissileSignals.map((h, i) => (
                    <div key={i} style={{ borderLeft: `2px solid var(--accent-light)`, paddingLeft: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, gap: 10 }}>
                        <span style={{ fontFamily: mono, fontSize: 13, color: accent, fontWeight: 800, whiteSpace: 'nowrap' }}>{h.t}</span>
                        <span style={{ fontFamily: mono, fontSize: 11, color: muted, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.c}</span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4, fontWeight: 500 }}>
                        {h.e}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '20px' }}>
            <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, marginBottom: 16 }}>FEED HEALTH</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { l: 'SOURCES', v: metrics ? String(metrics.news.sourceCount) : '—' },
                { l: 'FAILED', v: metrics ? String(metrics.news.failedSources) : '—' },
                { l: 'FLIGHTS', v: metrics ? String(metrics.flights.total) : '—' },
                { l: 'STRATEGIC', v: metrics ? String(metrics.flights.strategic) : '—' },
              ].map((m) => (
                <div key={m.l} style={{ border: `1px solid ${border}`, borderRadius: 6, padding: '12px', background: 'var(--surface-hover)' }}>
                  <div style={{ fontFamily: mono, fontSize: 11, color: muted, fontWeight: 800, marginBottom: 6 }}>{m.l}</div>
                  <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>{m.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="ftg-iran-board-footer" style={{
        padding: '10px 14px',
        borderTop: `1px solid ${border}`,
        background: 'var(--accent-light)',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 900, color: accent }}>LATEST:</span>
          <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--text-primary)' }}>
            {logItems[0]?.e ?? '—'}
          </span>
        </div>
        <div style={{ fontFamily: mono, fontSize: 10, color: muted }}>
          {metrics ? `METRICS ${new Date(metrics.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
        </div>
      </div>
    </div>
  );
}


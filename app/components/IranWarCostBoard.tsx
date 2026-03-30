'use client';

/**
 * IranWarCostBoard — Iran Theater Ops & Risk (real feeds only).
 *
 * This widget previously contained simulated “model” numbers (cost, casualties,
 * munitions, readiness). Those have been removed.
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


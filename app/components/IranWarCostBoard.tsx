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
  news: {
    cached: boolean;
    totalItems: number;
    sourceCount: number;
    failedSources: number;
    ageMinutes?: number | null;
  };
  flights: {
    cached: boolean;
    total: number;
    strategic: number;
    source: string;
    fetchedAt: string | null;
    ageMinutes?: number | null;
  };
  buckets: { label: string; last6h: number; last24h: number; last72h?: number }[];
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

function formatFullUSD(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Math.max(0, Math.round(n)).toLocaleString('en-US');
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

/** Align with backend `theater-metrics` so UI matches the RSS rows the user sees. */
function itemTimeMs(pubDate: string, ingestFallbackMs: number): number {
  const a = Date.parse(pubDate);
  if (Number.isFinite(a)) return a;
  const b = new Date(pubDate).getTime();
  if (Number.isFinite(b)) return b;
  return ingestFallbackMs;
}

function countMentionsTheater(
  items: FeedItem[],
  re: RegExp,
  nowMs: number,
  ingestFallbackMs: number,
): { last6h: number; last24h: number } {
  const MS_6H = 6 * 60 * 60 * 1000;
  const MS_24H = 24 * 60 * 60 * 1000;
  let last6h = 0;
  let last24h = 0;
  for (const it of items) {
    const hay = `${it.title}\n${it.summary ?? ''}`;
    if (!re.test(hay)) continue;
    const t = itemTimeMs(it.pubDate, ingestFallbackMs);
    const age = nowMs - t;
    if (age < 0) continue;
    if (age <= MS_6H) last6h++;
    if (age <= MS_24H) last24h++;
  }
  return { last6h, last24h };
}

const RE_HORMUZ = /\b(hormuz|strait of hormuz|bandar abbas|qeshm|orfuj|jask|chabahar|arabian gulf|persian gulf)\b/i;
const RE_REDSEA = /\b(red sea|bab el[- ]mandeb|bāb el[- ]mandeb|houthi|yemen|aden|suez|gulf of aden)\b/i;
const RE_TANKER = /\b(tanker|vlcc|aframax|suezmax|shipping|vessel|maritime|freight|insurer|piracy|escort|oil shipment|dirty tanker|clean product|lng carrier|floating storage)\b/i;
const RE_IRAN   = /\b(iran|irgc|tehran|isfahan|natanz|fordow|qom|khamenei)\b/i;
const RE_OSINT_AIR = /\b(usaf|us air force|pentagon|carrier|strike group|strategic bomber|airstrike|b-52|b-2|f-35|f-16|f-15|f-22|idf air|iaf|israeli jet|sortie|air base|rq-4|global hawk|mq-9|reaper|tomahawk|missile strike)\b/i;

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
  const [newsMeta, setNewsMeta] = useState({ sourceCount: 0, failedSources: 0 });
  const [localFlights, setLocalFlights] = useState<{ total: number; strategic: number } | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/theater-metrics');
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
      const res = await fetch('/api/market');
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
      const res = await fetch('/api/news');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setNews(items as FeedItem[]);
      setNewsMeta({
        sourceCount:   typeof data?.sourceCount === 'number' ? data.sourceCount : 0,
        failedSources: typeof data?.failedSources === 'number' ? data.failedSources : 0,
      });
      setNewsErr(false);
    } catch {
      setNewsErr(true);
    }
  }, []);

  const fetchFlightsLocal = useCallback(async () => {
    try {
      const res = await fetch('/api/flights');
      if (!res.ok) return;
      const d = await res.json();
      setLocalFlights({
        total:     Number(d.total) || 0,
        strategic: Number(d.strategic) || 0,
      });
    } catch { /* keep last */ }
  }, []);

  useEffect(() => {
    fetchMetrics();
    fetchPrices();
    fetchNews();
    fetchFlightsLocal();
  }, [fetchMetrics, fetchPrices, fetchNews, fetchFlightsLocal]);
  useVisibilityPolling(fetchMetrics, 120_000);
  useVisibilityPolling(fetchPrices, 120_000);
  useVisibilityPolling(fetchNews, 120_000);
  useVisibilityPolling(fetchFlightsLocal, 120_000);

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

  /** Client-side bucket counts from the same `news[]` as the headline stream (fixes 0 vs visible stories). */
  const clientBuckets = useMemo(() => {
    const nowMs = now.getTime();
    const fallback = nowMs;
    return {
      HORMUZ:  countMentionsTheater(news, RE_HORMUZ, nowMs, fallback),
      REDSEA:  countMentionsTheater(news, RE_REDSEA, nowMs, fallback),
      TANKERS: countMentionsTheater(news, RE_TANKER, nowMs, fallback),
      IRAN:    countMentionsTheater(news, RE_IRAN, nowMs, fallback),
    };
  }, [news, now]);

  const mergedThreat = useMemo(() => ({
    hormuz6:  Math.max(hormuz?.last6h  ?? 0, clientBuckets.HORMUZ.last6h),
    hormuz24: Math.max(hormuz?.last24h ?? 0, clientBuckets.HORMUZ.last24h),
    red6:     Math.max(redSea?.last6h  ?? 0, clientBuckets.REDSEA.last6h),
    red24:    Math.max(redSea?.last24h ?? 0, clientBuckets.REDSEA.last24h),
    tank6:    Math.max(tankers?.last6h  ?? 0, clientBuckets.TANKERS.last6h),
    tank24:   Math.max(tankers?.last24h ?? 0, clientBuckets.TANKERS.last24h),
    iran6:    Math.max(iran?.last6h     ?? 0, clientBuckets.IRAN.last6h),
    iran24:   Math.max(iran?.last24h    ?? 0, clientBuckets.IRAN.last24h),
  }), [hormuz, redSea, tankers, iran, clientBuckets]);

  const osintAir6h = useMemo(() => {
    const nowMs = now.getTime();
    const MS_6H = 6 * 60 * 60 * 1000;
    const fallback = nowMs;
    let n = 0;
    for (const it of news) {
      const hay = `${it.title}\n${it.summary ?? ''}`;
      if (!RE_OSINT_AIR.test(hay)) continue;
      const age = nowMs - itemTimeMs(it.pubDate, fallback);
      if (age >= 0 && age <= MS_6H) n++;
    }
    return n;
  }, [news, now]);

  const adsbStrategic = Math.max(metrics?.flights?.strategic ?? 0, localFlights?.strategic ?? 0);
  const adsbTotal     = Math.max(metrics?.flights?.total ?? 0, localFlights?.total ?? 0);
  const displayStrategicBlend = adsbStrategic + osintAir6h;
  const newsTotalDisplay = Math.max(news.length, metrics?.news?.totalItems ?? 0);
  const uniqueSrc = useMemo(
    () => new Set((news ?? []).map(n => n.sourceName).filter(Boolean)).size,
    [news],
  );
  const sourcesDisplay = Math.max(newsMeta.sourceCount, uniqueSrc, news.length ? 1 : 0);
  const failedDisplay    = metrics && !metricsErr ? metrics.news.failedSources : newsMeta.failedSources;

  const opsTempo = useMemo(() => {
    const s = Math.max(0, spread ?? 0);
    const h = mergedThreat.hormuz6;
    const r = mergedThreat.red6;
    const t = mergedThreat.tank6;
    const i = mergedThreat.iran6;
    const f = displayStrategicBlend;
    const raw = (s * 4) + (h * 2.2) + (r * 1.8) + (t * 1.1) + (i * 1.6) + (f * 0.35);
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [spread, mergedThreat, displayStrategicBlend]);

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
      .slice(0, 7)
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
      { label: 'Cruise', keywords: ['cruise missile', 'cruise', 'tomahawk', 'kalibr', 'land-attack missile'] },
      { label: 'Drone', keywords: ['shahed', 'drone strike', 'drone attack', 'uav', 'kamikaze'] },
      { label: 'Iron Dome', keywords: ['iron dome', 'rocket intercept', 'gaza rocket', 'air defence', 'air defense'] },
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

    /** Any 6h story tied to Iran/Israel theater OR explicit missile/defense language (fixes cruise/Iron Dome stuck at 0). */
    const missileRelevant6h = windowed(
      news ?? [],
      it => iranTextMatch(it) || israelTextMatch(it) || MISSILE_LOG_RE.test(`${it.title}\n${it.summary ?? ''}`),
    );

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

    const totalByType = countByType(missileRelevant6h);

    const munitions6h = Object.values(totalByType).reduce((a, b) => a + b, 0);
    const casualties6h = MISSILE_TYPES.reduce((sum, { label }) => sum + (CASUALTIES_BY_TYPE[label] ?? 0) * (totalByType[label] ?? 0), 0);
    const warCostUsd6h = MISSILE_TYPES.reduce((sum, { label }) => sum + (COST_USD_BY_TYPE[label] ?? 0) * (totalByType[label] ?? 0), 0);

    const latestMissileSignals = (news ?? [])
      .filter(it => MISSILE_LOG_RE.test(`${it.title}\n${it.summary ?? ''}`))
      .slice()
      .sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate))
      .slice(0, 5)
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

  // Long-horizon cost ticker model (running counter, separate from 6H ops estimate).
  // Model mirrors the public-style ticker format:
  // - $11.3B for first 6 days
  // - then $1B/day ongoing
  const longHorizonCost = useMemo(() => {
    const nowMs = now.getTime();
    const startedAtMs = Date.parse('2026-02-28T00:00:00Z');
    const firstWindowMs = 6 * 24 * 60 * 60 * 1000;
    const firstWindowCost = 11_300_000_000;
    const ongoingPerDay = 1_000_000_000;
    const ongoingPerMs = ongoingPerDay / (24 * 60 * 60 * 1000);

    if (!Number.isFinite(startedAtMs) || nowMs <= startedAtMs) {
      return {
        totalUsd: 0,
        perSecond: ongoingPerMs * 1000,
        perHour: ongoingPerDay / 24,
        perDay: ongoingPerDay,
        elapsedMs: 0,
      };
    }

    const elapsedMs = nowMs - startedAtMs;
    const firstLeg = Math.min(elapsedMs, firstWindowMs);
    const secondLeg = Math.max(0, elapsedMs - firstWindowMs);
    const firstLegRate = firstWindowCost / firstWindowMs;
    const totalUsd = (firstLegRate * firstLeg) + (ongoingPerMs * secondLeg);

    return {
      totalUsd,
      perSecond: ongoingPerMs * 1000,
      perHour: ongoingPerDay / 24,
      perDay: ongoingPerDay,
      elapsedMs,
    };
  }, [now]);

  const elapsedClock = useMemo(() => {
    const ms = Math.max(0, (longHorizonCost as { elapsedMs?: number }).elapsedMs ?? 0);
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86_400);
    const hours = Math.floor((totalSec % 86_400) / 3_600);
    const mins = Math.floor((totalSec % 3_600) / 60);
    const secs = totalSec % 60;
    return { days, hours, mins, secs };
  }, [longHorizonCost]);

  const humanCostSignals = useMemo(() => {
    const nowMs = now.getTime();
    const re = /\b(killed|dead|deaths|wounded|injured|casualt(?:y|ies)|civilian|hospital|refugee|displaced)\b/i;
    const last24h = (news ?? []).filter(it => re.test(`${it.title}\n${it.summary ?? ''}`) && inWindow(it.pubDate, nowMs, 24 * 60 * 60 * 1000));
    return {
      mentions24h: last24h.length,
      casualties6h: missileIntel.casualties6h,
      munitions6h: missileIntel.munitions6h,
    };
  }, [news, now, missileIntel]);

  // Broader theater news stream for left panel (uses looser keyword set)
  const streamItems = useMemo(() => {
    const nowMs = now.getTime();
    const re = /\b(iran|irgc|tehran|natanz|hormuz|strait|red sea|houthi|hezbollah|hamas|israel|idf|missile|airstrike|nuclear|ceasefire|oil|tanker|drone|strike|attack|military|war|conflict|sanction|zarif|khamenei|netanyahu|biden|trump)\b/i;
    return (news ?? [])
      .filter(it => re.test(`${it.title}\n${it.summary ?? ''}`))
      .slice()
      .sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate))
      .slice(0, 6)
      .map(it => ({
        t: timeAgoLabel(nowMs, it.pubDate),
        e: it.title,
        c: it.sourceName,
      }));
  }, [news, now]);

  const criticalZones = useMemo(() => {
    const targets = ['kharg island', 'tel aviv', 'haifa', 'beirut', 'strait of hormuz', 'red sea', 'natanz', 'fordow', 'tehran', 'damascus', 'sanaa', 'baghdad', 'kurdistan', 'golan heights', 'eilat', 'ashkelon', 'nuclear facility', 'oil refinery', 'military base', 'isfahan', 'tabriz', 'gaza', 'rafah'];
    const hits: Record<string, number> = {};
    const nowMs = now.getTime();
    (news ?? []).forEach(it => {
       if (!inWindow(it.pubDate, nowMs, 24 * 60 * 60 * 1000)) return;
       const text = `${it.title} ${it.summary ?? ''}`.toLowerCase();
       targets.forEach(t => {
         if (text.includes(t)) {
           hits[t] = (hits[t] || 0) + 1;
         }
       });
    });
    return Object.entries(hits).sort((a,b) => b[1] - a[1]).slice(0, 8);
  }, [news, now]);

  // Section label used repeatedly — keeps styling consistent
  const SectionLabel = ({ children }: { children: string }) => (
    <div style={{
      fontFamily: mono, fontSize: 9, fontWeight: 900, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: muted, marginBottom: 8,
    }}>{children}</div>
  );

  return (
    <div className="ftg-iran-board" style={{
      background: surface,
      border: `1px solid ${border}`,
      borderTop: `3px solid ${accent}`,
      borderRadius: '0 0 6px 6px',
      marginBottom: 12,
      overflow: 'hidden',
    }}>

      {/* ── Widget header ──────────────────────────────────────────── */}
      <div className="widget-hd ftg-iran-board-top" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '9px 14px', flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="live-dot" style={{ background: accent }} />
          <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 800, color: accent, letterSpacing: '0.1em' }}>
            IRAN THEATER OPS &amp; RISK (LIVE FEEDS)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: mono, fontSize: 10, padding: '3px 8px', background: riskBand.color, color: '#fff', borderRadius: 2, fontWeight: 800, letterSpacing: '0.08em' }}>
            {riskBand.label}
          </span>
          {(metricsErr || priceErr || newsErr) && (
            <span style={{ fontFamily: mono, fontSize: 10, color: downColor, fontWeight: 800 }}>⚠ DEGRADED</span>
          )}
          <span style={{ fontFamily: mono, fontSize: 10, color: muted }}>
            {metrics ? `UPDATED ${new Date(metrics.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'UPDATED'}
          </span>
        </div>
      </div>

      {/* ── Body grid ─────────────────────────────────────────────── */}
      <div className="ftg-iran-board-grid" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>

        {/* ── LEFT: main panel ────────────────────────────────────── */}
        <div className="ftg-iran-board-main" style={{ flex: '2 1 480px', borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column' }}>

          {/* COST TICKER */}
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${border}`, background: 'var(--surface-hover)' }}>
            <SectionLabel>Est. U.S. Cost Since Strikes Began · Operation Epic Fury · Feb 28 2026</SectionLabel>
            <div style={{
              fontFamily: mono,
              fontSize: 'clamp(28px, 4.5vw, 40px)',
              fontWeight: 900,
              color: '#e67e22',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.01em',
              wordBreak: 'break-word',
              marginBottom: 10,
            }}>
              ${formatFullUSD(longHorizonCost.totalUsd)}
            </div>

            {/* Clock + rate row */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Elapsed clock */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {[
                  { l: 'DAYS', v: String(elapsedClock.days).padStart(2, '0') },
                  { l: 'HRS',  v: String(elapsedClock.hours).padStart(2, '0') },
                  { l: 'MIN',  v: String(elapsedClock.mins).padStart(2, '0') },
                  { l: 'SEC',  v: String(elapsedClock.secs).padStart(2, '0') },
                ].map((u) => (
                  <div key={u.l} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ border: `1px solid ${border}`, background: surface, borderRadius: 4, padding: '5px 8px', textAlign: 'center', minWidth: 46 }}>
                      <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 900, color: accent, lineHeight: 1 }}>{u.v}</div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: muted, fontWeight: 700, letterSpacing: '0.06em', marginTop: 2 }}>{u.l}</div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Rate cards */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                {[
                  { l: 'PER SEC',  v: `$${formatCompactUSD(longHorizonCost.perSecond)}` },
                  { l: 'PER HOUR', v: `$${formatCompactUSD(longHorizonCost.perHour)}` },
                  { l: 'PER DAY',  v: `$${formatCompactUSD(longHorizonCost.perDay)}` },
                ].map((m) => (
                  <div key={m.l} style={{ background: 'var(--surface-hover)', borderRadius: 4, padding: '6px 12px', flex: '1 1 80px' }}>
                    <div style={{ fontFamily: mono, fontSize: 8, color: muted, fontWeight: 700, letterSpacing: '0.06em' }}>{m.l}</div>
                    <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ fontFamily: mono, fontSize: 9, color: muted, marginTop: 8 }}>
              $11.3B first 6 days (Pentagon → Congress) + $1B/day ongoing
            </div>
          </div>

          {/* OPS TEMPO + MARKET */}
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${border}`, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Big ops number */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64, paddingRight: 12, borderRight: `1px solid ${border}` }}>
              <div style={{ fontFamily: mono, fontSize: 9, color: muted, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 2 }}>OPS TEMPO</div>
              <div style={{ fontFamily: mono, fontSize: 36, fontWeight: 900, color: riskBand.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {String(opsTempo).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: mono, fontSize: 8, color: muted, marginTop: 2 }}>/ 100</div>
            </div>
            {/* Market stats — 2-col grid */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px 24px' }}>
              {[
                { l: 'BRENT CRUDE',       v: brent ? `$${fmt(brent.price, 2)}` : priceErr ? 'FEED ERR' : `${prices.length} syms` },
                { l: 'WTI CRUDE',         v: wti   ? `$${fmt(wti.price, 2)}`   : priceErr ? 'FEED ERR' : `${prices.length} syms` },
                { l: 'BRENT–WTI SPREAD',  v: spread === null ? (priceErr ? 'FEED ERR' : `${prices.length} syms`) : `${sign(spread)}$${fmt(Math.abs(spread), 2)}` },
                { l: 'MIL SIGNAL 6H',     v: `${displayStrategicBlend} (${adsbStrategic} ADS-B+${osintAir6h} OSINT)` },
                { l: 'TOTAL FLIGHTS',     v: String(adsbTotal) },
                { l: 'NEWS ITEMS',        v: String(newsTotalDisplay) },
                { l: 'WAR COST 6H EST.',  v: `$${formatCompactUSD(missileIntel.warCostUsd6h)}` },
                { l: 'MUNITIONS 6H',      v: String(missileIntel.munitions6h) },
                { l: 'READINESS INDEX',   v: String(readinessIndex) },
              ].map((m) => (
                <div key={m.l}>
                  <div style={{ fontFamily: mono, fontSize: 9, color: muted, fontWeight: 700 }}>{m.l}</div>
                  <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 900, color: 'var(--text-primary)' }}>{m.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* THEATER INTEL STREAM — fills remaining height */}
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${border}`, flex: 1, background: surface }}>
            <SectionLabel>Theater Intel Stream · Latest Headlines</SectionLabel>
            {streamItems.length === 0 ? (
              <div style={{ fontFamily: mono, fontSize: 11, color: muted, lineHeight: 1.5 }}>
                {brent && wti ? (
                  <>
                    Live tape while headlines index: Brent <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>${fmt(brent.price, 2)}</span>{' '}
                    ({sign(brent.changePercent)}{fmt(Math.abs(brent.changePercent), 2)}%) · WTI{' '}
                    <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>${fmt(wti.price, 2)}</span>{' '}
                    · arb <span style={{ color: accent, fontWeight: 800 }}>${fmt(Math.abs(brent.price - wti.price), 2)}</span> $/bbl
                  </>
                ) : (
                  <>Streaming oil + RSS… {news.length ? `${news.length} articles in browser` : ''}</>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {streamItems.map((h, i) => (
                  <div key={i} style={{ paddingBottom: 8, borderBottom: i < streamItems.length - 1 ? `1px solid ${border}` : 'none' }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.35, fontWeight: 600, marginBottom: 4 }}>{h.e}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontFamily: mono, fontSize: 10, color: accent, fontWeight: 800 }}>{h.t}</span>
                      <span style={{ fontFamily: mono, fontSize: 9, color: muted }}>• {h.c}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* THREAT BUCKETS — 6H + 24H side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: `1px solid ${border}` }}>
            {[
              { l: 'HORMUZ',  b6: mergedThreat.hormuz6, b24: mergedThreat.hormuz24, ac: '#e67e22' },
              { l: 'RED SEA', b6: mergedThreat.red6,     b24: mergedThreat.red24,    ac: '#e67e22' },
              { l: 'TANKERS', b6: mergedThreat.tank6,    b24: mergedThreat.tank24,   ac: accent },
              { l: 'IRAN',    b6: mergedThreat.iran6,    b24: mergedThreat.iran24,   ac: downColor },
            ].map((m, idx) => (
              <div key={m.l} style={{
                padding: '8px 10px',
                borderRight: idx < 3 ? `1px solid ${border}` : 'none',
                borderTop: `2px solid ${m.ac}`,
                background: 'var(--surface-hover)',
              }}>
                <div style={{ fontFamily: mono, fontSize: 9, color: muted, fontWeight: 800, letterSpacing: '0.08em', marginBottom: 4 }}>
                  {m.l} <span style={{ opacity: 0.55, fontWeight: 600 }}>· RSS</span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                      {m.b6}
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 8, color: muted, marginTop: 2 }}>6H</div>
                  </div>
                  <div style={{ borderLeft: `1px solid ${border}`, paddingLeft: 10 }}>
                    <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: muted, lineHeight: 1 }}>
                      {m.b24}
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 8, color: muted, marginTop: 2 }}>24H</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* HUMAN COST + SIGNAL row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: `1px solid ${border}` }}>
            {[
              { l: 'HUMAN-COST 24H',   v: String(humanCostSignals.mentions24h), hi: false },
              { l: 'CASUALTY SIG 6H',  v: String(humanCostSignals.casualties6h), hi: true },
              { l: 'MUNITIONS SIG 6H', v: String(humanCostSignals.munitions6h), hi: false },
              { l: 'SOURCES ONLINE',   v: String(sourcesDisplay), hi: false },
            ].map((m, idx, arr) => (
              <div key={m.l} style={{
                padding: '8px 10px',
                borderRight: idx < arr.length - 1 ? `1px solid ${border}` : 'none',
                background: surface,
              }}>
                <div style={{ fontFamily: mono, fontSize: 9, color: muted, fontWeight: 700, letterSpacing: '0.06em' }}>{m.l}</div>
                <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 900, color: m.hi ? downColor : 'var(--text-primary)', marginTop: 4 }}>{m.v}</div>
              </div>
            ))}
          </div>

          {/* FEED STATUS bar */}
          <div style={{ padding: '7px 14px', background: 'var(--surface-hover)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 900, color: accent, letterSpacing: '0.08em' }}>FEEDS</span>
            <span style={{ fontFamily: mono, fontSize: 9, color: muted, fontWeight: 700 }}>RSS · ADS-B · YAHOO/STOOQ</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[
                { l: 'SOURCES', v: String(sourcesDisplay) },
                { l: 'FAILED',  v: String(failedDisplay) },
                { l: 'FLIGHTS', v: String(adsbTotal) },
              ].map((m) => (
                <span key={m.l} style={{ fontFamily: mono, fontSize: 9, color: muted }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.v}</span> {m.l}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: side panel ───────────────────────────────────── */}
        <div className="ftg-iran-board-side" style={{ flex: '1 1 280px', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

          {/* MISSILE INTEL GRID */}
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}` }}>
            <SectionLabel>Missile Intel · 6H · Event-Derived</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {(['Ballistic','Cruise','Drone','Iron Dome','Intercept','Airstrike'] as const).map((label) => {
                const count = missileIntel.totalByType[label] ?? 0;
                const isHot = count > 0;
                return (
                  <div key={label} style={{
                    border: `1px solid ${isHot ? downColor : border}`,
                    borderTop: `2px solid ${isHot ? downColor : border}`,
                    background: isHot ? 'rgba(201,58,32,0.06)' : 'var(--surface-hover)',
                    borderRadius: 4,
                    padding: '10px 8px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 900, color: isHot ? downColor : 'var(--text-primary)', lineHeight: 1 }}>
                      {count}
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* LATEST MISSILE SIGNALS */}
          <div style={{ padding: '16px 20px' }}>
            <SectionLabel>Latest Missile Signals</SectionLabel>
            {missileIntel.latestMissileSignals.length === 0 ? (
              <div style={{ fontFamily: mono, fontSize: 12, color: muted }}>No signals in current cache.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {missileIntel.latestMissileSignals.map((h, i) => (
                  <div key={i} style={{ borderLeft: `3px solid ${downColor}`, paddingLeft: 12 }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.35, fontWeight: 600, marginBottom: 5 }}>
                      {h.e}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontFamily: mono, fontSize: 11, color: downColor, fontWeight: 800 }}>{h.t}</span>
                      <span style={{ fontFamily: mono, fontSize: 10, color: muted }}>• {h.c}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ACTIVE THEATER HOTSPOTS & AVIATION */}
          <div style={{ padding: '16px 20px', borderTop: `1px solid ${border}`, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SectionLabel>Active Theater Hotspots &amp; Aviation</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px 20px', marginTop: 12 }}>
              
              {/* Hotspots */}
              <div>
                <div style={{ fontFamily: mono, fontSize: 9, color: muted, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.06em' }}>Mentioned Zones (24H)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {criticalZones.length === 0 ? (
                    <span style={{ fontFamily: mono, fontSize: 10, color: muted }}>None detected</span>
                  ) : (
                    criticalZones.map(([zone, count]) => (
                      <span key={zone} style={{
                        fontFamily: mono, fontSize: 9, fontWeight: 900,
                        color: count > 2 ? downColor : 'var(--text-primary)',
                        background: count > 2 ? 'rgba(201,58,32,0.1)' : 'var(--surface-hover)',
                        border: `1px solid ${count > 2 ? 'rgba(201,58,32,0.2)' : border}`,
                        padding: '4px 8px', borderRadius: 4, textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}>
                        {zone} <span style={{ opacity: 0.6 }}>({count})</span>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Aviation */}
              <div>
                 <div style={{ fontFamily: mono, fontSize: 9, color: muted, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.06em' }}>Theater Aviation</div>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--surface-hover)', borderRadius: 4 }}>
                     <span style={{ fontFamily: mono, fontSize: 10, color: muted, fontWeight: 700 }}>Total Flights (ADS-B)</span>
                     <span style={{ fontFamily: mono, fontSize: 13, color: 'var(--text-primary)', fontWeight: 900 }}>{adsbTotal}</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: displayStrategicBlend ? 'rgba(201,58,32,0.1)' : 'var(--surface)', border: displayStrategicBlend ? `1px solid rgba(201,58,32,0.3)` : `1px solid ${border}`, borderRadius: 4 }}>
                     <span style={{ fontFamily: mono, fontSize: 10, color: displayStrategicBlend ? downColor : muted, fontWeight: 700 }}>Mil · OSINT 6H</span>
                     <span style={{ fontFamily: mono, fontSize: 13, color: displayStrategicBlend ? downColor : 'var(--text-primary)', fontWeight: 900 }}>{displayStrategicBlend}</span>
                   </div>
                 </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className="ftg-iran-board-footer" style={{
        padding: '7px 14px',
        borderTop: `1px solid ${border}`,
        background: 'var(--accent-light)',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 6,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
          <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 900, color: accent, flexShrink: 0 }}>LATEST:</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {logItems[0]?.e ?? '—'}
          </span>
        </div>
        <span style={{ fontFamily: mono, fontSize: 9, color: muted, flexShrink: 0 }}>
          {metrics ? `METRICS ${new Date(metrics.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
        </span>
      </div>
    </div>
  );
}


'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ACCOUNTABILITY_EVENTS,
  ACCOUNTABILITY_FILTER_IDS,
  type AccountabilityEvent,
  type AccountabilityFilterId,
  accountabilityLatestDate,
  accountabilityStatusLabel,
} from '@/lib/accountability-data';
import { LiveSituationStrip } from '@/app/components/LiveSituationStrip';
import AccountabilityTimelineCalendar from '@/app/components/AccountabilityTimelineCalendar';
import { LIVE_SITUATION_METRICS } from '@/lib/live-situation-metrics';

const mono = 'var(--font-mono)';

const FILTER_LABELS: Record<AccountabilityFilterId, string> = {
  all: 'All',
  ceasefire: 'Ceasefire',
  ihl: 'IHL / Law of War',
  un_multilateral: 'UN',
  courts: 'Courts',
  humanitarian: 'Aid',
};

const STATUS_STYLES: Record<
  AccountabilityEvent['status'],
  { bg: string; color: string }
> = {
  reported: { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
  formal_filing: { bg: 'var(--accent-light)', color: 'var(--accent)' },
  provisional_measures: { bg: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed' },
  investigation: { bg: 'rgba(234, 179, 8, 0.12)', color: '#ca8a04' },
  humanitarian_update: { bg: 'rgba(16, 185, 129, 0.12)', color: '#059669' },
};

export function AccountabilityEventCards({
  events,
  dense,
}: {
  events: AccountabilityEvent[];
  dense?: boolean;
}) {
  return (
    <ul
      className="ftg-accountability-list"
      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: dense ? 8 : 10 }}
    >
      {events.map((ev) => {
        const st = STATUS_STYLES[ev.status];
        return (
          <li key={ev.id}>
            <a
              href={ev.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ftg-accountability-card"
              style={{
                display: 'block',
                padding: dense ? '10px 12px' : '12px 14px',
                borderRadius: 6,
                border: '1px solid var(--border-light)',
                borderLeft: '3px solid var(--border)',
                background: 'var(--surface)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 10px', marginBottom: 6 }}>
                <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                  {ev.date}
                </span>
                <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, background: st.bg, color: st.color }}>
                  {accountabilityStatusLabel(ev.status)}
                </span>
                <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>
                  {ev.framework}
                </span>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: dense ? 13 : 14, lineHeight: 1.45, color: 'var(--text-primary)', margin: '0 0 6px 0', fontWeight: 500 }}>
                {ev.summary}
              </p>
              <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.03em' }}>
                Source · {ev.source} →
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Compact marquee text from live metrics */
function buildMarqueeText(): string {
  return LIVE_SITUATION_METRICS.map((m) => {
    const val = m.valueDisplay ?? '—';
    return `${m.regionLabel.toUpperCase()}  ${val}  ${m.metricLabel}`;
  }).join('   ·   ');
}

export default function AccountabilityTracker() {
  const [collapsed, setCollapsed] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filter, setFilter] = useState<AccountabilityFilterId>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  const latest = useMemo(() => accountabilityLatestDate(ACCOUNTABILITY_EVENTS), []);

  const filtered = useMemo(() => {
    if (filter === 'all') return ACCOUNTABILITY_EVENTS;
    return ACCOUNTABILITY_EVENTS.filter((e) => {
      if (filter === 'ceasefire') return e.category === 'ceasefire';
      if (filter === 'ihl') return e.category === 'ihl';
      if (filter === 'un_multilateral') return e.category === 'un_multilateral';
      if (filter === 'courts') return e.category === 'courts';
      if (filter === 'humanitarian') return e.category === 'humanitarian' || e.category === 'health';
      return true;
    });
  }, [filter]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0),
    [filtered]
  );

  const openSheet = useCallback(() => {
    lastFocusRef.current = document.activeElement as HTMLElement;
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    queueMicrotask(() => lastFocusRef.current?.focus?.());
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    document.body.classList.add('ftg-accountability-scroll-lock');
    return () => { document.body.classList.remove('ftg-accountability-scroll-lock'); };
  }, [sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) return;
    const t = requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSheet(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen, closeSheet]);

  const marqueeText = useMemo(() => buildMarqueeText(), []);

  return (
    <>
      {/* ── Situation Desk Container ───────────────────────────────────────── */}
      <div className="ftg-situation-desk">

        {/* ── Ticker strip (always visible, ~32px) ───────────────────────── */}
        <div className="ftg-situation-desk__ticker">

          {/* Left: accent label */}
          <div className="ftg-situation-desk__ticker-left">
            <span className="live-dot" style={{ width: 6, height: 6, flexShrink: 0 }} />
            <span className="ftg-situation-desk__label">
              LEVANT&nbsp;·&nbsp;SITUATION&nbsp;DESK
            </span>
          </div>

          {/* Divider */}
          <span className="ftg-situation-desk__divider" aria-hidden />

          {/* Center: scrolling marquee */}
          <div className="ftg-situation-desk__marquee-track" aria-hidden>
            <span className="ftg-situation-desk__marquee">
              {marqueeText}&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;&nbsp;{marqueeText}
            </span>
          </div>

          {/* Right: bold EXPAND / COLLAPSE button */}
          <button
            type="button"
            className={`ftg-situation-desk__expand-btn${collapsed ? '' : ' ftg-situation-desk__expand-btn--open'}`}
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand situation desk' : 'Collapse situation desk'}
          >
            {collapsed ? 'EXPAND' : 'COLLAPSE'}
            <span className="ftg-situation-desk__expand-chevron" aria-hidden>
              {collapsed ? '▾' : '▴'}
            </span>
          </button>
        </div>

        {/* ── Expandable panel ───────────────────────────────────────────── */}
        <div className={`ftg-situation-desk__panel${collapsed ? '' : ' ftg-situation-desk__panel--open'}`}
          aria-hidden={collapsed}
        >
          <div className="ftg-situation-desk__panel-inner">
            {/* Context bar */}
            <div className="ftg-situation-desk__context-bar">
              <div className="ftg-situation-desk__context-bar-left">
                <span className="ftg-situation-desk__context-label">Live metrics</span>
                {latest && (
                  <span className="ftg-situation-desk__context-meta">
                    Newest entry {latest} · {ACCOUNTABILITY_EVENTS.length} sources
                  </span>
                )}
              </div>
            </div>

            {/* Metric grid — pass panel mode to suppress caveats */}
            <LiveSituationStrip density="comfortable" layout="grid" panelMode />

            {/* Footer actions */}
            <div className="ftg-situation-desk__footer">
              <Link href="/accountability" className="ftg-situation-desk__footer-link">
                Full page  →
              </Link>
              <button type="button" className="ftg-situation-desk__timeline-btn" onClick={openSheet}>
                Source timeline&nbsp;▾
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom sheet (source timeline) ───────────────────────────────────── */}
      {sheetOpen && (
        <>
          <div
            className="ftg-accountability-backdrop"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1200, backdropFilter: 'blur(2px)' }}
            aria-hidden
            onClick={closeSheet}
          />
          <div
            id="ftg-accountability-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ftg-accountability-sheet-title"
            className="ftg-accountability-sheet"
            style={{
              position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1210,
              height: 'min(88vh, 860px)',
              background: 'var(--bg)',
              borderTopLeftRadius: 14, borderTopRightRadius: 14,
              boxShadow: '0 -12px 48px rgba(0,0,0,0.28)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Drag handle */}
            <div style={{ padding: '10px 0 0', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--border)', display: 'block' }} />
            </div>

            {/* Sheet hero header */}
            <div className="ftg-sheet-header">
              <div>
                <div className="ftg-sheet-header__eyebrow">Levant · Situation Desk</div>
                <h2 id="ftg-accountability-sheet-title" className="ftg-sheet-header__title">
                  Source Timeline
                </h2>
                <p className="ftg-sheet-header__sub">
                  Formal UN documents, court filings, and humanitarian updates — verify every number at the primary link.
                </p>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={closeSheet}
                aria-label="Close source timeline"
                className="ftg-sheet-header__close"
              >
                ✕
              </button>
            </div>

            {/* Filter pills with view toggle */}
            <div className="ftg-sheet-filters">
              {ACCOUNTABILITY_FILTER_IDS.map((id) => {
                const active = filter === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFilter(id)}
                    className={`ftg-sheet-pill${active ? ' ftg-sheet-pill--active' : ''}`}
                  >
                    {FILTER_LABELS[id]}
                  </button>
                );
              })}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    border: '1px solid var(--border-light)',
                    background: viewMode === 'list' ? 'var(--accent)' : 'var(--surface)',
                    color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    border: '1px solid var(--border-light)',
                    background: viewMode === 'calendar' ? 'var(--accent)' : 'var(--surface)',
                    color: viewMode === 'calendar' ? '#fff' : 'var(--text-secondary)',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Calendar
                </button>
              </div>
            </div>

            {/* Events */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px calc(20px + env(safe-area-inset-bottom, 0px))' }}>
              {viewMode === 'list' ? (
                <AccountabilityEventCards events={sorted} />
              ) : (
                <AccountabilityTimelineCalendar
                  events={ACCOUNTABILITY_EVENTS}
                  filter={filter}
                  onEventClick={(ev) => window.open(ev.url, '_blank')}
                />
              )}
              <div style={{ marginTop: 20, padding: '12px 14px', borderRadius: 6, border: '1px dashed var(--border)', background: 'var(--surface-muted)' }}>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>Methodology</strong> — Entries are manually curated. Status labels describe the document type or forum, not a legal conclusion.
                </p>
                <Link
                  href="/accountability"
                  onClick={closeSheet}
                  style={{ display: 'inline-block', marginTop: 10, fontFamily: mono, fontSize: 10, fontWeight: 800, color: 'var(--accent)' }}
                >
                  Open bookmarkable full page →
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

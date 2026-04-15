'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ACCOUNTABILITY_EVENTS,
  ACCOUNTABILITY_FILTER_IDS,
  type AccountabilityFilterId,
  accountabilityLatestDate,
} from '@/lib/accountability-data';
import { AccountabilityEventCards } from '@/app/components/AccountabilityTracker';
import AccountabilityTimelineCalendar from '@/app/components/AccountabilityTimelineCalendar';
import { LiveSituationStrip } from '@/app/components/LiveSituationStrip';

const mono = 'var(--font-mono)';

const FILTER_LABELS: Record<AccountabilityFilterId, string> = {
  all: 'All',
  ceasefire: 'Ceasefire',
  ihl: 'IHL / Law of War',
  un_multilateral: 'UN',
  courts: 'Courts',
  humanitarian: 'Aid',
};

export default function AccountabilityFullPage() {
  const [filter, setFilter] = useState<AccountabilityFilterId>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const latest = useMemo(() => accountabilityLatestDate(ACCOUNTABILITY_EVENTS), []);

  const sorted = useMemo(() => {
    const filtered =
      filter === 'all'
        ? ACCOUNTABILITY_EVENTS
        : ACCOUNTABILITY_EVENTS.filter((e) => {
            if (filter === 'ceasefire') return e.category === 'ceasefire';
            if (filter === 'ihl') return e.category === 'ihl';
            if (filter === 'un_multilateral') return e.category === 'un_multilateral';
            if (filter === 'courts') return e.category === 'courts';
            if (filter === 'humanitarian') return e.category === 'humanitarian' || e.category === 'health';
            return true;
          });
    return [...filtered].sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  }, [filter]);

  return (
    <div className="ftg-full-page">

      {/* ── Page hero header ─────────────────────────────────────────── */}
      <div className="ftg-full-page__hero">
        <div className="ftg-full-page__hero-inner">
          {/* Breadcrumb */}
          <div className="ftg-full-page__breadcrumb">
            <Link href="/" className="ftg-full-page__breadcrumb-link">
              ← FrameTheGlobe
            </Link>
            <span className="ftg-full-page__breadcrumb-sep" aria-hidden>/</span>
            <span className="ftg-full-page__breadcrumb-current">Situation Desk</span>
          </div>

          <div className="ftg-full-page__hero-body">
            <div>
              <h1 className="ftg-full-page__hero-title">
                Levant · Situation Desk
              </h1>
              <p className="ftg-full-page__hero-sub">
                Live editorial figures and a citable source timeline — UN documents, court filings,
                and humanitarian updates. Verify every number at the primary link.
              </p>
            </div>
            {latest && (
              <div className="ftg-full-page__hero-meta">
                <span className="ftg-full-page__hero-meta-label">Newest entry</span>
                <span className="ftg-full-page__hero-meta-value">{latest}</span>
                <span className="ftg-full-page__hero-meta-label">{ACCOUNTABILITY_EVENTS.length} links</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="ftg-full-page__body">

        {/* Live metrics card */}
        <div className="ftg-full-page__metrics-card">
          <LiveSituationStrip density="comfortable" layout="grid" />
        </div>

        {/* Source timeline section */}
        <div className="ftg-full-page__timeline-section">
          {/* Section header row */}
          <div className="ftg-full-page__timeline-header">
            <h2 className="ftg-full-page__timeline-title">Source Timeline</h2>

            {/* View toggle */}
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', marginRight: 16 }}>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 4,
                  border: '1px solid var(--border-light)',
                  background: viewMode === 'list' ? 'var(--accent)' : 'var(--surface)',
                  color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)',
                  fontSize: 11,
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
                  padding: '6px 12px',
                  borderRadius: 4,
                  border: '1px solid var(--border-light)',
                  background: viewMode === 'calendar' ? 'var(--accent)' : 'var(--surface)',
                  color: viewMode === 'calendar' ? '#fff' : 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Calendar
              </button>
            </div>

            {/* Filter pills */}
            <div className="ftg-full-page__filters">
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
            </div>
          </div>

          {viewMode === 'list' ? (
            <AccountabilityEventCards events={sorted} />
          ) : (
            <AccountabilityTimelineCalendar
              events={ACCOUNTABILITY_EVENTS}
              filter={filter}
              onEventClick={(ev) => window.open(ev.url, '_blank')}
            />
          )}

          {/* Methodology */}
          <div className="ftg-full-page__methodology">
            <p className="ftg-full-page__methodology-text">
              <strong>Methodology</strong> — Entries are
              manually curated with external links. Status labels describe the document type or
              forum, not a legal conclusion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

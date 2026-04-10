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

  const latest = useMemo(
    () => accountabilityLatestDate(ACCOUNTABILITY_EVENTS),
    []
  );

  const sorted = useMemo(() => {
    const filtered =
      filter === 'all'
        ? ACCOUNTABILITY_EVENTS
        : ACCOUNTABILITY_EVENTS.filter((e) => {
            if (filter === 'ceasefire') return e.category === 'ceasefire';
            if (filter === 'ihl') return e.category === 'ihl';
            if (filter === 'un_multilateral')
              return e.category === 'un_multilateral';
            if (filter === 'courts') return e.category === 'courts';
            if (filter === 'humanitarian')
              return (
                e.category === 'humanitarian' || e.category === 'health'
              );
            return true;
          });
    return [...filtered].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0
    );
  }, [filter]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text-primary)',
      }}
    >
      {/* ── Page header bar ────────────────────────────────────────────── */}
      <div
        className="widget-hd"
        style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          position: 'sticky',
          top: 0,
          zIndex: 80,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            href="/"
            style={{
              fontFamily: mono,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ← FrameTheGlobe
          </Link>
          <span style={{ color: 'var(--border)', fontSize: 12 }}>/</span>
          <span
            className="widget-hd-title"
            style={{
              fontFamily: mono,
              color: 'var(--accent)',
            }}
          >
            Levant · Situation Desk
          </span>
        </div>
        {latest && (
          <span
            style={{
              fontFamily: mono,
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
            }}
          >
            Newest entry {latest} · {ACCOUNTABILITY_EVENTS.length} links
          </span>
        )}
      </div>

      <div
        style={{
          maxWidth: 860,
          margin: '0 auto',
          padding: '24px 16px calc(40px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* ── Intro ──────────────────────────────────────────────────── */}
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            margin: '0 0 20px',
            maxWidth: 600,
          }}
        >
          Live editorial figures and a citable source timeline — UN documents,
          court filings, and humanitarian updates. Verify every number at the
          primary link.
        </p>

        {/* ── Live metrics grid ──────────────────────────────────────── */}
        <div
          style={{
            marginBottom: 28,
            padding: '18px 18px 14px',
            borderRadius: 10,
            border: '1px solid var(--border-light)',
            background: 'var(--surface)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <LiveSituationStrip density="comfortable" layout="grid" />
        </div>

        {/* ── Source timeline ────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 14,
          }}
        >
          <h2
            style={{
              fontFamily: mono,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              margin: 0,
            }}
          >
            Source timeline
          </h2>

          {/* Filter pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ACCOUNTABILITY_FILTER_IDS.map((id) => {
              const active = filter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  style={{
                    fontFamily: mono,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    padding: '7px 12px',
                    minHeight: 36,
                    borderRadius: 999,
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-light)'}`,
                    background: active ? 'var(--accent)' : 'var(--surface)',
                    color: active ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                  }}
                >
                  {FILTER_LABELS[id]}
                </button>
              );
            })}
          </div>
        </div>

        <AccountabilityEventCards events={sorted} />

        {/* ── Methodology note ──────────────────────────────────────── */}
        <div
          style={{
            marginTop: 24,
            padding: '14px 16px',
            borderRadius: 8,
            border: '1px dashed var(--border)',
            background: 'var(--surface-muted)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.55,
              color: 'var(--text-muted)',
            }}
          >
            <strong style={{ color: 'var(--text-secondary)' }}>
              Methodology
            </strong>{' '}
            — Entries are manually curated with external links. Status labels
            describe the document type or forum, not a legal conclusion. Suggest
            additions via your editorial process.
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ACCOUNTABILITY_EVENTS,
  ACCOUNTABILITY_FILTER_IDS,
  type AccountabilityFilterId,
} from '@/lib/accountability-data';
import { AccountabilityEventCards } from '@/app/components/AccountabilityTracker';

const mono = 'var(--font-mono)';

const FILTER_LABELS: Record<AccountabilityFilterId, string> = {
  all: 'All',
  ceasefire: 'Ceasefire',
  ihl: 'IHL / law of war',
  un_multilateral: 'UN',
  courts: 'Courts',
  humanitarian: 'Aid',
};

export default function AccountabilityFullPage() {
  const [filter, setFilter] = useState<AccountabilityFilterId>('all');

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
        padding: '20px 16px calc(28px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link
          href="/"
          style={{
            fontFamily: mono,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.06em',
            color: 'var(--accent)',
            textDecoration: 'none',
            display: 'inline-block',
            marginBottom: 18,
          }}
        >
          ← Home
        </Link>
        <h1
          style={{
            fontFamily: mono,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            margin: '0 0 8px',
          }}
        >
          Levant accountability tracker
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
            margin: '0 0 18px',
            maxWidth: 62 * 13,
          }}
        >
          Bookmarkable list of citable sources: UN, courts, humanitarian
          updates, and NGO hubs. Status labels describe document types, not
          legal outcomes.
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 18,
          }}
        >
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
                  padding: '10px 14px',
                  minHeight: 44,
                  borderRadius: 999,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border-light)'}`,
                  background: active ? 'var(--accent)' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                {FILTER_LABELS[id]}
              </button>
            );
          })}
        </div>
        <AccountabilityEventCards events={sorted} />
      </div>
    </div>
  );
}

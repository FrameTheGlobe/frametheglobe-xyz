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

const mono = 'var(--font-mono)';

const FILTER_LABELS: Record<AccountabilityFilterId, string> = {
  all: 'All',
  ceasefire: 'Ceasefire',
  ihl: 'IHL / law of war',
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
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: dense ? 8 : 10,
      }}
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
                background: 'var(--surface)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  gap: '6px 10px',
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                  }}
                >
                  {ev.date}
                </span>
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: st.bg,
                    color: st.color,
                  }}
                >
                  {accountabilityStatusLabel(ev.status)}
                </span>
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 10,
                    color: 'var(--accent)',
                    fontWeight: 700,
                  }}
                >
                  {ev.framework}
                </span>
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: dense ? 13 : 14,
                  lineHeight: 1.45,
                  color: 'var(--text-primary)',
                  margin: '0 0 6px 0',
                  fontWeight: 500,
                }}
              >
                {ev.summary}
              </p>
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                }}
              >
                Source · {ev.source} →
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export default function AccountabilityTracker() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<AccountabilityFilterId>('all');
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  const latest = useMemo(
    () => accountabilityLatestDate(ACCOUNTABILITY_EVENTS),
    []
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return ACCOUNTABILITY_EVENTS;
    return ACCOUNTABILITY_EVENTS.filter((e) => {
      if (filter === 'ceasefire') return e.category === 'ceasefire';
      if (filter === 'ihl') return e.category === 'ihl';
      if (filter === 'un_multilateral') return e.category === 'un_multilateral';
      if (filter === 'courts') return e.category === 'courts';
      if (filter === 'humanitarian')
        return e.category === 'humanitarian' || e.category === 'health';
      return true;
    });
  }, [filter]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        a.date < b.date ? 1 : a.date > b.date ? -1 : 0
      ),
    [filtered]
  );

  const openSheet = useCallback(() => {
    lastFocusRef.current = document.activeElement as HTMLElement;
    setOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setOpen(false);
    queueMicrotask(() => lastFocusRef.current?.focus?.());
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add('ftg-accountability-scroll-lock');
    return () => {
      document.body.classList.remove('ftg-accountability-scroll-lock');
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeSheet]);

  return (
    <>
      <div
        className="ftg-accountability-rail"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-muted)',
        }}
      >
        <div
          className="ftg-accountability-rail-inner"
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '8px 14px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            className="ftg-accountability-rail-head"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontFamily: mono,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                flexShrink: 0,
              }}
            >
              Levant · situation desk
            </span>
            <span
              className="ftg-accountability-desc"
              style={{
                flex: '1 1 160px',
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                lineHeight: 1.4,
                color: 'var(--text-secondary)',
                minWidth: 0,
              }}
            >
              Live editorial figures + citable timeline (UN, courts, aid).
              Expand for filters and full source list.
              {latest && (
                <span
                  style={{
                    display: 'block',
                    fontFamily: mono,
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    marginTop: 2,
                    letterSpacing: '0.04em',
                  }}
                >
                  Newest timeline entry {latest} · {ACCOUNTABILITY_EVENTS.length}{' '}
                  links
                </span>
              )}
            </span>
            <div
              className="ftg-accountability-rail-controls"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginLeft: 'auto',
                flexShrink: 0,
              }}
            >
              <Link
                href="/accountability"
                className="ftg-accountability-quiet-link"
                style={{
                  fontFamily: mono,
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textDecoration: 'none',
                  padding: '8px 6px',
                }}
              >
                Full page
              </Link>
              <button
                type="button"
                className="ftg-accountability-expand-btn"
                onClick={openSheet}
                aria-expanded={open}
                aria-controls="ftg-accountability-sheet"
                style={{
                  fontFamily: mono,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '10px 14px',
                  borderRadius: 4,
                  border: '1px solid var(--accent)',
                  background: 'var(--accent)',
                  color: '#fff',
                  cursor: 'pointer',
                  minHeight: 44,
                  touchAction: 'manipulation',
                }}
              >
                Expand ▾
              </button>
            </div>
          </div>

          <LiveSituationStrip density="compact" layout="scroll" />
        </div>
      </div>

      {open && (
        <>
          <div
            className="ftg-accountability-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 1200,
            }}
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
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1210,
              maxHeight: 'min(92vh, 900px)',
              background: 'var(--bg)',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              className="ftg-accountability-sheet-handle"
              style={{
                padding: '10px 0 4px',
                display: 'flex',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 999,
                  background: 'var(--border)',
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                padding: '0 16px 12px',
                borderBottom: '1px solid var(--border-light)',
                flexShrink: 0,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <h2
                  id="ftg-accountability-sheet-title"
                  style={{
                    fontFamily: mono,
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--accent)',
                    margin: 0,
                  }}
                >
                  Situation desk
                </h2>
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.45,
                  }}
                >
                  Editorial live figures (source-cited) plus a curated timeline
                  of formal documents and humanitarian hubs — verify every number
                  at the primary link.
                </p>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={closeSheet}
                aria-label="Close accountability panel"
                style={{
                  flexShrink: 0,
                  minWidth: 44,
                  minHeight: 44,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontFamily: mono,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: '0 16px 14px',
                flexShrink: 0,
                borderBottom: '1px solid var(--border-light)',
                background: 'var(--surface-muted)',
              }}
            >
              <LiveSituationStrip density="comfortable" layout="scroll" />
            </div>

            <div
              className="ftg-accountability-filter-row"
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-light)',
                overflowX: 'auto',
                flexShrink: 0,
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  gap: 6,
                  paddingBottom: 2,
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
                        padding: '8px 12px',
                        minHeight: 40,
                        borderRadius: 999,
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-light)'}`,
                        background: active ? 'var(--accent)' : 'var(--surface)',
                        color: active ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        touchAction: 'manipulation',
                      }}
                    >
                      {FILTER_LABELS[id]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 14px calc(14px + env(safe-area-inset-bottom, 0px))',
              }}
            >
              <p
                style={{
                  fontFamily: mono,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  margin: '0 0 10px',
                }}
              >
                Source timeline
              </p>
              <AccountabilityEventCards events={sorted} />
              <div
                style={{
                  marginTop: 20,
                  padding: '12px 14px',
                  borderRadius: 6,
                  border: '1px dashed var(--border)',
                  background: 'var(--surface-muted)',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: 'var(--text-muted)',
                  }}
                >
                  <strong style={{ color: 'var(--text-secondary)' }}>
                    Methodology
                  </strong>{' '}
                  — Entries are manually curated with external links. Status
                  labels describe the type of document or forum, not a legal
                  conclusion. Suggest additions via your editorial process.
                </p>
                <Link
                  href="/accountability"
                  onClick={closeSheet}
                  style={{
                    display: 'inline-block',
                    marginTop: 10,
                    fontFamily: mono,
                    fontSize: 10,
                    fontWeight: 800,
                    color: 'var(--accent)',
                  }}
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

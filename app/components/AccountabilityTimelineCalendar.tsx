'use client';

import { useMemo, useState } from 'react';
import {
  ACCOUNTABILITY_EVENTS,
  type AccountabilityEvent,
  type AccountabilityFilterId,
  accountabilityStatusLabel,
} from '@/lib/accountability-data';

const mono = 'var(--font-mono)';

const STATUS_STYLES: Record<
  AccountabilityEvent['status'],
  { bg: string; color: string; border: string }
> = {
  reported: { bg: 'var(--surface-muted)', color: 'var(--text-secondary)', border: 'var(--border-light)' },
  formal_filing: { bg: 'var(--accent-light)', color: 'var(--accent)', border: 'var(--accent)' },
  provisional_measures: { bg: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed', border: '#7c3aed' },
  investigation: { bg: 'rgba(234, 179, 8, 0.12)', color: '#ca8a04', border: '#ca8a04' },
  humanitarian_update: { bg: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '#059669' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getYearMonth(dateStr: string): { year: number; month: number; day: number } {
  const d = new Date(dateStr);
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function getEventPosition(dateStr: string, yearStart: Date): { left: number; width: number } {
  const eventDate = new Date(dateStr);
  const yearEnd = new Date(yearStart.getFullYear() + 1, 0, 1);
  const totalMs = yearEnd.getTime() - yearStart.getTime();
  const eventMs = eventDate.getTime() - yearStart.getTime();
  const left = (eventMs / totalMs) * 100;
  // Width based on event duration (default 2% for single day events)
  const width = 2;
  return { left: Math.max(0, Math.min(98, left)), width };
}

function getMonthPositions(year: number): Array<{ month: number; left: number; width: number }> {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const totalMs = yearEnd.getTime() - yearStart.getTime();
  
  return MONTHS.map((_, idx) => {
    const monthStart = new Date(year, idx, 1);
    const monthEnd = new Date(year, idx + 1, 1);
    const left = ((monthStart.getTime() - yearStart.getTime()) / totalMs) * 100;
    const width = ((monthEnd.getTime() - monthStart.getTime()) / totalMs) * 100;
    return { month: idx, left, width };
  });
}

function getYearsFromEvents(events: AccountabilityEvent[]): number[] {
  const years = new Set<number>();
  events.forEach(ev => {
    const { year } = getYearMonth(ev.date);
    years.add(year);
  });
  return Array.from(years).sort((a, b) => b - a); // Descending
}

function groupEventsByYear(events: AccountabilityEvent[]): Map<number, AccountabilityEvent[]> {
  const grouped = new Map<number, AccountabilityEvent[]>();
  events.forEach(ev => {
    const { year } = getYearMonth(ev.date);
    if (!grouped.has(year)) {
      grouped.set(year, []);
    }
    grouped.get(year)!.push(ev);
  });
  return grouped;
}

export default function AccountabilityTimelineCalendar({
  events = ACCOUNTABILITY_EVENTS,
  filter = 'all' as AccountabilityFilterId,
  onEventClick,
}: {
  events?: AccountabilityEvent[];
  filter?: AccountabilityFilterId;
  onEventClick?: (event: AccountabilityEvent) => void;
}) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<AccountabilityEvent | null>(null);

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) => {
      if (filter === 'ceasefire') return e.category === 'ceasefire';
      if (filter === 'ihl') return e.category === 'ihl';
      if (filter === 'un_multilateral') return e.category === 'un_multilateral';
      if (filter === 'courts') return e.category === 'courts';
      if (filter === 'humanitarian') return e.category === 'humanitarian' || e.category === 'health';
      return true;
    });
  }, [events, filter]);

  const years = useMemo(() => getYearsFromEvents(filteredEvents), [filteredEvents]);
  const groupedEvents = useMemo(() => groupEventsByYear(filteredEvents), [filteredEvents]);
  
  const activeYear = selectedYear ?? years[0] ?? new Date().getFullYear();
  const yearEvents = groupedEvents.get(activeYear) || [];
  const monthPositions = useMemo(() => getMonthPositions(activeYear), [activeYear]);

  return (
    <div style={{ fontFamily: mono, fontSize: 12 }}>
      {/* Year selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {years.map(year => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            style={{
              padding: '6px 12px',
              borderRadius: 4,
              border: '1px solid var(--border-light)',
              background: activeYear === year ? 'var(--accent)' : 'var(--surface)',
              color: activeYear === year ? '#fff' : 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {year}
          </button>
        ))}
      </div>

      {/* Timeline header with months */}
      <div style={{ 
        position: 'relative', 
        height: 28, 
        borderBottom: '1px solid var(--border-light)',
        marginBottom: 12,
      }}>
        {monthPositions.map(({ month, left, width }) => (
          <div
            key={month}
            style={{
              position: 'absolute',
              left: `${left}%`,
              width: `${width}%`,
              top: 0,
              bottom: 0,
              borderLeft: month === 0 ? undefined : '1px solid var(--border-light)',
              paddingLeft: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>
              {MONTHS[month]}
            </span>
          </div>
        ))}
      </div>

      {/* Timeline grid */}
      <div style={{ position: 'relative', minHeight: 200 }}>
        {/* Month grid lines */}
        {monthPositions.map(({ left }) => (
          <div
            key={`line-${left}`}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: 'var(--border-light)',
              opacity: 0.5,
            }}
          />
        ))}

        {/* Event bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
          {yearEvents.map((ev, idx) => {
            const { left, width } = getEventPosition(ev.date, new Date(activeYear, 0, 1));
            const st = STATUS_STYLES[ev.status];
            
            return (
              <div
                key={ev.id}
                style={{
                  position: 'relative',
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {/* Event bar */}
                <div
                  onClick={() => onEventClick && onEventClick(ev)}
                  onMouseEnter={() => setHoveredEvent(ev)}
                  onMouseLeave={() => setHoveredEvent(null)}
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    width: 'max(120px, 12%)',
                    height: 24,
                    background: st.bg,
                    border: `1px solid ${st.border}`,
                    borderRadius: 4,
                    cursor: onEventClick ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    overflow: 'hidden',
                    transition: 'all 0.15s',
                    zIndex: hoveredEvent?.id === ev.id ? 10 : 1,
                    boxShadow: hoveredEvent?.id === ev.id ? '0 4px 12px rgba(0,0,0,0.15)' : undefined,
                  }}
                >
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: st.color,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {ev.framework}
                  </span>
                </div>

                {/* Event details row */}
                <div style={{ 
                  marginLeft: `calc(${left}% + max(120px, 12%) + 8px)`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {ev.date}
                  </span>
                  <span style={{ 
                    fontSize: 9, 
                    fontWeight: 700,
                    color: st.color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}>
                    {accountabilityStatusLabel(ev.status)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {yearEvents.length === 0 && (
          <div style={{ 
            padding: 40, 
            textAlign: 'center', 
            color: 'var(--text-muted)',
            fontSize: 13,
          }}>
            No events for {activeYear}
          </div>
        )}
      </div>

      {/* Selected event detail */}
      {hoveredEvent && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          left: 20,
          right: 20,
          maxWidth: 600,
          margin: '0 auto',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          zIndex: 100,
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            {hoveredEvent.date} · {hoveredEvent.framework}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            {hoveredEvent.summary}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
            <span style={{ color: STATUS_STYLES[hoveredEvent.status].color, fontWeight: 700 }}>
              {accountabilityStatusLabel(hoveredEvent.status)}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>Source: {hoveredEvent.source}</span>
          </div>
        </div>
      )}

      {/* Stats summary */}
      <div style={{
        marginTop: 24,
        padding: '12px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 6,
        display: 'flex',
        gap: 24,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Events
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>
            {filteredEvents.length}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            This Year
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
            {yearEvents.length}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Years Tracked
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
            {years.length}
          </div>
        </div>
      </div>
    </div>
  );
}

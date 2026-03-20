'use client';

import React from 'react';

export type IntelStatus = 'ELEVATED' | 'CRITICAL' | 'HIGH' | 'STABLE';

interface IntelEvent {
  id: string;
  location: string;
  subLocation: string;
  status: IntelStatus;
  timestamp: string;
  dateHeader: string;
  description: string;
  color?: string; // Optional custom color for the dot
}

const SAMPLE_EVENTS: IntelEvent[] = [
  {
    id: '1',
    location: 'ENGLISH CHANNEL',
    subLocation: 'United Kingdom/France',
    status: 'ELEVATED',
    timestamp: '~14m ago',
    dateHeader: 'Mar 19',
    description: 'Nearly 150 migrants crossed the English Channel in small boats, taking advantage of favorable weather conditions.',
    color: '#00d8ff'
  },
  {
    id: '2',
    location: 'ENGLISH CHANNEL',
    subLocation: 'United Kingdom/France',
    status: 'ELEVATED',
    timestamp: '~14m ago',
    dateHeader: 'Mar 18, morning',
    description: 'More than 400 migrants crossed illegally from France to the UK over a period starting the previous morning.',
    color: '#00d8ff'
  },
  {
    id: '3',
    location: 'STRAIT OF HORMUZ (IRANIAN COASTLINE)',
    subLocation: 'Iran',
    status: 'CRITICAL',
    timestamp: '~36m ago',
    dateHeader: 'Mar 19, evening',
    description: 'Israeli Prime Minister Netanyahu advocates for developing alternative oil and gas pipelines through the Arabian Peninsula to Israeli ports to bypass the Strait of Hormuz.',
    color: '#a4ff00'
  },
  {
    id: '4',
    location: 'GREENLAND',
    subLocation: 'Denmark',
    status: 'HIGH',
    timestamp: '~37m ago',
    dateHeader: 'Mar 19',
    description: 'Reports emerge that Denmark had contingency plans to destroy Greenland runways in the event of a US invasion.',
    color: '#00d8ff'
  },
  {
    id: '5',
    location: 'GREENLAND',
    subLocation: 'Denmark',
    status: 'HIGH',
    timestamp: '~37m ago',
    dateHeader: 'Jan',
    description: 'The Danish military sent explosives and blood supplies to Greenland as part of this contingency planning.',
    color: '#00d8ff'
  },
  {
    id: '6',
    location: 'IRAN (NATIONWIDE, FOCUSING ON NUCLEAR SITES)',
    subLocation: 'Iran',
    status: 'CRITICAL',
    timestamp: '~40m ago',
    dateHeader: 'Mar 19, evening',
    description: "Netanyahu states there are 'many possibilities' regarding a ground-based component to the operation in Iran.",
    color: '#a4ff00'
  }
];

interface Props {
  events: IntelEvent[];
}

const STATUS_STYLES: Record<IntelStatus, { color: string; bg: string }> = {
  CRITICAL: { color: '#0070f3', bg: 'rgba(0, 112, 243, 0.08)' }, // Pure Blue
  ELEVATED: { color: '#00a6ff', bg: 'rgba(0, 166, 255, 0.08)' }, // Sky Blue
  HIGH:     { color: '#00d8ff', bg: 'rgba(0, 216, 255, 0.08)' }, // Cyan
  STABLE:   { color: '#27ae60', bg: 'rgba(39, 174, 96, 0.08)' }   // Emerald Green
};

export default function IntelTimeline({ events }: Props) {
  if (!events || events.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
        SCANNING FREQUENCIES... NO INTEL DETECTED.
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-primary)',
    }}>
      <div style={{ position: 'relative', paddingLeft: '28px' }}>
        {/* Main Vertical Timeline Line */}
        <div style={{
          position: 'absolute',
          left: '7px',
          top: '10px',
          bottom: '10px',
          width: '2px',
          background: 'linear-gradient(to bottom, var(--accent) 0%, var(--border) 100%)',
          opacity: 0.3,
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {events.map((event) => {
            const statusStyle = STATUS_STYLES[event.status] || STATUS_STYLES.STABLE;
            return (
              <div 
                key={event.id} 
                className="intel-event-row"
                style={{ position: 'relative' }}
              >
                {/* Timeline Dot */}
                <div 
                  className="intel-dot"
                  style={{
                    position: 'absolute',
                    left: '-26px',
                    top: '6px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: 'var(--bg)',
                    border: `2px solid ${statusStyle.color}`,
                    zIndex: 2,
                    boxShadow: `0 0 0 3px var(--surface), 0 0 10px ${statusStyle.color}66`,
                    transition: 'transform 0.2s ease'
                  }} 
                />

                {/* Event Content Wrapper */}
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid transparent',
                  transition: 'all 0.2s ease',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'var(--border-light)';
                  const dot = e.currentTarget.parentElement?.querySelector('.intel-dot') as HTMLElement;
                  if (dot) dot.style.transform = 'scale(1.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)';
                  e.currentTarget.style.borderColor = 'transparent';
                  const dot = e.currentTarget.parentElement?.querySelector('.intel-dot') as HTMLElement;
                  if (dot) dot.style.transform = 'scale(1)';
                }}
                >
                  {/* Header Row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: statusStyle.color,
                        border: `1px solid ${statusStyle.color}44`,
                        padding: '2px 8px',
                        borderRadius: '2px',
                        background: 'rgba(0,0,0,0.02)',
                        textTransform: 'uppercase',
                      }}>
                        {event.location}
                      </span>
                      
                      <span style={{
                        fontSize: '12px',
                        padding: '2px 10px',
                        borderRadius: '2px',
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        letterSpacing: '0.08em',
                        fontWeight: 800,
                        border: `1px solid ${statusStyle.color}22`
                      }}>
                        {event.status}
                      </span>
                    </div>

                    <div style={{ 
                      fontSize: '12px', 
                      color: 'var(--text-muted)', 
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 500
                    }}>
                      {event.timestamp}
                    </div>
                  </div>

                  {/* Subheader */}
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    marginBottom: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 500,
                    opacity: 0.8
                  }}>
                    {event.subLocation}
                  </div>

                  {/* Dateline */}
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--accent)',
                    fontWeight: 800,
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ height: '1px', width: '12px', background: 'var(--accent)', opacity: 0.5 }} />
                    {event.dateHeader}
                  </div>

                  {/* Description */}
                  <p style={{
                    fontSize: '16px',
                    lineHeight: '1.6',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    letterSpacing: '0.01em',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 400
                  }}>
                    {event.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .intel-event-row:hover .intel-dot {
          transform: scale(1.3);
        }
      `}</style>
    </div>
  );
}

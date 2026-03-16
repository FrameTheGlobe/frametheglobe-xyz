'use client';

import React from 'react';

export type CompItem = {
  sourceName: string;
  sourceColor: string;
  region: string;
  title: string;
  summary: string;
  link: string;
  pubDate: string;
};

type Props = {
  items: CompItem[];
  onClose: () => void;
};

export default function CrossSourceComparison({ items, onClose }: Props) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border-light)',
        borderTop: '2px solid var(--accent)',
        padding: '14px',
        borderRadius: '0 0 4px 4px',
        marginTop: '-1px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
          ⊞ HOW SOURCES FRAME THIS
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '0',
            lineHeight: '1',
          }}
          aria-label="Close comparison"
        >
          ×
        </button>
      </div>

      {/* Horizontal scrollable grid */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              minWidth: '200px',
              maxWidth: '260px',
              background: 'var(--surface)',
              border: '1px solid var(--border-light)',
              borderTop: `2px solid ${item.sourceColor}`,
              padding: '10px',
              borderRadius: '3px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {/* Source name */}
            <div
              style={{
                color: item.sourceColor,
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {item.sourceName}
            </div>

            {/* Title */}
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: '1.4',
                marginTop: '4px',
              }}
            >
              {item.title}
            </div>

            {/* Summary */}
            <div
              style={{
                color: 'var(--text-secondary)',
                fontSize: '12px',
                lineHeight: '1.5',
                marginTop: '4px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.summary}
            </div>

            {/* Read link */}
            <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--accent)',
                  fontSize: '11px',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none';
                }}
              >
                Read →
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import React, { useMemo } from 'react';

export type BriefCluster = {
  id: string;
  title: string;
  sourceCount: number;
  regionCount: number;
  regions: string[];
  latestPubDate: string;
  topItems: { sourceName: string; sourceColor: string; title: string; link: string }[];
};

type Props = {
  clusters: BriefCluster[];
  onDismiss: () => void;
};

const REGION_COLORS: Record<string, string> = {
  western: '#c0392b',
  iranian: '#27ae60',
  gulf: '#e67e22',
  levant: '#8e44ad',
  analysis: '#2980b9',
  osint: '#f39c12',
  global: '#16a085',
  china: '#de2910',
  russia: '#1f355e',
  'south-asian': '#d35400',
};

export default function DailyBriefing({ clusters, onDismiss }: Props) {
  const displayClusters = useMemo(() => clusters.slice(0, 5), [clusters]);
  const totalSources = useMemo(() => {
    const sourceSet = new Set<string>();
    clusters.forEach(cluster => {
      cluster.topItems.forEach(item => sourceSet.add(item.sourceName));
    });
    return sourceSet.size;
  }, [clusters]);

  const todayDate = useMemo(() => {
    const now = new Date();
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dayName = days[now.getDay()];
    const date = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    return `${dayName} ${date} ${month} ${year}`;
  }, []);

  return (
    <div
      style={{
        borderLeft: '3px solid var(--accent)',
        background: 'var(--surface)',
        border: '1px solid var(--border-light)',
        padding: '16px',
        borderRadius: '4px',
        marginBottom: '12px',
        animation: 'fadeUp 0.3s ease both',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
          📋 DAILY BRIEFING
        </div>
        <div style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 600 }}>{todayDate}</div>
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '0',
            lineHeight: '1',
          }}
          aria-label="Dismiss briefing"
        >
          ×
        </button>
      </div>

      {/* Subtitle */}
      <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
        Top stories from the past 12 hours across {totalSources} sources
      </div>

      {/* Clusters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {displayClusters.map(cluster => (
          <div key={cluster.id} style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
            {/* Cluster header with badge */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
              <div
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 800,
                  padding: '4px 12px',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                  minWidth: 'fit-content',
                }}
              >
                {cluster.sourceCount} sources
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  flex: 1,
                  lineHeight: 1.4
                }}
              >
                {cluster.title}
              </div>
            </div>

            {/* Region dots */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              {cluster.regions.map(region => (
                <div
                  key={region}
                  title={region}
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: REGION_COLORS[region] || '#999',
                  }}
                />
              ))}
            </div>

            {/* Top item headlines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {cluster.topItems.slice(0, 3).map((item, idx) => (
                <a
                  key={idx}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '15px',
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    lineHeight: '1.6',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)';
                  }}
                >
                  <strong style={{ color: item.sourceColor }}>{item.sourceName}:</strong> {item.title}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* See all stories link */}
      {clusters.length > 5 && (
        <div style={{ marginTop: '12px' }}>
          <a
            href="#"
            style={{
              fontSize: '12px',
              color: 'var(--accent)',
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
            See all stories →
          </a>
        </div>
      )}
    </div>
  );
}

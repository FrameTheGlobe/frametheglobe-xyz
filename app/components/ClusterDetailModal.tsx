'use client';

import { SOURCE_TRUST } from '@/lib/fetcher';

const mono = 'var(--font-mono)';

type FeedItem = {
  link: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceId: string;
  region: string;
  pubDate: string;
  relevanceScore?: number;
};

type Cluster = {
  id: string;
  title: string;
  items: FeedItem[];
  score: number;
  consensus?: number;
  contradiction?: number;
  corroborationCount?: number;
  avgTrust?: number;
  avgRelevance?: number;
};

type Props = {
  cluster: Cluster;
  onClose: () => void;
};

export default function ClusterDetailModal({ cluster, onClose }: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: 12,
          maxWidth: 700,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            background: 'var(--bg)',
            zIndex: 1,
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {cluster.title}
            </h3>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              {cluster.items.length} sources · {cluster.corroborationCount} unique
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--text-primary)',
            }}
          >
            Close
          </button>
        </div>

        {/* Cluster metrics */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          {cluster.consensus !== undefined && (
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: mono }}>
                Consensus:
              </span>{' '}
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: mono }}>
                {(cluster.consensus * 100).toFixed(0)}%
              </span>
            </div>
          )}
          {cluster.contradiction !== undefined && (
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: mono }}>
                Contradiction:
              </span>{' '}
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: mono }}>
                {(cluster.contradiction * 100).toFixed(0)}%
              </span>
            </div>
          )}
          {cluster.avgTrust !== undefined && (
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: mono }}>
                Avg Trust:
              </span>{' '}
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: mono }}>
                {(cluster.avgTrust * 100).toFixed(0)}%
              </span>
            </div>
          )}
          {cluster.avgRelevance !== undefined && (
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: mono }}>
                Avg Relevance:
              </span>{' '}
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: mono }}>
                {cluster.avgRelevance.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {/* Source list */}
        <div style={{ padding: '14px 20px' }}>
          {cluster.items.map((item: FeedItem, idx: number) => {
            const trustScore = SOURCE_TRUST[item.sourceId?.toLowerCase()] ?? 0.5;
            const relevance = item.relevanceScore || 0;
            
            return (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-light)',
                  background: 'var(--surface)',
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: mono,
                    }}
                  >
                    {item.sourceName}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      fontFamily: mono,
                    }}
                  >
                    {new Date(item.pubDate).toLocaleString()}
                  </span>
                </div>
                
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 13,
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    display: 'block',
                    marginBottom: 8,
                    fontWeight: 500,
                  }}
                >
                  {item.title}
                </a>

                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    fontFamily: mono,
                  }}
                >
                  <div>
                    Trust:{' '}
                    <span style={{ color: trustScore > 0.7 ? '#22c55e' : trustScore > 0.5 ? '#eab308' : '#ef4444' }}>
                      {(trustScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div>Relevance: {relevance.toFixed(1)}</div>
                  <div>Region: {item.region}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

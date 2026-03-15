'use client';

type FeedItem = {
  title: string;
  link: string;
  sourceName: string;
  region: string;
  pubDate: string;
};

interface Cluster {
  id: string;
  title: string;
  items: FeedItem[];
  score: number;
}

interface Props {
  clusters: Cluster[];
  limit?: number;
}

export default function TopStorylines({ clusters, limit = 5 }: Props) {
  // Sort clusters by score (which factors in size and recency)
  const topClusters = clusters
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (topClusters.length === 0) {
    return (
      <div className="article-card" style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border-light)' }}>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          <span style={{ color: 'var(--brand-blue)' }}>●</span> Top Storylines
        </h3>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          Awaiting sufficient data to form clusters...
        </div>
      </div>
    );
  }

  return (
    <div className="article-card" style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border-light)' }}>
      <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
        <span style={{ color: 'var(--brand-blue)' }}>●</span> Top Storylines
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {topClusters.map((cluster, i) => {
          // Count unique sources reporting on this cluster
          const uniqueSources = new Set(cluster.items.map(item => item.sourceName)).size;
          
          return (
            <div key={cluster.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-muted)',
                width: 14,
                textAlign: 'right',
                paddingTop: 2,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <a
                  href={cluster.items[0].link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-display)',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    lineHeight: 1.3,
                    marginBottom: 4,
                    textWrap: 'balance',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                >
                  {cluster.title}
                </a>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                  {cluster.items.length} articles · {uniqueSources} sources
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

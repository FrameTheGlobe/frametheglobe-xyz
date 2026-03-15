'use client';

type Lens = {
  id: string;
  label: string;
  keywords: string[];
};

type FeedItem = {
  title: string;
  summary?: string;
};

interface Props {
  items: FeedItem[];
  lenses: Lens[];
  limit?: number;
}

export default function LensPulse({ items, lenses, limit = 5 }: Props) {
  if (items.length === 0) return null;

  // Basic keyword matching (case-insensitive)
  const itemMatchesLens = (item: FeedItem, lens: Lens) => {
    const text = (item.title + ' ' + (item.summary || '')).toLowerCase();
    return lens.keywords.some(kw => text.includes(kw));
  };

  // Calculate volume for each lens (excluding 'all')
  const lensVolumes = lenses
    .filter(l => l.id !== 'all')
    .map(lens => {
      const count = items.filter(item => itemMatchesLens(item, lens)).length;
      return { ...lens, count };
    })
    .filter(l => l.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  // Find the maximum count to calculate percentage bars
  const maxCount = lensVolumes.length > 0 ? Math.max(...lensVolumes.map(l => l.count)) : 1;

  if (lensVolumes.length === 0) {
    return (
      <div className="article-card" style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border-light)' }}>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
           Topic Volume
        </h3>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          No prominent topics detected yet.
        </div>
      </div>
    );
  }

  return (
    <div className="article-card" style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border-light)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
           Topic Pulse
        </h3>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
          Current volume
        </span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lensVolumes.map((lens) => {
          const percentage = (lens.count / maxCount) * 100;
          
          return (
            <div key={lens.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: 11, 
                fontWeight: 500,
                color: 'var(--text-primary)',
                width: 80, // Fixed width for labels to align bars
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {lens.label}
              </div>
              
              <div style={{ flex: 1, height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${percentage}%`, 
                  background: 'var(--accent)',
                  borderRadius: 3,
                  transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
                }} />
              </div>
              
              <div style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: 10, 
                color: 'var(--text-muted)',
                width: 24,
                textAlign: 'right'
              }}>
                {lens.count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

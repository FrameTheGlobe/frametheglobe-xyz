'use client';

/**
 * TrendingKeywords — scans the last 2 hours of headlines and surfaces the
 * most-mentioned meaningful terms, displayed as a ranked list with frequency bars.
 * Zero external dependencies — pure client-side analysis.
 */

import { useMemo } from 'react';

type FeedItem = {
  title: string;
  summary: string;
  pubDate: string;
};

interface Props {
  items: FeedItem[];
  /** How many top keywords to display (default 10) */
  limit?: number;
}

// Words to ignore during frequency analysis
const STOPWORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'by','from','as','is','was','are','were','be','been','being','have','has',
  'had','do','does','did','will','would','could','should','may','might','can',
  'that','this','these','those','it','its','he','she','they','we','you','i',
  'not','no','nor','so','yet','both','either','neither','just','also','than',
  'then','when','where','which','who','whom','whose','how','what','after',
  'before','during','while','over','under','about','against','between','into',
  'through','during','such','other','new','more','most','all','any','each',
  'say','says','said','report','reports','reported','amid','amid','according',
  'us','un','eu','uk','says','amid','amid','amid','after','amid','since',
  'amid','amid','his','her','their','our','your','my','amid','within','amid',
  'could','amid','amid','amid','amid','amid','amid','amid','amid','amid',
]);

// Specific short tokens to skip
const MIN_LENGTH = 3;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^[-']+|[-']+$/g, '').trim())
    .filter(w => w.length >= MIN_LENGTH && !STOPWORDS.has(w));
}

export default function TrendingKeywords({ items, limit = 10 }: Props) {
  const WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
  const now = Date.now();

  const keywords = useMemo(() => {
    const recent = items.filter(
      i => now - new Date(i.pubDate).getTime() < WINDOW_MS
    );

    if (recent.length === 0) return [];

    const freq: Record<string, number> = {};
    recent.forEach(item => {
      const words = tokenize(`${item.title} ${item.summary}`);
      // Use a Set per article to count each word once per article (document freq)
      const seen = new Set<string>();
      words.forEach(w => {
        if (!seen.has(w)) {
          freq[w] = (freq[w] || 0) + 1;
          seen.add(w);
        }
      });
    });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, limit]);

  if (keywords.length === 0) return null;

  const maxCount = keywords[0]?.[1] ?? 1;

  return (
    <div style={{
      background:   'var(--surface)',
      border:       '1px solid var(--border-light)',
      borderRadius: 4,
      padding:      '12px 14px',
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{
        fontFamily:    'var(--font-mono)',
        fontSize:      9,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color:         'var(--text-muted)',
        marginBottom:  10,
        display:       'flex',
        alignItems:    'center',
        gap:           7,
      }}>
        <span style={{
          display:      'inline-block',
          width:        6,
          height:       6,
          borderRadius: '50%',
          background:   '#e05a3a',
          animation:    'pulse-dot 2.2s ease-in-out infinite',
          flexShrink:   0,
        }} />
        Trending · last 2 h
      </div>

      {/* Keyword rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {keywords.map(([word, count], idx) => {
          const pct = (count / maxCount) * 100;
          return (
            <div key={word} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Rank */}
              <span style={{
                fontFamily:    'var(--font-mono)',
                fontSize:      8,
                color:         'var(--text-muted)',
                width:         12,
                textAlign:     'right',
                flexShrink:    0,
                opacity:       0.6,
              }}>
                {idx + 1}
              </span>

              {/* Bar + label */}
              <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                {/* Background bar */}
                <div style={{
                  position:     'absolute',
                  left:         0, top: 0, bottom: 0,
                  width:        `${pct}%`,
                  background:   idx === 0
                    ? 'rgba(176, 53, 26, 0.15)'
                    : 'var(--surface-hover)',
                  borderRadius: 2,
                  transition:   'width 0.4s ease',
                }} />
                {/* Word */}
                <span style={{
                  position:      'relative',
                  fontFamily:    'var(--font-mono)',
                  fontSize:      10,
                  color:         idx === 0 ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight:    idx === 0 ? 600 : 400,
                  letterSpacing: '0.03em',
                  padding:       '2px 5px',
                  display:       'block',
                  overflow:      'hidden',
                  textOverflow:  'ellipsis',
                  whiteSpace:    'nowrap',
                }}>
                  {word}
                </span>
              </div>

              {/* Count */}
              <span style={{
                fontFamily:  'var(--font-mono)',
                fontSize:    9,
                color:       'var(--text-muted)',
                flexShrink:  0,
                minWidth:    16,
                textAlign:   'right',
              }}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { FeedItem } from '../../lib/fetcher';

interface MissileIntelProps {
  items: FeedItem[];
  limit?: number;
}

interface MissileEvent {
  id: string;
  type: 'launch' | 'intercept' | 'test' | 'deployment';
  system: string;
  location?: string;
  details: string;
  timestamp: Date;
  source: string;
  relevance: number;
}

export default function MissileIntel({ items, limit = 10 }: MissileIntelProps) {
  // Extract missile-related events
  const missileEvents: MissileEvent[] = items
    .filter(item => {
      const text = `${item.title} ${item.summary}`.toLowerCase();
      const missileKeywords = [
        'missile', 'ballistic', 'cruise', 'shahed', 'fateh', 'sejjil', 
        'iron dome', 'david\'s sling', 'arrow', 'jericho', 'intercept', 
        'launch', 'airstrike', 'drone strike'
      ];
      return missileKeywords.some(keyword => text.includes(keyword));
    })
    .slice(0, limit)
    .map(item => {
      const text = `${item.title} ${item.summary}`.toLowerCase();
      
      // Determine event type
      let type: MissileEvent['type'] = 'deployment';
      if (text.includes('launch') || text.includes('fired')) type = 'launch';
      else if (text.includes('intercept') || text.includes('shot down')) type = 'intercept';
      else if (text.includes('test') || text.includes('drill')) type = 'test';
      
      // Identify missile system
      let system = 'Unknown';
      if (text.includes('iron dome')) system = 'Iron Dome';
      else if (text.includes('david\'s sling')) system = 'David\'s Sling';
      else if (text.includes('arrow')) system = 'Arrow System';
      else if (text.includes('jericho')) system = 'Jericho Missile';
      else if (text.includes('shahed')) system = 'Shahed Drone';
      else if (text.includes('fateh')) system = 'Fateh Missile';
      else if (text.includes('sejjil')) system = 'Sejjil Missile';
      else if (text.includes('f-35')) system = 'F-35 Strike';
      else if (text.includes('f-16')) system = 'F-16 Strike';
      else if (text.includes('ballistic')) system = 'Ballistic Missile';
      else if (text.includes('cruise')) system = 'Cruise Missile';
      
      return {
        id: item.link || `${item.sourceId}::${item.title}`,
        type,
        system,
        details: item.title,
        timestamp: new Date(item.pubDate),
        source: item.sourceName,
        relevance: item.relevanceScore || 0
      };
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const getTypeColor = (type: MissileEvent['type']) => {
    switch (type) {
      case 'launch': return '#ef4444'; // red
      case 'intercept': return '#f59e0b'; // amber
      case 'test': return '#3b82f6'; // blue
      default: return '#6b7280'; // gray
    }
  };

  const getTypeIcon = (type: MissileEvent['type']) => {
    switch (type) {
      case 'launch': return '🚀';
      case 'intercept': return '🛡️';
      case 'test': return '⚡';
      default: return '📡';
    }
  };

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '1px solid var(--border-light)'
      }}>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          🚀 Missile Intelligence
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
          {missileEvents.length} events
        </span>
      </div>

      {missileEvents.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '20px', 
          color: 'var(--text-muted)',
          fontSize: 11 
        }}>
          No missile activity detected
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {missileEvents.map(event => (
            <div
              key={event.id}
              style={{
                padding: '8px 10px',
                border: '1px solid var(--border-light)',
                borderRadius: 4,
                background: 'var(--surface)',
                borderLeft: `3px solid ${getTypeColor(event.type)}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{getTypeIcon(event.type)}</span>
                <span style={{ 
                  fontWeight: 600, 
                  color: getTypeColor(event.type),
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {event.type}
                </span>
                <span style={{ 
                  color: 'var(--text-primary)', 
                  fontWeight: 500,
                  flex: 1
                }}>
                  {event.system}
                </span>
              </div>
              
              <div style={{ 
                color: 'var(--text-primary)', 
                marginBottom: 4,
                fontSize: 11,
                lineHeight: 1.3
              }}>
                {event.details}
              </div>
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 10,
                color: 'var(--text-muted)'
              }}>
                <span>{event.source}</span>
                <span>
                  {event.timestamp.toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

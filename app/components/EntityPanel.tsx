'use client';

import { useState, useEffect, useRef } from 'react';
import type { Entity } from '@/lib/entities';

type Props = {
  articles: Array<{ title: string; summary?: string }>;
  onEntityClick?: (entity: Entity) => void;
  onClose?: () => void;
};

export default function EntityPanel({ articles, onEntityClick, onClose }: Props) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<'all' | 'person' | 'organization' | 'location' | 'weapon' | 'event'>('all');
  const lastCountRef = useRef<number>(-1);

  useEffect(() => {
    // Only re-fetch when the number of articles changes to avoid thrashing on reference changes
    if (articles.length === lastCountRef.current) return;
    lastCountRef.current = articles.length;

    async function fetchEntities() {
      setLoading(true);
      try {
        const res = await fetch('/api/entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articles }),
        });
        const data = await res.json();
        if (data.entities) {
          setEntities(data.entities);
        }
      } catch (err) {
        console.error('Failed to fetch entities:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchEntities();
  }, [articles]);

  const filteredEntities = selectedType === 'all' 
    ? entities 
    : entities.filter(e => e.type === selectedType);

  const typeColors: Record<string, string> = {
    person: '#3b82f6',
    organization: '#8b5cf6',
    location: '#10b981',
    weapon: '#ef4444',
    event: '#f59e0b',
    military_unit: '#6366f1',
  };

  const typeLabels: Record<string, string> = {
    all: 'All',
    person: 'People',
    organization: 'Organizations',
    location: 'Locations',
    weapon: 'Weapons',
    event: 'Events',
    military_unit: 'Military Units',
  };

  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--text-primary)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '1px solid var(--border-light)',
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.05em',
          color: 'var(--accent)',
        }}>
          ENTITY TRACKING
        </span>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Type filter */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 12,
        flexWrap: 'wrap',
      }}>
        {(Object.keys(typeLabels) as Array<keyof typeof typeLabels>).map(type => (
          <button
            key={type}
            onClick={() => setSelectedType(type as 'all' | 'person' | 'organization' | 'location' | 'weapon' | 'event')}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid var(--border-light)',
              background: selectedType === type ? 'var(--accent)' : 'var(--surface)',
              color: selectedType === type ? '#fff' : 'var(--text-secondary)',
              fontSize: 9,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {typeLabels[type]}
          </button>
        ))}
      </div>

      {/* Entity list */}
      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Extracting entities...
        </div>
      ) : filteredEntities.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No entities found
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredEntities.slice(0, 20).map(entity => (
            <div
              key={entity.id}
              onClick={() => onEntityClick && onEntityClick(entity)}
              style={{
                padding: '8px 10px',
                borderRadius: 4,
                border: '1px solid var(--border-light)',
                background: 'var(--surface)',
                cursor: onEntityClick ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => onEntityClick && (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={(e) => onEntityClick && (e.currentTarget.style.background = 'var(--surface)')}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
              }}>
                <span style={{
                  fontWeight: 700,
                  color: typeColors[entity.type] || 'var(--text-primary)',
                }}>
                  {entity.text}
                </span>
                <span style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                }}>
                  {entity.count}
                </span>
              </div>
              <div style={{
                fontSize: 9,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {typeLabels[entity.type]}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  detectAnomalies,
  buildBaseline,
  getAnomalyIcon,
  getSeverityColor,
  formatConfidence,
  type Anomaly,
  type AnomalySeverity,
} from '@/lib/anomaly-detection';

const mono = 'var(--font-mono)';

function AnomalyCard({ anomaly, onDismiss }: { anomaly: Anomaly; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const icon = getAnomalyIcon(anomaly.type);
  const color = getSeverityColor(anomaly.severity);

  return (
    <div
      style={{
        padding: '10px 12px',
        border: `1px solid ${color}40`,
        borderRadius: 6,
        background: `${color}08`,
        marginBottom: 8,
        cursor: 'pointer',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 16 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: 2,
            }}
          >
            {anomaly.title}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            {anomaly.severity.toUpperCase()} · Confidence {formatConfidence(anomaly.confidence)}
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            color,
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
        >
          {anomaly.severity}
        </span>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${color}30`,
            fontSize: 10,
            color: 'var(--text-secondary)',
          }}
        >
          <p style={{ margin: '0 0 8px 0', lineHeight: 1.5 }}>{anomaly.description}</p>

          {anomaly.recommendation && (
            <div
              style={{
                padding: '6px 10px',
                background: 'var(--surface)',
                borderRadius: 4,
                marginBottom: 8,
              }}
            >
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>→ </span>
              {anomaly.recommendation}
            </div>
          )}

          {anomaly.metadata && Object.keys(anomaly.metadata).length > 0 && (
            <details style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              <summary style={{ cursor: 'pointer' }}>Details</summary>
              <pre
                style={{
                  margin: '8px 0 0 0',
                  padding: 8,
                  background: 'var(--surface-muted)',
                  borderRadius: 4,
                  overflow: 'auto',
                  fontSize: 9,
                }}
              >
                {JSON.stringify(anomaly.metadata, null, 2)}
              </pre>
            </details>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              style={{
                padding: '4px 10px',
                border: '1px solid var(--border-light)',
                borderRadius: 4,
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: 9,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type Props = {
  items: Array<{
    id?: string;
    title: string;
    summary: string;
    pubDate: string;
    sourceId?: string;
    sourceName?: string;
    region?: string;
  }>;
};

export default function AnomalyPanel({ items }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [lastScan, setLastScan] = useState<number>(Date.now());

  // Re-scan every 2 minutes
  useEffect(() => {
    const timer = setInterval(() => setLastScan(Date.now()), 2 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Build baseline from first 50% of items
  const baseline = useMemo(() => {
    const baselineItems = items.slice(0, Math.floor(items.length / 2));
    return buildBaseline(baselineItems);
  }, [items.length > 0 ? items[0].pubDate : null]); // Rebuild when first item changes

  // Detect anomalies
  const allAnomalies = useMemo(() => {
    return detectAnomalies(items, baseline);
  }, [items, baseline, lastScan]);

  // Filter dismissed
  const visibleAnomalies = useMemo(() => {
    return allAnomalies.filter((a) => !dismissed.has(a.id));
  }, [allAnomalies, dismissed]);

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  };

  // Group by severity
  const critical = visibleAnomalies.filter((a) => a.severity === 'critical');
  const warnings = visibleAnomalies.filter((a) => a.severity === 'warning');
  const info = visibleAnomalies.filter((a) => a.severity === 'info');

  return (
    <div style={{ fontFamily: mono, fontSize: 12 }}>
      {/* Header */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.05em',
          color: 'var(--accent)',
          textTransform: 'uppercase',
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Anomaly Detection</span>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 10,
            background: visibleAnomalies.length > 0 ? '#ef444420' : 'var(--surface-muted)',
            color: visibleAnomalies.length > 0 ? '#ef4444' : 'var(--text-muted)',
            fontSize: 10,
          }}
        >
          {visibleAnomalies.length}
        </span>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          padding: '10px',
          background: 'var(--surface)',
          borderRadius: 6,
        }}
      >
        <StatBox count={critical.length} label="Critical" color="#ef4444" />
        <StatBox count={warnings.length} label="Warnings" color="#f59e0b" />
        <StatBox count={info.length} label="Info" color="#3b82f6" />
      </div>

      {/* Anomalies list */}
      <div>
        {visibleAnomalies.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 12 }}>No anomalies detected</div>
            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>
              All patterns within normal parameters
            </div>
          </div>
        ) : (
          <>
            {critical.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <SectionHeader color="#ef4444">Critical</SectionHeader>
                {critical.map((a) => (
                  <AnomalyCard key={a.id} anomaly={a} onDismiss={() => handleDismiss(a.id)} />
                ))}
              </div>
            )}

            {warnings.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <SectionHeader color="#f59e0b">Warnings</SectionHeader>
                {warnings.map((a) => (
                  <AnomalyCard key={a.id} anomaly={a} onDismiss={() => handleDismiss(a.id)} />
                ))}
              </div>
            )}

            {info.length > 0 && (
              <div>
                <SectionHeader color="#3b82f6">Information</SectionHeader>
                {info.map((a) => (
                  <AnomalyCard key={a.id} anomaly={a} onDismiss={() => handleDismiss(a.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 16,
          padding: '10px 12px',
          background: 'var(--surface-muted)',
          borderRadius: 4,
          fontSize: 9,
          color: 'var(--text-muted)',
        }}
      >
        Auto-scans every 2 min. Baseline built from {Math.floor(items.length / 2)} historical
        items.
      </div>
    </div>
  );
}

function StatBox({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        textAlign: 'center',
        padding: '6px 8px',
        borderRadius: 4,
        background: count > 0 ? `${color}15` : 'transparent',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800, color: count > 0 ? color : 'var(--text-muted)' }}>
        {count}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

function SectionHeader({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 8,
        paddingLeft: 4,
      }}
    >
      {children}
    </div>
  );
}

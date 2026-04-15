'use client';

import { useState, useCallback } from 'react';
import {
  getLayouts,
  getActiveLayout,
  setActiveLayout,
  createLayout,
  deleteLayout,
  saveLayout,
  toggleWidget,
  autoArrange,
  exportLayout,
  importLayout,
  resetLayout,
  type DashboardLayout,
  type WidgetConfig,
  type WidgetId,
} from '@/lib/dashboard-layout';

const mono = 'var(--font-mono)';

const WIDGET_ICONS: Record<WidgetId, string> = {
  feed: '📰',
  clusters: '🔍',
  map: '🗺️',
  polymarket: '📊',
  'market-ticker': '💹',
  'oil-ticker': '🛢️',
  'missile-intel': '🚀',
  'rapid-response': '⚡',
  'macro-watch': '📈',
  accountability: '⚖️',
  predictive: '🔮',
  anomalies: '🔎',
};

// ── Components ─────────────────────────────────────────────────────────────────

function LayoutCard({
  layout,
  isActive,
  onActivate,
  onEdit,
  onDelete,
  onExport,
  onReset,
}: {
  layout: DashboardLayout;
  isActive: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
  onReset: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const enabledCount = layout.widgets.filter((w) => w.enabled).length;

  return (
    <div
      onClick={onActivate}
      style={{
        padding: '12px 14px',
        border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-light)'}`,
        borderRadius: 6,
        background: isActive ? 'var(--accent-light)' : 'var(--surface)',
        cursor: 'pointer',
        marginBottom: 8,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 14 }}>{isActive ? '✓' : '○'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
            {layout.name}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            {enabledCount} widgets · {layout.columns} cols
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          ⋯
        </button>
      </div>

      {showMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 40,
            right: 10,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 0',
            zIndex: 100,
            minWidth: 140,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <MenuItem onClick={() => { onEdit(); setShowMenu(false); }}>Edit Widgets</MenuItem>
          <MenuItem onClick={() => { onExport(); setShowMenu(false); }}>Export</MenuItem>
          {['default', 'compact', 'analysis'].includes(layout.id) && (
            <MenuItem onClick={() => { onReset(); setShowMenu(false); }}>Reset to Default</MenuItem>
          )}
          {!['default', 'compact', 'analysis'].includes(layout.id) && (
            <MenuItem danger onClick={() => { onDelete(); setShowMenu(false); }}>
              Delete
            </MenuItem>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '6px 12px',
        border: 'none',
        background: 'transparent',
        textAlign: 'left',
        fontSize: 11,
        color: danger ? '#ef4444' : 'var(--text-primary)',
        cursor: 'pointer',
        fontFamily: mono,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}

function WidgetEditor({
  layout,
  onToggle,
  onMoveUp,
  onMoveDown,
  onClose,
}: {
  layout: DashboardLayout;
  onToggle: (id: WidgetId) => void;
  onMoveUp: (id: WidgetId) => void;
  onMoveDown: (id: WidgetId) => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 20,
          width: '90%',
          maxWidth: 450,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
          Edit Widgets: {layout.name}
        </h3>

        <div style={{ marginBottom: 16 }}>
          {layout.widgets.map((widget, index) => (
            <div
              key={widget.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px',
                borderBottom: '1px solid var(--border-light)',
                background: widget.enabled ? 'transparent' : 'var(--surface-muted)',
              }}
            >
              <input
                type="checkbox"
                checked={widget.enabled}
                onChange={() => onToggle(widget.id)}
              />
              <span style={{ fontSize: 16 }}>{WIDGET_ICONS[widget.id]}</span>
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: widget.enabled ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {widget.title}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => onMoveUp(widget.id)}
                  disabled={index === 0}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid var(--border-light)',
                    borderRadius: 4,
                    background: 'var(--surface)',
                    cursor: index === 0 ? 'not-allowed' : 'pointer',
                    opacity: index === 0 ? 0.5 : 1,
                  }}
                >
                  ↑
                </button>
                <button
                  onClick={() => onMoveDown(widget.id)}
                  disabled={index === layout.widgets.length - 1}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid var(--border-light)',
                    borderRadius: 4,
                    background: 'var(--surface)',
                    cursor: index === layout.widgets.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: index === layout.widgets.length - 1 ? 0.5 : 1,
                  }}
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border-light)',
              borderRadius: 4,
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontFamily: mono,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function DashboardLayoutPanel() {
  const [layouts, setLayouts] = useState<DashboardLayout[]>(getLayouts());
  const [activeId, setActiveId] = useState<string>(getActiveLayout().id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');

  const refreshLayouts = useCallback(() => {
    setLayouts(getLayouts());
  }, []);

  const handleActivate = useCallback((id: string) => {
    setActiveLayout(id);
    setActiveId(id);
    // Reload page to apply layout
    window.location.reload();
  }, []);

  const handleCreate = useCallback(() => {
    if (!newLayoutName.trim()) return;
    const layout = createLayout(newLayoutName, activeId);
    refreshLayouts();
    setShowCreate(false);
    setNewLayoutName('');
    handleActivate(layout.id);
  }, [newLayoutName, activeId, refreshLayouts, handleActivate]);

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm('Delete this layout?')) {
        deleteLayout(id);
        refreshLayouts();
      }
    },
    [refreshLayouts]
  );

  const handleToggleWidget = useCallback(
    (layoutId: string, widgetId: WidgetId) => {
      toggleWidget(layoutId, widgetId);
      refreshLayouts();
    },
    [refreshLayouts]
  );

  const handleMoveWidget = useCallback(
    (layoutId: string, widgetId: WidgetId, direction: 'up' | 'down') => {
      const layouts = getLayouts();
      const layout = layouts.find((l) => l.id === layoutId);
      if (!layout) return;

      const index = layout.widgets.findIndex((w) => w.id === widgetId);
      if (index < 0) return;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= layout.widgets.length) return;

      // Swap
      [layout.widgets[index], layout.widgets[newIndex]] = [
        layout.widgets[newIndex],
        layout.widgets[index],
      ];

      saveLayout(layout);
      refreshLayouts();
    },
    [refreshLayouts]
  );

  const handleAutoArrange = useCallback(() => {
    const layout = getLayouts().find((l) => l.id === activeId);
    if (!layout) return;
    autoArrange(layout);
    saveLayout(layout);
    refreshLayouts();
    alert('Widgets auto-arranged! Reload to apply.');
  }, [activeId, refreshLayouts]);

  const handleExport = useCallback((id: string) => {
    const layout = getLayouts().find((l) => l.id === id);
    if (!layout) return;
    const exported = exportLayout(layout);
    navigator.clipboard.writeText(exported);
    alert('Layout exported to clipboard!');
  }, []);

  const handleImport = useCallback(() => {
    const input = prompt('Paste layout export:');
    if (!input) return;
    const imported = importLayout(input.trim());
    if (imported) {
      saveLayout(imported);
      refreshLayouts();
      handleActivate(imported.id);
    } else {
      alert('Invalid layout export');
    }
  }, [handleActivate, refreshLayouts]);

  const handleReset = useCallback(
    (id: string) => {
      if (!confirm('Reset to default? This will lose customizations.')) return;
      resetLayout(id);
      refreshLayouts();
      if (activeId === id) {
        alert('Layout reset! Reload to apply.');
      }
    },
    [activeId, refreshLayouts]
  );

  const editingLayout = editingId ? layouts.find((l) => l.id === editingId) : null;

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
        <span>Dashboard Layouts</span>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '4px 10px',
            border: '1px solid var(--accent)',
            borderRadius: 4,
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          + New
        </button>
      </div>

      {/* Layouts list */}
      <div style={{ marginBottom: 16 }}>
        {layouts.map((layout) => (
          <LayoutCard
            key={layout.id}
            layout={layout}
            isActive={layout.id === activeId}
            onActivate={() => handleActivate(layout.id)}
            onEdit={() => setEditingId(layout.id)}
            onDelete={() => handleDelete(layout.id)}
            onExport={() => handleExport(layout.id)}
            onReset={() => handleReset(layout.id)}
          />
        ))}
      </div>

      {/* Quick actions */}
      <div
        style={{
          padding: '12px',
          background: 'var(--surface)',
          borderRadius: 6,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
          Quick Actions
        </div>
        <button
          onClick={handleAutoArrange}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid var(--border-light)',
            borderRadius: 4,
            background: 'var(--surface-muted)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 10,
            fontFamily: mono,
            marginBottom: 8,
          }}
        >
          Auto-Arrange Widgets
        </button>
        <button
          onClick={handleImport}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid var(--border-light)',
            borderRadius: 4,
            background: 'var(--surface-muted)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 10,
            fontFamily: mono,
          }}
        >
          Import Layout
        </button>
      </div>

      {/* Info */}
      <div
        style={{
          padding: '10px 12px',
          background: 'var(--surface-muted)',
          borderRadius: 4,
          fontSize: 9,
          color: 'var(--text-muted)',
        }}
      >
        Layouts control which widgets appear and their order. Changes require a
        page reload to take effect.
      </div>

      {/* Create modal */}
      {showCreate && (
        <div
          onClick={() => setShowCreate(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 20,
              width: '90%',
              maxWidth: 300,
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>New Layout</h3>
            <input
              type="text"
              value={newLayoutName}
              onChange={(e) => setNewLayoutName(e.target.value)}
              placeholder="Layout name"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border-light)',
                borderRadius: 4,
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontFamily: mono,
                marginBottom: 12,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{
                  padding: '6px 12px',
                  border: '1px solid var(--border-light)',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newLayoutName.trim()}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: 4,
                  background: 'var(--accent)',
                  color: '#fff',
                  cursor: newLayoutName.trim() ? 'pointer' : 'not-allowed',
                  opacity: newLayoutName.trim() ? 1 : 0.5,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Widget editor */}
      {editingLayout && (
        <WidgetEditor
          layout={editingLayout}
          onToggle={(id) => handleToggleWidget(editingLayout.id, id)}
          onMoveUp={(id) => handleMoveWidget(editingLayout.id, id, 'up')}
          onMoveDown={(id) => handleMoveWidget(editingLayout.id, id, 'down')}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

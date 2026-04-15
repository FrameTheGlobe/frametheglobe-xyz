'use client';

import { useState, useCallback } from 'react';
import {
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getActiveWorkspace,
  setActiveWorkspace,
  duplicateWorkspace,
  exportWorkspace,
  importWorkspace,
  type Workspace,
} from '@/lib/workspaces';

const mono = 'var(--font-mono)';

// ── Components ─────────────────────────────────────────────────────────────────

function WorkspaceCard({
  workspace,
  isActive,
  onActivate,
  onEdit,
  onDelete,
  onDuplicate,
  onExport,
}: {
  workspace: Workspace;
  isActive: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExport: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      onClick={onActivate}
      style={{
        padding: '12px 14px',
        border: `1px solid ${isActive ? workspace.color : 'var(--border-light)'}`,
        borderRadius: 6,
        background: isActive ? `${workspace.color}10` : 'var(--surface)',
        cursor: 'pointer',
        marginBottom: 8,
        position: 'relative',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: workspace.color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-primary)',
            flex: 1,
          }}
        >
          {workspace.name}
        </span>
        {isActive && (
          <span
            style={{
              fontSize: 9,
              color: workspace.color,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            Active
          </span>
        )}
      </div>

      {workspace.description && (
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-secondary)',
            marginLeft: 20,
            marginBottom: 8,
            lineHeight: 1.4,
          }}
        >
          {workspace.description}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 12,
          marginLeft: 20,
          fontSize: 9,
          color: 'var(--text-muted)',
        }}
      >
        {workspace.lenses.length > 0 && <span>{workspace.lenses.length} lenses</span>}
        {workspace.sources.length > 0 && <span>{workspace.sources.length} sources</span>}
        {workspace.annotations.length > 0 && (
          <span>{workspace.annotations.length} notes</span>
        )}
      </div>

      {/* Actions menu */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: 14,
          padding: '2px 6px',
        }}
      >
        ⋯
      </button>

      {showMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 32,
            right: 8,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 0',
            zIndex: 100,
            minWidth: 120,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <MenuItem onClick={() => { onEdit(); setShowMenu(false); }}>Edit</MenuItem>
          <MenuItem onClick={() => { onDuplicate(); setShowMenu(false); }}>Duplicate</MenuItem>
          <MenuItem onClick={() => { onExport(); setShowMenu(false); }}>Export</MenuItem>
          {workspace.ownerId !== 'system' && (
            <MenuItem onClick={() => { onDelete(); setShowMenu(false); }} danger>
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

function CreateWorkspaceModal({
  isOpen,
  onClose,
  onCreate,
  initialLenses,
  initialSources,
  initialRegions,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
  initialLenses: string[];
  initialSources: string[];
  initialRegions: string[];
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

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
          maxWidth: 400,
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Create Workspace</h3>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border-light)',
              borderRadius: 4,
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              fontFamily: mono,
              fontSize: 12,
            }}
            placeholder="My Analysis Workspace"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border-light)',
              borderRadius: 4,
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              fontFamily: mono,
              fontSize: 12,
              minHeight: 60,
              resize: 'vertical',
            }}
            placeholder="Tracking specific developments..."
          />
        </div>

        <div
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            marginBottom: 16,
            padding: '8px 12px',
            background: 'var(--surface-muted)',
            borderRadius: 4,
          }}
        >
          Will save {initialLenses.length} lenses, {initialSources.length} sources,{' '}
          {initialRegions.length} regions from current view.
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
              fontSize: 12,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (name.trim()) {
                onCreate(name.trim(), description.trim());
                setName('');
                setDescription('');
              }
            }}
            disabled={!name.trim()}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 4,
              background: 'var(--accent)',
              color: '#fff',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              fontFamily: mono,
              fontSize: 12,
              opacity: name.trim() ? 1 : 0.5,
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

type Props = {
  activeLenses: Set<string>;
  activeSources: Set<string>;
  activeRegions: Set<string>;
  onLoadWorkspace: (workspace: Workspace) => void;
};

export default function WorkspacePanel({
  activeLenses,
  activeSources,
  activeRegions,
  onLoadWorkspace,
}: Props) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(getWorkspaces());
  const [activeId, setActiveId] = useState<string>(getActiveWorkspace()?.id || '');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refreshWorkspaces = useCallback(() => {
    setWorkspaces(getWorkspaces());
  }, []);

  const handleActivate = useCallback(
    (id: string) => {
      setActiveWorkspace(id);
      setActiveId(id);
      const workspace = getWorkspaceById(id);
      if (workspace) {
        onLoadWorkspace(workspace);
      }
    },
    [onLoadWorkspace]
  );

  const handleCreate = useCallback(
    (name: string, description: string) => {
      const workspace = createWorkspace(name, description, {
        lenses: Array.from(activeLenses),
        sources: Array.from(activeSources),
        regions: Array.from(activeRegions),
      });
      setShowCreate(false);
      refreshWorkspaces();
      handleActivate(workspace.id);
    },
    [activeLenses, activeSources, activeRegions, handleActivate, refreshWorkspaces]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm('Delete this workspace? This cannot be undone.')) {
        deleteWorkspace(id);
        refreshWorkspaces();
        if (activeId === id) {
          const defaultWs = workspaces.find((w) => w.ownerId === 'system');
          if (defaultWs) handleActivate(defaultWs.id);
        }
      }
    },
    [activeId, handleActivate, refreshWorkspaces, workspaces]
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      duplicateWorkspace(id);
      refreshWorkspaces();
    },
    [refreshWorkspaces]
  );

  const handleExport = useCallback((id: string) => {
    const workspace = getWorkspaceById(id);
    if (!workspace) return;
    const exported = exportWorkspace(workspace);
    navigator.clipboard.writeText(exported);
    alert('Workspace exported to clipboard!');
  }, []);

  const handleImport = useCallback(() => {
    const input = prompt('Paste workspace export string:');
    if (!input) return;
    const imported = importWorkspace(input.trim());
    if (imported) {
      const workspaces = getWorkspaces();
      workspaces.push(imported);
      saveWorkspaces(workspaces);
      refreshWorkspaces();
      handleActivate(imported.id);
    } else {
      alert('Invalid workspace export string');
    }
  }, [handleActivate, refreshWorkspaces]);

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
        <span>Workspaces</span>
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

      {/* Workspaces list */}
      <div style={{ marginBottom: 16 }}>
        {workspaces.map((workspace) => (
          <WorkspaceCard
            key={workspace.id}
            workspace={workspace}
            isActive={workspace.id === activeId}
            onActivate={() => handleActivate(workspace.id)}
            onEdit={() => setEditingId(workspace.id)}
            onDelete={() => handleDelete(workspace.id)}
            onDuplicate={() => handleDuplicate(workspace.id)}
            onExport={() => handleExport(workspace.id)}
          />
        ))}
      </div>

      {/* Import/Export */}
      <div
        style={{
          padding: '10px 12px',
          background: 'var(--surface)',
          borderRadius: 6,
          fontSize: 10,
        }}
      >
        <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>Advanced</div>
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
          Import Workspace
        </button>
      </div>

      {/* Info */}
      <div
        style={{
          marginTop: 16,
          padding: '10px 12px',
          background: 'var(--surface-muted)',
          borderRadius: 4,
          fontSize: 9,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        Workspaces save your lens selections, source filters, and regions. Switch
        between different monitoring configurations instantly.
      </div>

      <CreateWorkspaceModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
        initialLenses={Array.from(activeLenses)}
        initialSources={Array.from(activeSources)}
        initialRegions={Array.from(activeRegions)}
      />
    </div>
  );
}

// Helper function that was missing
function getWorkspaceById(id: string): Workspace | undefined {
  return getWorkspaces().find((w) => w.id === id);
}

function saveWorkspaces(workspaces: Workspace[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ftg_workspaces_v1', JSON.stringify(workspaces));
}

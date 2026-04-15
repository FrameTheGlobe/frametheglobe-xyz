/**
 * lib/workspaces.ts
 *
 * Team workspaces for collaborative analysis.
 * Allows saving lens combinations, annotations, and shared views.
 */

export type Workspace = {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  ownerId: string;          // Could be user ID or team ID
  isPublic: boolean;        // Public workspaces are visible to all
  members?: string[];       // Team member IDs
  // Saved view state
  lenses: string[];
  sources: string[];
  regions: string[];
  search?: string;
  // Visual preferences
  layout?: WorkspaceLayout;
  // Annotations
  annotations: Annotation[];
  // Metadata
  tags?: string[];
  color?: string;
};

export type WorkspaceLayout = {
  sidebarOpen: boolean;
  activeTab: string;
  panelSizes?: Record<string, number>; // Panel ID -> size percentage
};

export type Annotation = {
  id: string;
  workspaceId: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  updatedAt: number;
  // Annotation target
  targetType: 'news-item' | 'cluster' | 'market-event' | 'entity' | 'general';
  targetId?: string;        // ID of the item being annotated
  targetUrl?: string;       // Link to referenced item
  // Content
  content: string;
  highlightText?: string;   // Text that was highlighted
  // Position (for UI rendering)
  position?: { x: number; y: number };
  // Reactions
  reactions?: Reaction[];
  // Thread
  replies?: Annotation[];
  // Flags
  isResolved?: boolean;
  isPinned?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'critical';
};

export type Reaction = {
  emoji: string;
  userId: string;
  timestamp: number;
};

// ── Local Storage Keys ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'ftg_workspaces_v1';
const ACTIVE_WORKSPACE_KEY = 'ftg_active_workspace';

// ── Default Workspaces ────────────────────────────────────────────────────────

export const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: 'default-monitoring',
    name: 'Default Monitoring',
    description: 'Standard monitoring view with all major sources',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ownerId: 'system',
    isPublic: true,
    lenses: [],
    sources: [], // Empty means all
    regions: [],
    annotations: [],
    tags: ['default', 'monitoring'],
    color: '#3b82f6',
  },
  {
    id: 'iran-focused',
    name: 'Iran Nuclear Watch',
    description: 'Focused on Iranian nuclear program and related developments',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ownerId: 'system',
    isPublic: true,
    lenses: ['iran', 'nuclear'],
    sources: [],
    regions: ['iranian'],
    annotations: [],
    tags: ['iran', 'nuclear', 'iaea'],
    color: '#ef4444',
  },
  {
    id: 'military-ops',
    name: 'Military Operations',
    description: 'Tracking kinetic military activity and ISR assets',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ownerId: 'system',
    isPublic: true,
    lenses: ['military', 'kinetic', 'intel'],
    sources: [],
    regions: [],
    annotations: [],
    tags: ['military', 'kinetic', 'intel'],
    color: '#f59e0b',
  },
  {
    id: 'energy-markets',
    name: 'Energy & Markets',
    description: 'Oil, gas, and energy market correlations',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ownerId: 'system',
    isPublic: true,
    lenses: ['markets', 'oil', 'energy'],
    sources: ['reuters', 'reuters-markets', 'bloomberg'],
    regions: ['gulf'],
    annotations: [],
    tags: ['energy', 'markets', 'oil'],
    color: '#10b981',
  },
];

// ── Workspace CRUD Operations ─────────────────────────────────────────────────

export function getWorkspaces(): Workspace[] {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACES;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    // Initialize with defaults
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WORKSPACES));
    return DEFAULT_WORKSPACES;
  }

  try {
    const parsed = JSON.parse(stored) as Workspace[];
    // Merge with defaults for any missing system workspaces
    const systemDefaults = DEFAULT_WORKSPACES.filter(
      dw => !parsed.some(w => w.id === dw.id)
    );
    return [...systemDefaults, ...parsed];
  } catch {
    return DEFAULT_WORKSPACES;
  }
}

export function saveWorkspaces(workspaces: Workspace[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
}

export function createWorkspace(
  name: string,
  description: string,
  initialState: {
    lenses: string[];
    sources: string[];
    regions: string[];
    search?: string;
  },
  ownerId: string = 'user',
  isPublic: boolean = false
): Workspace {
  const workspace: Workspace = {
    id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ownerId,
    isPublic,
    lenses: initialState.lenses,
    sources: initialState.sources,
    regions: initialState.regions,
    search: initialState.search,
    annotations: [],
    tags: [],
    color: getRandomWorkspaceColor(),
  };

  const workspaces = getWorkspaces();
  workspaces.push(workspace);
  saveWorkspaces(workspaces);

  return workspace;
}

export function updateWorkspace(id: string, updates: Partial<Workspace>): Workspace | null {
  const workspaces = getWorkspaces();
  const index = workspaces.findIndex(w => w.id === id);
  if (index === -1) return null;

  workspaces[index] = {
    ...workspaces[index],
    ...updates,
    updatedAt: Date.now(),
  };
  saveWorkspaces(workspaces);
  return workspaces[index];
}

export function deleteWorkspace(id: string): boolean {
  const workspaces = getWorkspaces();
  const index = workspaces.findIndex(w => w.id === id);
  if (index === -1) return false;

  // Don't allow deleting system workspaces
  if (workspaces[index].ownerId === 'system') return false;

  workspaces.splice(index, 1);
  saveWorkspaces(workspaces);
  return true;
}

export function getWorkspaceById(id: string): Workspace | undefined {
  return getWorkspaces().find(w => w.id === id);
}

export function setActiveWorkspace(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
}

export function getActiveWorkspace(): Workspace | undefined {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACES[0];
  const id = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  if (!id) return DEFAULT_WORKSPACES[0];
  return getWorkspaceById(id) || DEFAULT_WORKSPACES[0];
}

// ── Annotation Operations ───────────────────────────────────────────────────

export function addAnnotation(
  workspaceId: string,
  annotation: Omit<Annotation, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>
): Annotation | null {
  const workspace = getWorkspaceById(workspaceId);
  if (!workspace) return null;

  const newAnnotation: Annotation = {
    ...annotation,
    id: `anno-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    workspaceId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  workspace.annotations.push(newAnnotation);
  workspace.updatedAt = Date.now();
  updateWorkspace(workspaceId, { annotations: workspace.annotations });

  return newAnnotation;
}

export function updateAnnotation(
  workspaceId: string,
  annotationId: string,
  updates: Partial<Annotation>
): Annotation | null {
  const workspace = getWorkspaceById(workspaceId);
  if (!workspace) return null;

  const index = workspace.annotations.findIndex(a => a.id === annotationId);
  if (index === -1) return null;

  workspace.annotations[index] = {
    ...workspace.annotations[index],
    ...updates,
    updatedAt: Date.now(),
  };

  updateWorkspace(workspaceId, { annotations: workspace.annotations });
  return workspace.annotations[index];
}

export function deleteAnnotation(workspaceId: string, annotationId: string): boolean {
  const workspace = getWorkspaceById(workspaceId);
  if (!workspace) return false;

  const initialLength = workspace.annotations.length;
  workspace.annotations = workspace.annotations.filter(a => a.id !== annotationId);

  if (workspace.annotations.length === initialLength) return false;

  updateWorkspace(workspaceId, { annotations: workspace.annotations });
  return true;
}

export function getAnnotationsForTarget(
  workspaceId: string,
  targetType: Annotation['targetType'],
  targetId?: string
): Annotation[] {
  const workspace = getWorkspaceById(workspaceId);
  if (!workspace) return [];

  return workspace.annotations.filter(a =>
    a.targetType === targetType &&
    (!targetId || a.targetId === targetId)
  );
}

export function addReaction(
  workspaceId: string,
  annotationId: string,
  emoji: string,
  userId: string
): boolean {
  const workspace = getWorkspaceById(workspaceId);
  if (!workspace) return false;

  const annotation = workspace.annotations.find(a => a.id === annotationId);
  if (!annotation) return false;

  if (!annotation.reactions) annotation.reactions = [];

  // Remove existing reaction from same user with same emoji
  annotation.reactions = annotation.reactions.filter(
    r => !(r.userId === userId && r.emoji === emoji)
  );

  annotation.reactions.push({
    emoji,
    userId,
    timestamp: Date.now(),
  });

  updateWorkspace(workspaceId, { annotations: workspace.annotations });
  return true;
}

// ── Utility Functions ─────────────────────────────────────────────────────────

function getRandomWorkspaceColor(): string {
  const colors = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function exportWorkspace(workspace: Workspace): string {
  const exportData = {
    ...workspace,
    exportedAt: Date.now(),
    version: '1.0',
  };
  return btoa(JSON.stringify(exportData));
}

export function importWorkspace(exportedString: string): Workspace | null {
  try {
    const data = JSON.parse(atob(exportedString));
    return {
      ...data,
      id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      annotations: data.annotations || [],
    };
  } catch {
    return null;
  }
}

export function duplicateWorkspace(workspaceId: string, newName?: string): Workspace | null {
  const workspace = getWorkspaceById(workspaceId);
  if (!workspace) return null;

  const duplicated: Workspace = {
    ...workspace,
    id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: newName || `${workspace.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ownerId: 'user', // New owner is current user
    isPublic: false,
    annotations: workspace.annotations.map(a => ({
      ...a,
      id: `anno-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    })),
  };

  const workspaces = getWorkspaces();
  workspaces.push(duplicated);
  saveWorkspaces(workspaces);

  return duplicated;
}

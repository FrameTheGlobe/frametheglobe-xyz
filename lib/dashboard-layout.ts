/**
 * lib/dashboard-layout.ts
 *
 * Dashboard layout management for drag-and-drop widget arrangement.
 * Persistently saves widget positions and sizes.
 */

export type WidgetId =
  | 'feed'
  | 'clusters'
  | 'map'
  | 'polymarket'
  | 'market-ticker'
  | 'oil-ticker'
  | 'missile-intel'
  | 'rapid-response'
  | 'macro-watch'
  | 'accountability'
  | 'predictive'
  | 'anomalies';

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export type WidgetPosition = {
  x: number; // Column start (0-11 for 12-col grid)
  y: number; // Row start
  w: number; // Width in columns
  h: number; // Height in rows
};

export type WidgetConfig = {
  id: WidgetId;
  title: string;
  enabled: boolean;
  position: WidgetPosition;
  size: WidgetSize;
  collapsed?: boolean;
};

export type DashboardLayout = {
  id: string;
  name: string;
  widgets: WidgetConfig[];
  columns: number;      // Typically 12
  rowHeight: number;    // Pixels per row
  gap: number;        // Gap between widgets
  createdAt: number;
  updatedAt: number;
};

// ── Default Layouts ───────────────────────────────────────────────────────────

export const DEFAULT_LAYOUT: DashboardLayout = {
  id: 'default',
  name: 'Default Dashboard',
  columns: 12,
  rowHeight: 80,
  gap: 16,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  widgets: [
    {
      id: 'feed',
      title: 'News Feed',
      enabled: true,
      position: { x: 0, y: 0, w: 8, h: 12 },
      size: 'large',
    },
    {
      id: 'clusters',
      title: 'Story Clusters',
      enabled: true,
      position: { x: 8, y: 0, w: 4, h: 6 },
      size: 'medium',
    },
    {
      id: 'map',
      title: 'Theater Map',
      enabled: true,
      position: { x: 8, y: 6, w: 4, h: 6 },
      size: 'medium',
    },
    {
      id: 'polymarket',
      title: 'Prediction Markets',
      enabled: true,
      position: { x: 0, y: 12, w: 6, h: 4 },
      size: 'medium',
    },
    {
      id: 'market-ticker',
      title: 'Markets',
      enabled: true,
      position: { x: 6, y: 12, w: 6, h: 2 },
      size: 'small',
    },
    {
      id: 'oil-ticker',
      title: 'Oil & Energy',
      enabled: true,
      position: { x: 6, y: 14, w: 6, h: 2 },
      size: 'small',
    },
  ],
};

export const COMPACT_LAYOUT: DashboardLayout = {
  id: 'compact',
  name: 'Compact View',
  columns: 12,
  rowHeight: 60,
  gap: 12,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  widgets: [
    {
      id: 'feed',
      title: 'News Feed',
      enabled: true,
      position: { x: 0, y: 0, w: 12, h: 8 },
      size: 'full',
    },
    {
      id: 'clusters',
      title: 'Clusters',
      enabled: true,
      position: { x: 0, y: 8, w: 6, h: 4 },
      size: 'medium',
    },
    {
      id: 'map',
      title: 'Map',
      enabled: true,
      position: { x: 6, y: 8, w: 6, h: 4 },
      size: 'medium',
    },
  ],
};

export const ANALYSIS_LAYOUT: DashboardLayout = {
  id: 'analysis',
  name: 'Analysis Focus',
  columns: 12,
  rowHeight: 80,
  gap: 16,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  widgets: [
    {
      id: 'predictive',
      title: 'Predictive Intelligence',
      enabled: true,
      position: { x: 0, y: 0, w: 4, h: 6 },
      size: 'medium',
    },
    {
      id: 'anomalies',
      title: 'Anomaly Detection',
      enabled: true,
      position: { x: 4, y: 0, w: 4, h: 6 },
      size: 'medium',
    },
    {
      id: 'clusters',
      title: 'Story Clusters',
      enabled: true,
      position: { x: 8, y: 0, w: 4, h: 6 },
      size: 'medium',
    },
    {
      id: 'feed',
      title: 'News Feed',
      enabled: true,
      position: { x: 0, y: 6, w: 8, h: 10 },
      size: 'large',
    },
    {
      id: 'map',
      title: 'Theater Map',
      enabled: true,
      position: { x: 8, y: 6, w: 4, h: 6 },
      size: 'medium',
    },
    {
      id: 'polymarket',
      title: 'Prediction Markets',
      enabled: true,
      position: { x: 8, y: 12, w: 4, h: 4 },
      size: 'small',
    },
  ],
};

// ── Storage ──────────────────────────────────────────────────────────────────

const LAYOUT_STORAGE_KEY = 'ftg_dashboard_layout_v1';
const ACTIVE_LAYOUT_KEY = 'ftg_active_layout';

export function getLayouts(): DashboardLayout[] {
  if (typeof window === 'undefined') {
    return [DEFAULT_LAYOUT, COMPACT_LAYOUT, ANALYSIS_LAYOUT];
  }

  const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
  if (!stored) {
    const defaults = [DEFAULT_LAYOUT, COMPACT_LAYOUT, ANALYSIS_LAYOUT];
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }

  try {
    const parsed = JSON.parse(stored) as DashboardLayout[];
    // Ensure defaults exist
    const defaults = [DEFAULT_LAYOUT, COMPACT_LAYOUT, ANALYSIS_LAYOUT];
    const missing = defaults.filter((d) => !parsed.some((p) => p.id === d.id));
    return [...missing, ...parsed];
  } catch {
    return [DEFAULT_LAYOUT, COMPACT_LAYOUT, ANALYSIS_LAYOUT];
  }
}

export function saveLayouts(layouts: DashboardLayout[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layouts));
}

export function getActiveLayout(): DashboardLayout {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT;

  const id = localStorage.getItem(ACTIVE_LAYOUT_KEY);
  if (!id) return DEFAULT_LAYOUT;

  return getLayouts().find((l) => l.id === id) || DEFAULT_LAYOUT;
}

export function setActiveLayout(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_LAYOUT_KEY, id);
}

// ── Layout Operations ─────────────────────────────────────────────────────────

export function saveLayout(layout: DashboardLayout): void {
  const layouts = getLayouts();
  const index = layouts.findIndex((l) => l.id === layout.id);

  const updated = {
    ...layout,
    updatedAt: Date.now(),
  };

  if (index >= 0) {
    layouts[index] = updated;
  } else {
    layouts.push(updated);
  }

  saveLayouts(layouts);
}

export function createLayout(name: string, baseLayoutId?: string): DashboardLayout {
  const base = baseLayoutId
    ? getLayouts().find((l) => l.id === baseLayoutId)
    : DEFAULT_LAYOUT;

  const newLayout: DashboardLayout = {
    ...(base || DEFAULT_LAYOUT),
    id: `layout-${Date.now()}`,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    widgets: (base || DEFAULT_LAYOUT).widgets.map((w) => ({ ...w })),
  };

  const layouts = getLayouts();
  layouts.push(newLayout);
  saveLayouts(layouts);

  return newLayout;
}

export function deleteLayout(id: string): boolean {
  if (['default', 'compact', 'analysis'].includes(id)) return false; // Protect defaults

  const layouts = getLayouts();
  const filtered = layouts.filter((l) => l.id !== id);
  if (filtered.length === layouts.length) return false;

  saveLayouts(filtered);

  // Reset active if deleted
  if (getActiveLayout().id === id) {
    setActiveLayout('default');
  }

  return true;
}

export function updateWidgetPosition(
  layoutId: string,
  widgetId: WidgetId,
  position: WidgetPosition
): DashboardLayout | null {
  const layouts = getLayouts();
  const layout = layouts.find((l) => l.id === layoutId);
  if (!layout) return null;

  const widget = layout.widgets.find((w) => w.id === widgetId);
  if (!widget) return null;

  widget.position = position;
  layout.updatedAt = Date.now();

  saveLayouts(layouts);
  return layout;
}

export function toggleWidget(layoutId: string, widgetId: WidgetId): DashboardLayout | null {
  const layouts = getLayouts();
  const layout = layouts.find((l) => l.id === layoutId);
  if (!layout) return null;

  const widget = layout.widgets.find((w) => w.id === widgetId);
  if (widget) {
    widget.enabled = !widget.enabled;
  } else {
    // Add widget if not present
    layout.widgets.push(createDefaultWidget(widgetId));
  }

  layout.updatedAt = Date.now();
  saveLayouts(layouts);
  return layout;
}

export function resizeWidget(
  layoutId: string,
  widgetId: WidgetId,
  size: WidgetSize
): DashboardLayout | null {
  const layouts = getLayouts();
  const layout = layouts.find((l) => l.id === layoutId);
  if (!layout) return null;

  const widget = layout.widgets.find((w) => w.id === widgetId);
  if (!widget) return null;

  widget.size = size;
  // Update position based on size
  const sizes: Record<WidgetSize, { w: number; h: number }> = {
    small: { w: 3, h: 2 },
    medium: { w: 4, h: 4 },
    large: { w: 6, h: 6 },
    full: { w: 12, h: 8 },
  };
  widget.position = { ...widget.position, ...sizes[size] };

  layout.updatedAt = Date.now();
  saveLayouts(layouts);
  return layout;
}

// ── Helper Functions ─────────────────────────────────────────────────────────

function createDefaultWidget(id: WidgetId): WidgetConfig {
  const titles: Record<WidgetId, string> = {
    feed: 'News Feed',
    clusters: 'Story Clusters',
    map: 'Theater Map',
    polymarket: 'Prediction Markets',
    'market-ticker': 'Markets',
    'oil-ticker': 'Oil & Energy',
    'missile-intel': 'Missile Intel',
    'rapid-response': 'Rapid Response',
    'macro-watch': 'Macro Watch',
    accountability: 'Accountability',
    predictive: 'Predictive Intelligence',
    anomalies: 'Anomaly Detection',
  };

  return {
    id,
    title: titles[id] || id,
    enabled: true,
    position: { x: 0, y: 0, w: 4, h: 4 },
    size: 'medium',
  };
}

export function exportLayout(layout: DashboardLayout): string {
  return btoa(JSON.stringify({ ...layout, exportedAt: Date.now() }));
}

export function importLayout(exported: string): DashboardLayout | null {
  try {
    const parsed = JSON.parse(atob(exported));
    return {
      ...parsed,
      id: `layout-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export function resetLayout(id: string): DashboardLayout | null {
  const defaults: Record<string, DashboardLayout> = {
    default: DEFAULT_LAYOUT,
    compact: COMPACT_LAYOUT,
    analysis: ANALYSIS_LAYOUT,
  };

  const defaultLayout = defaults[id];
  if (!defaultLayout) return null;

  const layouts = getLayouts();
  const index = layouts.findIndex((l) => l.id === id);
  if (index >= 0) {
    layouts[index] = { ...defaultLayout, updatedAt: Date.now() };
    saveLayouts(layouts);
  }

  return defaultLayout;
}

export function detectCollisions(layout: DashboardLayout): WidgetConfig[] {
  const colliding: WidgetConfig[] = [];

  for (let i = 0; i < layout.widgets.length; i++) {
    for (let j = i + 1; j < layout.widgets.length; j++) {
      const a = layout.widgets[i];
      const b = layout.widgets[j];

      if (!a.enabled || !b.enabled) continue;

      const overlap =
        a.position.x < b.position.x + b.position.w &&
        a.position.x + a.position.w > b.position.x &&
        a.position.y < b.position.y + b.position.h &&
        a.position.y + a.position.h > b.position.y;

      if (overlap) {
        colliding.push(a, b);
      }
    }
  }

  return [...new Set(colliding)];
}

export function autoArrange(layout: DashboardLayout): DashboardLayout {
  // Simple auto-arrange: sort by priority and place in grid
  const sorted = [...layout.widgets]
    .filter((w) => w.enabled)
    .sort((a, b) => {
      const priority: Record<WidgetId, number> = {
        feed: 1,
        clusters: 2,
        map: 3,
        predictive: 4,
        anomalies: 5,
        polymarket: 6,
        'market-ticker': 7,
        'oil-ticker': 8,
        'missile-intel': 9,
        'rapid-response': 10,
        'macro-watch': 11,
        accountability: 12,
      };
      return (priority[a.id] || 99) - (priority[b.id] || 99);
    });

  let currentX = 0;
  let currentY = 0;
  let rowHeight = 0;

  for (const widget of sorted) {
    if (currentX + widget.position.w > layout.columns) {
      currentX = 0;
      currentY += rowHeight;
      rowHeight = 0;
    }

    widget.position.x = currentX;
    widget.position.y = currentY;
    rowHeight = Math.max(rowHeight, widget.position.h);
    currentX += widget.position.w;
  }

  layout.updatedAt = Date.now();
  return layout;
}

# FrameTheGlobe Design Guide

FrameTheGlobe is a “tactical HUD” rather than a conventional news website. The design goal is sustained situational awareness: dense information, clear state signaling, and fast scanning.

This guide documents the UI and styling conventions currently implemented in this repo.

## Core Principles

### Information-First Density
The UI avoids large stretches of empty space. Instead, it uses compact rows, short labels, and tightly scoped panels that can be understood without reading paragraphs.

### Signal Over Decoration
Animations and glass effects exist to communicate *state* (live/connecting, breaking, consensus/contradiction), not to entertain.

### Blue/Cyan “Mission Control” Theme
The design emphasizes authority and clarity via:
- light/dark theme tokens
- cyan/blue accents
- monospaced typography for data-like content

## Styling System

### Theme Tokens (CSS Variables)
All theme values are defined in `app/globals.css`.

The CSS defines a light theme under `:root` and a dark theme under:
- `[data-theme="dark"] { ... }`

The `<html>` element gets `data-theme` dynamically from the client:
- `app/page.tsx` sets `document.documentElement.setAttribute('data-theme', theme)`

#### Practical implications
- Add new color tokens as CSS variables in `app/globals.css`
- Avoid hardcoding colors inside components
- When implementing new UI states, prefer existing semantic tokens (`--accent`, `--border-light`, `--hud-text`, `--hud-muted`, etc.)

### Typography (next/font)
`app/layout.tsx` loads fonts using `next/font/google`:
- `Lora` assigned to CSS variable `--font-lora`
- `IBM Plex Mono` assigned to `--font-ibm-mono`

`app/globals.css` maps these into:
- `--font-body`
- `--font-mono`

Components that show “data-like” values should prefer the monospaced token.

## Motion and Feedback

`app/globals.css` defines keyframes and utilities for:
- shimmer/skeleton loading
- pulse-dot live status
- glitch/glassy HUD motion
- radar scan rings

Components should:
- use these pre-defined classes
- ensure motion is subtle and state-linked (live status, loading, focus)

## Layout and Visual Language

### “Command Header HUD”
The header styling uses the `command-header-hud` class in `app/globals.css`, including:
- `backdrop-filter: blur(...) saturate(...)`
- a gradient top line
- controlled min-height and borders

If you add new header/toolbar elements, follow this convention:
- use the HUD header base class
- keep controls compact and label-led

### Live Indicators
`app/globals.css` includes `live-dot` which:
- pulses at a fixed interval
- communicates “live” status

When you add new live/state indicators, prefer reusing `live-dot` or matching its visual rhythm.

## Component Conventions

### Client vs Server Components
`app/page.tsx` is explicitly a client component (`'use client';`) because it uses hooks and SSE/polling orchestration.

If you create a new component under `app/components/` that uses hooks, ensure it includes `'use client'` at the top. The repo’s `scripts/check.sh` will flag missing `use client`.

### MapView Isolation
Leaflet must run client-side only. `app/page.tsx` loads the map via:

`dynamic(() => import('./components/MapView'), { ssr: false })`

Do not import `leaflet` directly in server components.

## Visual Encoding of Intelligence

The UI’s “intelligence” concepts are numeric and boolean outputs derived from:
- clustering logic in `app/page.tsx`
- scoring and filtering logic in `lib/fetcher.ts`

When rendering these outputs, the design encodes them as:
- Breaking vs New vs Stable (age badges)
- Consensus vs Contradiction and corroboration count
- Market linkage hints and missile signal counts

Concrete cluster fields (see `app/page.tsx`’s `Cluster` type and `buildClusters()`):
- `score`
- `consensus` (0–1)
- `contradiction` (0–1)
- `corroborationCount`
- `avgTrust`, `avgRelevance`
- `hasMarketSignal`, `marketImpactHint` (if computed by utilities)
- `hasMissileSignal`, `missileCount`

When adding new cluster-derived visuals:
- map numeric values to a consistent threshold scheme
- show enough context to avoid misleading certainty (e.g., show source count alongside consensus)

## Adding New Lenses / Filters (UI Patterns)

`app/page.tsx` defines:
- `LENSES`: topic filters with `id`, `label`, `hint`, and `keywords`
- lens selection is driven by `activeLenses` and keyboard shortcuts (`1` clears, `2-9` toggle lenses)

To add a lens:
1. Add it to the `LENSES` array with a stable `id`
2. Ensure its `keywords` meaningfully match the tokenization approach used by filtering (it checks keyword presence against title/summary text)
3. Consider whether the lens should affect clustering, or only affects visibility of items

## Accessibility and UX Notes

This app prioritizes speed and density, but it still includes:
- keyboard navigation (`j/k`, `/`, `Escape`, `m`, `s`, lens digit toggles)
- focus states and pinned items persistence

When updating UX:
- keep keyboard shortcuts functional
- ensure new interactive UI elements remain reachable and don’t trap focus


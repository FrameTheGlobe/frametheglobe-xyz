# Recent Updates (Apr 2026)

This document tracks major changes made after the split-stack migration docs were first written.

## 1) Frontend/Backend Cost + Traffic Optimizations

- Converted Next.js API routes into thin proxies using `lib/backend-proxy.ts`:
  - `proxyGet()` for GET routes
  - `proxyPost()` for POST routes
  - `proxySSE()` for SSE redirect routes
- `/api/stream` now redirects browser SSE directly to Railway rather than holding long-lived connections on Vercel functions.
- `NEXT_PUBLIC_BACKEND_URL` is wired into the client SSE `EventSource` flow.
- Added response caching/revalidation on selected proxy routes (`news`, `oil-history`, `ai-intel`, `flash-brief`) to reduce invocation churn.
- Reduced high-frequency polling pressure (e.g., flights polling moved from 60s to 300s).

## 2) Sidebar Theater Escalation Pulse Enhancements

The left sidebar pulse card was expanded beyond the original three metrics.

### Existing/retained
- BREAKING count (recent story activity)
- KINETIC signal (high-intensity conflict language)
- HORMUZ signal (strait/chokepoint watch)

### Added
- NUCLEAR pulse:
  - 6-hour story count for nuclear/IAEA-related terms.
- BRENT − WTI strip:
  - spread value and daily delta context from `/api/market`.
- POLY MAX:
  - maximum YES probability from available outcomes in `/api/polymarket`.

### Behavior updates
- Pulse elevation now also considers nuclear signal thresholds.
- Market + Polymarket refreshes use visibility-aware polling (`useVisibilityPolling`) so updates run when tab is visible, limiting wasted background traffic.

## 3) Readability & Typography Pass

Applied focused readability improvements to both nav columns:

- Left column (`SidebarPanel`, `sidebar-col`):
  - clearer tab labels and controls
  - improved section label sizing/spacing
  - more legible source rows/count pills
  - pinned report readability bumps
- Right column (`intel-column`, Strategic Brief):
  - stronger title/live badge readability
  - improved timeline area spacing
  - improved secondary scanner banner legibility
- Added `ftg-nav-readable` utility usage for nav text rendering/smoothing.

## 4) Mobile Header Overlap Fixes

The compact header was hardened for narrow devices to prevent brand/action collisions.

- Added breakpoint-specific reductions for controls and spacing.
- On very narrow widths (320-375px), header degrades to essential controls for clarity.
- Time/social/non-essential header items are hidden earlier at narrow breakpoints.
- Brand line protection added (`nowrap`, truncation behavior where needed).

## 5) Sticky Top Experience

Both top bars now remain visible during scroll:

- Main command header remains sticky.
- Breaking ticker is also sticky and sits directly under the header.
- Ticker top offset is dynamically derived from measured header height (`ResizeObserver`) so it remains accurate across breakpoints.

## 6) Validation Status

All updates were verified during implementation with:

- `npx tsc --noEmit`
- lint checks on touched files

No new lint/type errors were introduced in the changed files.

## 7) Levant accountability tracker (v7.1.4)

- Thin **rail** under the breaking ticker with an **expandable bottom sheet** (mobile-friendly: safe-area padding, scroll lock, Escape to close).
- Curated entries in `lib/accountability-data.ts` with external source links and neutral status labels.
- Bookmarkable full page at **`/accountability`** (`app/accountability/`).

## 8) Situation desk UX pass + live metrics direction (in progress)

This is a paused in-progress snapshot committed locally for continuation:

- Added `app/components/LiveSituationStrip.tsx`:
  - reusable metric cards for Gaza / Lebanon / West Bank rows
  - compact horizontal rail mode and comfortable expanded mode
  - explicit source-first UX and per-row `asOf` visibility
- Added `lib/live-situation-metrics.ts`:
  - editorial metric schema (`valueDisplay`, `basis`, `asOf`, `sourceUrl`, caveat)
  - guardrail comments to avoid shipping uncited / invented totals
  - helper labels and latest-sync helpers
- Updated `app/components/AccountabilityTracker.tsx`:
  - rail now includes a "live situation" block + existing timeline expansion
  - sheet now shows live metrics section before the source timeline
- Updated `app/components/AccountabilityFullPage.tsx`:
  - full page now includes live situation grid before timeline filters/list
- Updated `app/accountability/layout.tsx` metadata to "Levant situation desk"
- Styling additions in `app/globals.css`:
  - `ftg-live-situation*` and `ftg-live-metric*` classes
  - region color accents and mobile-safe horizontal scroll behavior

- Add backend-fed `GET /api/situation-metrics` on Railway + thin Next proxy route,
  then switch `LiveSituationStrip` from static imports to fetched JSON with
  static fallback.

## 9) Dynamic HUD v8.0.x (Compact Header + Flash Brief overhaul)

Major UX/UI synchronization to version 8.0.5+.

### Unified Navigation Header
- **CompactHeader (v8.0.1)**: Unified the site branding and primary controls.
- **Persistent Toggle**: Integrated a mode switch between "FLASH" and "COMMAND".
- **Mobile Grid**: Re-engineered the header CSS grid to stack vertically on mobile (Brand/Actions/Toggle/Ticker hierarchy).
- **Hardened Mobile UX**: Brand labels and metadata auto-hide on narrow viewports to preserve space for tactical actions.

### Realtime 12-hour Rolling Feed (v8.0.4)
- **FlashBriefView**: Redesigned the "Flash" view as a continuous vertical scroll rather than a static snippet list.
- **Window Expansion**: Broadened the intelligent filter from 30 minutes to a **12-hour window**, ensuring a meaningful story volume for the simplified view.
- **High-Readability Stream**: Removed layout noise (widgets/sidebars) in favor of the intelligence signal.

### Live Market Hub (v8.0.5)
- **Dynamic Oil Data**: The Flash view now performs private polling of `/api/market` to extract real-time WTI and Brent crude values.
- **Bottom Navigation Hub**: Relocated market data from a corner widget to a **centered, glassmorphic bar** at the bottom of the viewport.
- **Visual Feedback**: Added pulsing live-dots and sync-status text to confirm data freshness.

### Accountability Tracker Maintenance
- Ensured the `AccountabilityTracker` rail remains visible and accessible across both Flash and Command views for consistent visibility into Levant situation metrics.

---
*All v8.0.x updates were verified against the production build environment and optimized for mobile-first thumb reach.*

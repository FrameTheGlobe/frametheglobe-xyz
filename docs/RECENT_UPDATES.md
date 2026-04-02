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

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

## 10) War Premium Board (v8.0.8)

A new high-visibility widget that answers the question: *"how much have markets and households repriced since the Iran war began?"*

### Anchor configuration
- **War start**: `2026-02-28` (Iran war kinetic phase)
- **Pre-war baseline**: `2025-11-28` (T−3 months, for visual timeline context)

### Placement
- **Compact sidebar card** (`app/components/WarPremiumCompact.tsx`) mounted in the left sidebar directly below `SidebarTheaterPulse`. Paired visually with the pulse: "what is happening now" (Theater Pulse) → "what it's cost the world" (War Premium).
- **Full board** (`app/components/WarPremiumBoard.tsx`) opens inline under the compact card on "View full board" — no modal, no nav.

### Row coverage (14 rows)
- **Energy**: Brent, WTI, Natural Gas
- **Metals**: Gold, Silver, Copper
- **Agri**: CBOT Wheat, Urea (CF Industries proxy)
- **Household (US retail)**: Gasoline, Diesel, Bread 1 lb
- **Inflation**: US CPI Headline, US CPI Food at Home, FAO Food Price Index

### Key UX
- **Dual delta framing** per row: a big "Since war" Δ% is the hero number; "vs baseline Nov 28 2025" appears beneath for pre-war context. This reveals whether the price was already creeping before the war or whether the war itself bent the line.
- **Timeline sparkline** per row spans `baseline → today` with a dashed red vertical tick at the war-start date, plus a red dot on the line at that point. The visual proof of "war premium" in one glance.
- **Crisis-aware color**: each row declares a `crisisDirection` — oil/gold/food/etc. moving up is rendered in red (crisis), moves in the other direction render green (relief). Kept from being naive up=green, down=red.
- **Hero card** in sidebar: spotlights **Brent** (markets), **US Gasoline** (households), **FAO Food Index** (global food). Each shows current price + Δ% since war + tiny sparkline with war tick.
- **Asset class filter** in the full board (All / Energy / Metals / Agri / Household / Inflation).
- **Expandable row detail**: click any row to reveal cited source URLs for each of the three anchor readings (baseline / war-start / current) plus a methodology note.

### Data architecture
- **Fallback baselines** in `lib/war-baselines.ts` remain for resilience if upstream feeds fail.
- **Live history hydration**: backend now serves `GET /api/since-war-history` (Stooq daily closes for commodities) and `GET /api/household-prices` (FRED-backed weekly/monthly household + inflation series). Next.js proxies both routes.
- **Runtime row overrides**: `WarPremiumCompact` and `WarPremiumBoard` override fallback `priceBaseline`, `priceAtWarStart`, `priceCurrent`, and `sparkline` from these live feeds.
- **Commodity spot overlay** remains active from `/api/market`, `/api/precious-metals`, and `/api/agri-market` for fresher intraday current prices.

### Still pending
- Bookmarkable `/war-premium` page with its own open-graph card.
- User-selectable secondary anchors (e.g. "compare against 6 months before"), FX/rates/equities rows.
- `scripts/refresh-baselines.mjs` maintainer tool that pulls suggested anchor closes from Yahoo and emits a diff against `war-baselines.ts`.

### Files touched
- New: `lib/war-baselines.ts`, `app/components/WarPremiumCompact.tsx`, `app/components/WarPremiumBoard.tsx`
- Edited: `app/page.tsx` (sidebar mount), `app/globals.css` (+≈430 lines), `app/components/CompactHeader.tsx` (version string), `package.json` (8.0.7 → 8.0.8), `README.md`, `backend/src/index.ts`, `backend/src/routes/precious-metals.ts`, `backend/src/routes/agri-market.ts`
- Added: `backend/src/routes/since-war-history.ts`, `backend/src/routes/household-prices.ts`, `app/api/since-war-history/route.ts`, `app/api/household-prices/route.ts`

---
*All v8.0.x updates were verified against the production build environment and optimized for mobile-first thumb reach.*

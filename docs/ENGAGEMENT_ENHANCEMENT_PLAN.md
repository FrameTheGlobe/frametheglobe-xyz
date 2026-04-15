# FrameTheGlobe Engagement Enhancement Plan

**Created:** April 14, 2026
**Status:** Planning Phase

## Overview

This document outlines a phased approach to enhancing FrameTheGlobe's engagement and data flow capabilities. The plan prioritizes high-impact, quick-win features first, followed by medium-term enhancements, and longer-term advanced features.

## Current State Summary

**Recent Major Additions:**
- AccountabilityTracker — Levant situation desk with curated UN documents, court filings, humanitarian updates
- LiveSituationStrip — Live editorial metrics for Gaza, Lebanon, West Bank with source citations
- PolymarketBoard — Prediction markets widget
- Sidebar pulse enhancements — Nuclear, kinetic, hormuz signals + Brent-WTI spread + Polymarket max probability
- Sticky header + breaking ticker

**Existing Capabilities:**
- News aggregation from 50+ RSS sources with clustering, scoring, deduplication
- Oil/metals/commodities pricing boards
- ADS-B flight tracking with strategic classification
- AI intelligence panel (Groq-powered)
- Live video feeds
- Map view
- SSE live updates
- 18 topic lenses, 7 alert profiles
- Cross-source comparison, Intel timeline, Daily briefing

---

## Phase 1: Quick Wins (1-2 weeks)

### 1.1 News ↔ Market Correlation
**Goal:** Overlay price changes on news clusters to show market impact

**Implementation:**
- Extend `Cluster` type to include `marketImpact` object with price changes for relevant symbols
- Modify `buildClusters()` in `app/page.tsx` to correlate cluster timestamps with market data
- Add market impact badges to cluster cards showing:
  - Oil price change (if cluster contains oil keywords)
  - Metals price change (if cluster contains metals keywords)
  - Brent-WTI spread delta
- Add API endpoint `/api/market-impact` that returns price changes for a given time window
- Cache results with 5-minute TTL

**Files to modify:**
- `app/page.tsx` — Cluster type, buildClusters function
- `app/api/market-impact/route.ts` — New API route
- `lib/backend-proxy.ts` — Add proxyGet call

### 1.2 Polymarket Probability History Charts
**Goal:** Time-series visualization showing YES probability evolution over time

**Implementation:**
- Add backend route `/api/polymarket/history` that fetches historical probability data
- Store historical snapshots in backend with 15-minute intervals
- Create `PolymarketHistoryChart` component using Recharts or lightweight SVG
- Add "History" button to each Polymarket card that opens a modal with the chart
- Annotate chart with news cluster timestamps

**Files to create:**
- `backend/src/routes/polymarket-history.ts` — Historical data endpoint
- `app/api/polymarket-history/route.ts` — Frontend proxy
- `app/components/PolymarketHistoryChart.tsx` — Chart component
- `app/components/PolymarketHistoryModal.tsx` — Modal wrapper

**Files to modify:**
- `app/components/PolymarketBoard.tsx` — Add history button

### 1.3 Cluster Source Breakdown Drill-Down
**Goal:** Click a cluster to see source-by-source breakdown with trust scores

**Implementation:**
- Add `ClusterDetailModal` component that shows:
  - All items in the cluster
  - Source name, region, trust score for each item
  - Publication time
  - Relevance score breakdown
- Add click handler to cluster cards to open modal
- Show consensus/contradiction indicators per source
- Add "View sources" button to cluster headers

**Files to create:**
- `app/components/ClusterDetailModal.tsx` — Modal component

**Files to modify:**
- `app/page.tsx` — Add modal state and handlers

### 1.4 Shareable Brief Links
**Goal:** URLs with pre-applied filters/lenses for easy sharing

**Implementation:**
- Add URL parameter parsing for:
  - `lenses` — Comma-separated lens IDs
  - `sources` — Comma-separated source IDs
  - `view` — View mode (list/clusters/map)
  - `alertProfile` — Alert profile ID
- Update `useEffect` in `app/page.tsx` to read URL params on mount
- Add "Share this view" button that copies current state to clipboard
- Add "Copy link" button to each cluster

**Files to modify:**
- `app/page.tsx` — URL param parsing, share button
- `app/components/CompactHeader.tsx` — Add share button

---

## Phase 2: Medium Term (1-2 months)

### 2.1 Entity Extraction and Tracking
**Goal:** Extract key entities (people, organizations, locations) from news

**Implementation:**
- Add backend route `/api/entities` that uses NLP or regex to extract entities
- Create `lib/entities.ts` with entity type definitions and extraction logic
- Add entity sidebar panel showing:
  - Trending entities (by mention frequency)
  - Entity-specific news feeds
  - Entity relationship graph
- Click on entity to filter news by that entity
- Store entity mentions in backend cache with 1-hour TTL

**Files to create:**
- `backend/src/routes/entities.ts` — Entity extraction endpoint
- `app/api/entities/route.ts` — Frontend proxy
- `lib/entities.ts` — Entity types and extraction logic
- `app/components/EntityPanel.tsx` — Entity sidebar

**Files to modify:**
- `app/page.tsx` — Add entity panel state

### 2.2 Browser Push Notifications
**Goal:** High-relevance breaking news alerts via browser notifications

**Implementation:**
- Add notification permission request on first visit
- Create `/api/notifications/register` endpoint for subscription management
- Use Web Push API with VAPID keys
- Trigger notifications when:
  - Cluster score exceeds threshold
  - Nuclear/kinetic signal elevated
  - Polymarket probability crosses threshold
- Add notification preferences in settings

**Files to create:**
- `backend/src/routes/notifications.ts` — Notification management
- `app/api/notifications/route.ts` — Frontend proxy
- `lib/notifications.ts` — Notification utilities
- `app/components/NotificationPreferences.tsx` — Settings UI

**Files to modify:**
- `app/page.tsx` — Add notification triggers
- `backend/src/routes/news.ts` — Emit notification events

### 2.3 Accountability Event Timeline Visualization
**Goal:** Visual calendar of UN filings, court documents, humanitarian updates

**Implementation:**
- Create `AccountabilityTimeline` component with:
  - Horizontal timeline view
  - Color-coded event types (courts, UN, humanitarian)
  - Click to view event details
  - Zoom controls (day/week/month views)
- Integrate with existing `AccountabilityTracker`
- Add timeline view to `/accountability` full page
- Show related news clusters for each event

**Files to create:**
- `app/components/AccountabilityTimeline.tsx` — Timeline component

**Files to modify:**
- `app/components/AccountabilityFullPage.tsx` — Add timeline view
- `app/components/AccountabilityTracker.tsx` — Add timeline link

### 2.4 Flight Path Visualization
**Goal:** Draw aircraft trajectories with news event overlays

**Implementation:**
- Store flight history in backend (last 2 hours)
- Create `FlightPathMap` component using Leaflet with:
  - Animated flight paths
  - Strategic aircraft highlighting
  - News event markers on map
  - Time slider for playback
- Add "Flight paths" button to `MissileIntel` or `IranWarSection`
- Correlate flight patterns with news events

**Files to create:**
- `backend/src/routes/flight-history.ts` — Flight history endpoint
- `app/api/flight-history/route.ts` — Frontend proxy
- `app/components/FlightPathMap.tsx` — Map component

**Files to modify:**
- `lib/flights.ts` — Add history storage
- `app/components/IranWarSection.tsx` — Add flight paths button

---

## Phase 3: Longer Term (3+ months)

### 3.1 Predictive Modeling
**Goal:** Forecast probability based on historical patterns

**Implementation:**
- Collect historical data on:
  - News cluster scores
  - Market price movements
  - Polymarket probabilities
  - Flight pattern changes
- Implement simple regression or time-series model
- Create `/api/predictions` endpoint
- Add prediction indicators to relevant widgets
- Show confidence intervals

**Files to create:**
- `backend/src/lib/predictions.ts` — Prediction logic
- `backend/src/routes/predictions.ts` — Predictions endpoint
- `app/api/predictions/route.ts` — Frontend proxy

### 3.2 Team Workspaces and Annotations
**Goal:** Shared lens combinations and team notes

**Implementation:**
- Add user authentication (or simple team codes)
- Create `/api/workspaces` endpoint for CRUD operations
- Add workspace UI in settings
- Allow saving:
  - Custom lens combinations
  - Alert profiles
  - Annotations on clusters
- Share workspaces via team codes

**Files to create:**
- `backend/src/routes/workspaces.ts` — Workspace management
- `app/api/workspaces/route.ts` — Frontend proxy
- `app/components/WorkspaceSettings.tsx` — Settings UI
- `app/components/AnnotationPanel.tsx` — Annotation UI

### 3.3 Advanced Anomaly Detection
**Goal:** Flag unusual patterns in news volume, market moves, flight activity

**Implementation:**
- Implement statistical anomaly detection (Z-score, isolation forest)
- Monitor:
  - News volume spikes
  - Unusual market movements
  - Flight pattern deviations
  - Source failure patterns
- Create `/api/anomalies` endpoint
- Add anomaly badges to relevant UI elements
- Send alerts for critical anomalies

**Files to create:**
- `backend/src/lib/anomaly-detection.ts` — Anomaly detection logic
- `backend/src/routes/anomalies.ts` — Anomalies endpoint
- `app/api/anomalies/route.ts` — Frontend proxy
- `app/components/AnomalyPanel.tsx` — Anomaly display

### 3.4 Drag-and-Drop Dashboard Layout
**Goal:** Customizable widget arrangement

**Implementation:**
- Use react-grid-layout or similar library
- Make all major widgets draggable:
  - AccountabilityTracker
  - IranWarSection
  - PolymarketBoard
  - LiveFeeds
  - AIIntelPanel
- Save layout to localStorage
- Add "Reset layout" button
- Support responsive layouts

**Files to create:**
- `app/components/DashboardLayout.tsx` — Layout wrapper
- `lib/layout-storage.ts` — Layout persistence

**Files to modify:**
- `app/page.tsx` — Wrap widgets in DashboardLayout
- `app/components/IranWarSection.tsx` — Make draggable
- `app/components/AccountabilityTracker.tsx` — Make draggable

---

## Execution Order

1. **Phase 1.1** — News ↔ Market correlation (highest impact, moderate complexity)
2. **Phase 1.2** — Polymarket probability history (high impact, moderate complexity)
3. **Phase 1.3** — Cluster source breakdown (medium impact, low complexity)
4. **Phase 1.4** — Shareable brief links (medium impact, low complexity)
5. **Phase 2.1** — Entity extraction (high impact, high complexity)
6. **Phase 2.2** — Push notifications (high impact, medium complexity)
7. **Phase 2.3** — Accountability timeline (medium impact, medium complexity)
8. **Phase 2.4** — Flight paths (medium impact, high complexity)
9. **Phase 3.1-3.4** — Advanced features (as time permits)

---

## Success Metrics

- **Engagement:** Increased time on site, more frequent returns
- **Data Flow:** More cross-domain correlations discovered by users
- **Sharing:** Increased use of shareable links
- **Alerts:** Higher notification opt-in rate and engagement
- **Adoption:** Usage of new features (timeline, entity panel, etc.)

---

## Notes

- All new API routes should follow existing proxy pattern via `lib/backend-proxy.ts`
- Maintain existing caching strategies and SSE patterns
- Keep mobile responsiveness in mind for all new features
- Test all new features with existing alert profiles and lenses
- Document new features in `docs/RECENT_UPDATES.md`

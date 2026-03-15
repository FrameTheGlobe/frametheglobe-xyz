# FrameTheGlobe Geopolitical Intelligence Hub

**Version:** 3.1.1 — *The Global Pivot Update*  
**Deployment:** [frametheglobe.xyz](https://frametheglobe.xyz)  
**Stack:** Next.js 16 (App Router), React 19, TypeScript, Vanilla CSS Design System.

---

## 🌐 Overview
FrameTheGlobe is a high-performance, real-time news aggregation and intelligence platform specifically engineered to monitor the **Iran War Theater**, **South Asia**, and the **Global Pivot** (the emerging superpower dynamics between the West, China, and Russia).

The application distill's thousands of signals into a single, high-density dashboard designed for analysts, researchers, and geopolitical observers.

---

## 🚀 Key Features

### 1. The Energy Dashboard (Commodity Pulse)
A real-time financial ticker tracking the lifeblood of the war theater: **WTI Crude**, **Brent Crude**, and **Natural Gas**.
*   **Precision Data**: Fetched via a custom server-side proxy to **Stooq.com**.
*   **Heuristic Filtering**: Specifically separates high-intent energy news (OPEC+, supply disruptions, maritime incidents) from general reporting.
*   **Resilience**: Built-in JSON sanitization logic to handle malformed data streams from external providers.

### 2. Rapid 47 Response (Trump Administration Tracker)
A dedicated intelligence lane tracking the **47th US Administration's** impact on Middle Eastern and Global policy.
*   **Pattern Matching**: Advanced keyword clustering for Trump, Vance, and MAGA policy shift indicators.
*   **Low-Latency**: Prioritizes White House alerts to ensure policy pivots are visual within minutes.

### 3. Top Storylines (The Clustering Engine)
Automatically groups related reports from diverse global sources into unified "Storylines."
*   **Algorithm**: Uses **Jaccard Similarity** (0.40 threshold) to compare article titles and summaries.
*   **Temporal Windows**: Groups stories published within a 12-hour window to maintain relevance.
*   **Scoring**: Clusters are ranked by a proprietary "Impact Score" factoring in source diversity and recency.

### 4. Macro & Markets (Superpower Quadrant)
Tracks the "Global Pivot" by isolating news from **Chinese** (Xinhua, SCMP, Global Times) and **Russian** (TASS, RT) poles alongside Western market data.
*   **ZeroHedge Integration**: Prioritizes ZeroHedge's contrarian macro-analysis at the top of the feed for strategic depth.

### 5. Live Conflict Mapping
A custom **Leaflet.js** implementation providing a spatial dimension to current events.
*   **Interactivity**: Real-time markers synced with active news clusters.
*   **Region Badging**: Color-coded markers for Western, Iranian, Gulf, South Asian, and Superpower news sources.

### 6. Live Video Integration
A persistable live video feed capable of streaming global news networks (YouTube/External).
*   **CSP Hardened**: Securely configured to allow stable channel-ID based embeds while maintaining strict Content Security Policy.

---

## 🛠️ Technical Implementation & Solved Challenges

### The "Macro-to-Micro" Debugging Philosophy
Throughout the development of v3.x, we solved several critical infrastructure hurdles:

*   **API Resilience & Rate Limiting**: When Yahoo Finance began aggressive rate limiting (HTTP 429), we transitioned the system to **Stooq**. We implemented a **Server-Side API Route (`/api/market`)** to act as a CORS-compliant buffer between client components and raw data providers.
*   **Data Sanitization**: Discovered a rare bug in Stooq's JSON output (malformed volume fields like `"volume":}`). We implemented a **Regex-based sanitization layer** that repairs the raw text feed before it hits the JSON parser, preventing local dashboard crashes.
*   **Live Updates (SSE)**: Built a custom **Server-Sent Events (SSE)** stream (`/api/stream`) to push updates to the dashboard without the overhead of WebSockets or the lag of traditional polling.
*   **Branding & Aesthetics**: Transitioned the entire UI to match the master brand of `frametheglobenews.com`. This included a total CSS overhaul to use a "Glassmorphism" design system, premium typography (Inter/Outfit), and a refined high-contrast light/dark mode.

---

## 🏗️ Technical Stack

*   **Runtime**: Node.js 20.9+ (Essential for SSE and persistent in-memory caching).
*   **Framework**: Next.js 16 (Turbopack enabled) using the App Router.
*   **State Management**: React `useState` / `useMemo` hooks with shared server-client state via SSE.
*   **Data Parsing**: `rss-parser` for high-throughput XML/Atom ingestion.
*   **CSS**: Pure Vanilla CSS logic for maximum performance and zero dependency overhead.

---

## 📦 Deployment & Nginx Configuration

The app requires a **persistent Node.js process** (not serverless) to maintain the SSE connections and the in-memory feed cache.

### Nginx Recommendation (SSE Support)
To ensure the live status dot stays green, Nginx buffering must be disabled for the stream endpoint:

```nginx
location /api/stream {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;
}
```

---

## 📝 Change Log (Recent Milestones)

*   **v3.1.1**: Fixed sectional feed accuracy and ZeroHedge prioritization. Sanitized malformed JSON from data providers.
*   **v3.1.0**: Expanded scope to **"Global Pivot"**, integrating Russian and Chinese news poles.
*   **v3.0.7**: Final stabilization of the Energy Dashboard and pulse fix.
*   **v3.0.0**: Master branding alignment with FrameTheGlobeNews identity.

---
*Maintained by the FrameTheGlobe Engineering Team.*

# FrameTheGlobe Geopolitical Intelligence Hub

**Version:** 5.2.5 — *Universal Deployment Readiness*  
**Mission:** Real-time news aggregation and intelligence monitoring for the Iran War Theater, South Asia, and the Global Pivot.  
**Production URL:** [frametheglobe.xyz](https://frametheglobe.xyz)

---

## 🏛️ Architecture & Philosophy

FrameTheGlobe is engineered as a **High-Performance Intelligence Hub**. It distills thousands of global news signals into a single, high-density dashboard. 

### Core Components:
1.  **Ingestion & Heuristics**: Custom algorithms that parse RSS/XML feeds, apply Jaccard Similarity for story clustering, and calculate "Impact Scores."
2.  **Thematic Lenses**: 16 specialized filters (e.g., Nuclear/Diplomacy, Oil Markets, Naval/Hormuz) that use regex-driven keyword engines to categorize intelligence in real-time.
3.  **Real-Time Delivery**: Uses **Server-Sent Events (SSE)** via `/api/stream` to push updates without the overhead of WebSockets, with a 5-minute polling fallback.
4.  **Resilience Layer**: A JSON sanitization engine built in `lib/fetcher.ts` that automatically repairs malformed data streams from third-party news providers.

---

## 🛠️ Stack & Infrastructure

*   **Runtime**: Node.js 20+ / 22+ (Essential for SSE and persistent in-memory grouping).
*   **Framework**: Next.js 16 (App Router + Turbopack enabled).
*   **Intelligence Parsing**: `rss-parser` + `axios` (proxied for CORS compliance).
*   **UI/UX**: Custom Vanilla CSS Design System (Zero-utility bloat, high-performance rendering).
*   **Spatial Intelligence**: Leaflet.js with customized geopolitical overlays.

---

## 🚀 The Deployment Trilogy

This project is uniquely configured for a **Triple-Platform strategy**, ensuring the hub remains operational across different hosting providers.

### 1. Vercel (The Native Hub)
The most straightforward deployment. Vercel handles the App Router and Edge Middleware natively.
*   **Setup**: Simply connect your GitHub repository to Vercel. 
*   **Config**: Vercel uses the default `next build` command. Since we have `output: 'standalone'` enabled, it will correctly bundle dependencies.

### 2. Hostinger (The "Hardened" Shared/VPS Path)
Hostinger deployments require a "Standalone" strategy to prevent the server from crashing or mismanaging stale build files.

*   **Hardening Protocol**: 
    1.  **Standalone Output**: Enabled in `next.config.ts`. Bundles all `node_modules` into a minimal `.next/standalone` folder.
    2.  **Worker Limitation**: Prevents Next.js from spawning too many processes and getting killed by Hostinger's CPU limits.
    3.  **Deployment Script**: `hostinger-post-pull.sh` is the source of truth. It wipes the old `.next` folder, installs production deps, builds, and signals a restart.
*   **The Restart Mechanism**: We use `touch tmp/restart.txt`. This tells Hostinger's Phusion Passenger bridge to gracefully reload the application without a full server reboot.

### 3. Netlify (The Edge Path)
Configured via `netlify.toml` with the `@netlify/plugin-nextjs`.
*   **Setup**: Connect GitHub and Netlify will auto-detect the configuration.
*   **Environment**: Uses Node 22 for modern performance.

---

## 🔧 Maintenance & Ops

### Deploying Updates (Master Branch)
We use a versioning system mapped to Git tags (e.g., `v5.2.1`). To ship a new version:
1.  Bump `version` in `package.json`.
2.  Commit changes.
3.  Tag the commit: `git tag v5.2.x`.
4.  Push: `git push origin master --tags`.

### Scaling on Hostinger
If the news feed grows significantly, you may hit memory limits (1GB currently set). To increase this, modify `hostinger-post-pull.sh`:
```bash
NODE_OPTIONS='--max-old-space-size=2048' npm run build
```

### Environment Variables
**CRITICAL**: Since `.env` files are ignored by Git, you must manually add these keys in all three platforms:
*   `VERCEL_URL` / `SITE_URL`
*   Any News API keys or DB credentials.

---

## 🔍 Directory Structure
*   `app/`: App Router source (The UI and API).
*   `lib/`: Core intelligence logic, fetchers, and clustering tools.
*   `hostinger-post-pull.sh`: The specialized deployment engine for Hostinger.
*   `netlify.toml`: Deployment orchestration for Netlify.
*   `next.config.ts`: The central configuration hub for all platforms.

---
*Maintained by the FrameTheGlobe Engineering Team.*

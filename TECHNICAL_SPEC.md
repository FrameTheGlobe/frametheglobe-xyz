# FrameTheGlobe — Technical Architecture & System Manifesto

**Version:** 8.0.3 — *Accountability tracker + split-stack HUD*
**Mission:** Low-latency, high-density tactical oversight of global geopolitical events with a specialised focus on the Iran War Theater.
**Infrastructure:** Vercel (frontend) + Railway (backend) — split-stack architecture as of March 2026.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Frontend — Vercel (Next.js)](#2-frontend--vercel-nextjs)
3. [Backend — Railway (Express)](#3-backend--railway-express)
4. [Frontend/Backend Separation — Full Guide](#4-frontendbackend-separation--full-guide)
5. [Environment Variables Reference](#5-environment-variables-reference)
6. [Local Development Setup](#6-local-development-setup)
7. [Data Flow & Request Lifecycle](#7-data-flow--request-lifecycle)
8. [UI/UX Design System](#8-uiux-design-system)
9. [AI Features](#9-ai-features)
10. [Security Hardening](#10-security-hardening)
11. [Performance Optimisations](#11-performance-optimisations)
12. [Known Gotchas & Lessons Learned](#12-known-gotchas--lessons-learned)

---

## 1. High-Level Architecture

```
                        ┌─────────────────────────────────┐
                        │   Browser (frametheglobe.xyz)   │
                        └────────────┬────────────────────┘
                                     │
                    ┌────────────────┼────────────────────┐
                    │                │                     │
                    ▼                ▼                     ▼
         Static HTML/CSS/JS    /api/* routes          SSE stream
         (served from CDN)     (thin proxy)           (direct to Railway)
                    │                │                     │
                    └────────────────┘                     │
                                     │                     │
                    ┌────────────────▼─────────────────────▼──┐
                    │         Vercel (frametheglobe.xyz)        │
                    │  Next.js 15 App Router — frontend only   │
                    │  lib/backend-proxy.ts — 3-line proxies   │
                    └────────────────────┬─────────────────────┘
                                         │ HTTP forwarding
                                         ▼
                    ┌────────────────────────────────────────────┐
                    │      Railway (brief-pk-api.up.railway.app) │
                    │  Express 4 — persistent Node.js process    │
                    │  In-memory caches that actually persist     │
                    │  SSE broadcaster — one process, N clients  │
                    │  All Groq AI calls live here               │
                    └────────────────────────────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                     │
                    ▼                    ▼                     ▼
            Yahoo Finance / Stooq    Groq API           100+ RSS feeds
            (market data)            (AI analysis)      (news pipeline)
```

### Why This Split Exists

Vercel is **serverless** — every API request spins up an isolated lambda that lives only for the duration of that request. This is perfect for the frontend but catastrophically expensive for:

- **SSE (Server-Sent Events)**: One open SSE connection = one lambda instance alive for the entire session. At 20 concurrent users that's ~10,000 GB-seconds/hour.
- **In-memory caches**: `let cache = null` patterns don't work — every cold lambda start has empty memory, forcing a fresh upstream fetch every time.
- **Groq AI calls**: 5–15 second calls holding a 512MB lambda alive = massive duration charges.

Railway is a **persistent process** — one Node.js server runs 24/7. In-memory caches accumulate across requests. SSE is native and free. Fixed cost: ~$5/month regardless of traffic.

---

## 2. Frontend — Vercel (Next.js)

### What Lives Here

```
app/
  page.tsx                  ← Main client component (the HUD)
  layout.tsx                ← Root layout, fonts, metadata
  globals.css               ← All styles, themes, animations
  contexts/
    AIAnalysisContext.tsx   ← React context for AI ticker drawer
  components/               ← All React UI components
  api/
    market/route.ts         ← 2-line proxy → Railway
    news/route.ts           ← 2-line proxy → Railway
    stream/route.ts         ← SSE redirect → Railway
    ai-intel/route.ts       ← 2-line proxy → Railway
    flash-brief/route.ts    ← 2-line proxy → Railway
    analyst-briefing/route.ts ← 2-line proxy → Railway
    analyze-ticker/route.ts ← 2-line proxy → Railway
    article-brief/route.ts  ← 2-line proxy → Railway
    agri-market/route.ts    ← 2-line proxy → Railway
    flights/route.ts        ← 2-line proxy → Railway
    oil-history/route.ts    ← 2-line proxy → Railway
    precious-metals/route.ts ← 2-line proxy → Railway
    rss/route.ts            ← 2-line proxy → Railway
    polymarket/route.ts     ← STAYS on Vercel (edge runtime, near-free)
lib/
  backend-proxy.ts          ← Proxy helper (proxyGet, proxyPost, proxySSE)
  sources.ts                ← News source definitions (kept in sync with backend)
```

### The Proxy Pattern (`lib/backend-proxy.ts`)

Every heavy API route on Vercel is now a 2-line file:

```ts
// app/api/market/route.ts
import { proxyGet } from '@/lib/backend-proxy';
export const runtime = 'nodejs';
export const GET = proxyGet('/api/market');
```

The proxy helper (`lib/backend-proxy.ts`) provides three functions:

```ts
proxyGet(path)   // Forwards GET + query string to Railway, returns response
proxyPost(path)  // Forwards POST + body to Railway, returns response
proxySSE()       // Issues a 307 redirect → browser connects directly to Railway SSE
```

**Key detail — SSE uses a redirect, not a proxy.** If the proxy forwarded SSE, Vercel would still hold the connection open (same cost as before). Instead, `proxySSE()` responds with `307 Temporary Redirect` to the Railway URL, so the browser connects directly to Railway. Vercel's role ends in ~1ms.

### TypeScript Config for Frontend

The root `tsconfig.json` **excludes** the `backend/` folder to prevent Next.js from trying to type-check Express/Node-specific code:

```json
{
  "exclude": ["node_modules", "backend"]
}
```

Without this exclusion, `tsc` would fail on `backend/src/index.ts` because Express types are incompatible with Next.js's DOM-focused type environment.

---

## 3. Backend — Railway (Express)

### What Lives Here

```
backend/
  src/
    index.ts              ← Express entry point, CORS, health check, route mounting
    routes/
      market.ts           ← Yahoo Finance / Stooq market data
      agri-market.ts      ← Agricultural commodities
      flights.ts          ← ADS-B aircraft positions (adsb.lol)
      oil-history.ts      ← Historical oil price data
      precious-metals.ts  ← Gold, silver, platinum prices
      news.ts             ← RSS aggregation + Jaccard clustering
      stream.ts           ← SSE broadcaster (persistent Node.js = works correctly)
      ai-intel.ts         ← Groq AI geopolitical intelligence
      flash-brief.ts      ← Groq AI situation summary
      analyst-briefing.ts ← Groq AI structured 4-section briefing
      analyze-ticker.ts   ← Groq AI per-ticker price analysis
      article-brief.ts    ← Groq AI per-article summary
      rss.ts              ← Raw RSS feed endpoint
    lib/
      news-store.ts       ← Shared in-memory news store (works on persistent Node)
      fetcher.ts          ← RSS fetch + Jaccard clustering engine
      sources.ts          ← News source definitions (kept in sync with frontend lib/)
      flights.ts          ← Flight fetch helper
      rate-limit.ts       ← Sliding-window rate limiter
  package.json
  package-lock.json       ← MUST be committed and in sync with package.json
  tsconfig.json
  railway.json            ← Railway deployment config
```

### Backend `package.json`

```json
{
  "name": "frametheglobe-backend",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.3",
    "node-fetch": "^3.3.2",
    "rss-parser": "^3.13.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  },
  "engines": {
    "node": ">=20"
  }
}
```

### Backend TypeScript Config (`backend/tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Key difference from frontend tsconfig:** `module: "NodeNext"` and `moduleResolution: "NodeNext"` — required for Node.js ESM with `.js` extension imports. The frontend uses `module: "esnext"` with `moduleResolution: "bundler"` (Next.js handles bundling, not Node).

### CORS Configuration

The backend whitelists only FrameTheGlobe's Vercel origin:

```ts
const ALLOWED_ORIGINS = [
  'https://frametheglobe.xyz',
  'https://www.frametheglobe.xyz',
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
```

This means direct browser requests to `https://brief-pk-api.up.railway.app` from any other domain are blocked. Only the Vercel proxy (which makes server-to-server requests without an `Origin` header) can reach Railway freely.

### Railway Deployment Config (`backend/railway.json`)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

**Critical:** `buildCommand: "npm install && npm run build"` overrides Railway's default. Without `buildCommand`, Railway's Railpack auto-detector runs `npm ci` (strict lock file check) which can fail if the lock file is out of sync. Using `npm install` is more forgiving.

---

## 4. Frontend/Backend Separation — Full Guide

This section is written to be **fully replicable** for any Next.js app that needs to move heavy API work off Vercel onto a persistent server.

### Prerequisites

- A Next.js app with API routes in `app/api/*/route.ts`
- A Railway account (https://railway.app) — Hobby plan is $5/month
- The app repo on GitHub (Railway deploys from GitHub)

---

### Step 1: Create the `backend/` Folder Structure

At the root of your repo, create:

```bash
mkdir -p backend/src/routes backend/src/lib
```

Create `backend/package.json` with only the dependencies the Express server needs (no Next.js, no React, no Tailwind). Common dependencies:

```bash
cd backend
npm init -y
npm install express cors
npm install --save-dev typescript tsx @types/express @types/cors @types/node
```

**Important:** After installing, commit `backend/package-lock.json`. Railway runs `npm ci` or `npm install` from the lock file — if it's missing or out of sync, the build fails.

---

### Step 2: Create `backend/tsconfig.json`

Use `"module": "NodeNext"` (not `"esnext"` like the frontend). This enables proper Node.js ESM resolution:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Add `"build": "tsc"` and `"start": "node dist/index.js"` to `backend/package.json` scripts.

---

### Step 3: Create the Express Entry Point

```ts
// backend/src/index.ts
import express from 'express';
import cors from 'cors';
import marketRouter from './routes/market.js'; // .js extension required with NodeNext

const app = express();
const PORT = process.env.PORT ?? 4000;

// CORS — whitelist only your frontend origins
app.use(cors({
  origin: ['https://yourapp.vercel.app', 'https://yourdomain.com', 'http://localhost:3000'],
}));

app.use(express.json({ limit: '1mb' }));

// Health check — Railway uses this to verify the service is alive
app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.use('/api/market', marketRouter);
// ... mount all other routes

app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
```

---

### Step 4: Migrate Route Handlers

Each `app/api/route.ts` (Next.js) becomes a `backend/src/routes/*.ts` (Express).

**Before (Next.js):**
```ts
// app/api/market/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const data = await fetch('https://stooq.com/q/l/?s=cl.f&f=sd2t2ohlcv&h&e=csv');
  const json = await data.json();
  return NextResponse.json(json);
}
```

**After (Express):**
```ts
// backend/src/routes/market.ts
import { Router } from 'express';

const router = Router();

router.get('/', async (_req, res) => {
  const data = await fetch('https://stooq.com/q/l/?s=cl.f&f=sd2t2ohlcv&h&e=csv');
  const json = await data.json();
  res.json(json);
});

export default router;
```

The swap is mechanical: `NextRequest` → `Request`, `NextResponse.json()` → `res.json()`, `export async function GET` → `router.get('/', ...)`.

---

### Step 5: Create the Proxy Helper on the Frontend

Create `lib/backend-proxy.ts` at the Next.js root:

```ts
import { NextRequest, NextResponse } from 'next/server';

function backendUrl(path: string): string {
  const base = process.env.BACKEND_URL ?? 'http://localhost:4000';
  return `${base.replace(/\/$/, '')}${path}`;
}

function forwardHeaders(req: NextRequest): HeadersInit {
  return {
    'Content-Type': req.headers.get('content-type') ?? 'application/json',
    'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '127.0.0.1',
    'user-agent': req.headers.get('user-agent') ?? '',
  };
}

/** GET proxy — forwards query string, returns upstream response */
export function proxyGet(backendPath: string) {
  return async function GET(req: NextRequest) {
    const url = backendUrl(backendPath) + req.nextUrl.search;
    try {
      const upstream = await fetch(url, { headers: forwardHeaders(req), cache: 'no-store' });
      const body = await upstream.text();
      return new NextResponse(body, {
        status: upstream.status,
        headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
      });
    } catch (err) {
      console.error(`[proxy] GET ${backendPath} failed:`, err);
      return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
    }
  };
}

/** POST proxy — forwards body, returns upstream response */
export function proxyPost(backendPath: string) {
  return async function POST(req: NextRequest) {
    try {
      const body = await req.text();
      const upstream = await fetch(backendUrl(backendPath), {
        method: 'POST', headers: forwardHeaders(req), body, cache: 'no-store',
      });
      const resBody = await upstream.text();
      return new NextResponse(resBody, {
        status: upstream.status,
        headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
      });
    } catch (err) {
      console.error(`[proxy] POST ${backendPath} failed:`, err);
      return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
    }
  };
}

/**
 * SSE proxy — issues a redirect instead of proxying.
 * IMPORTANT: If you proxy SSE, Vercel holds the connection open (same cost as before).
 * A redirect makes the browser connect directly to Railway — Vercel's role ends in ~1ms.
 */
export function proxySSE() {
  return async function GET(_req: NextRequest) {
    const base = process.env.BACKEND_URL ?? 'http://localhost:4000';
    return NextResponse.redirect(`${base}/api/stream`, 307);
  };
}
```

---

### Step 6: Replace Heavy Next.js API Routes with Proxy Stubs

Each `app/api/*/route.ts` becomes a 2-3 line file:

```ts
// app/api/market/route.ts
import { proxyGet } from '@/lib/backend-proxy';
export const runtime = 'nodejs';
export const GET = proxyGet('/api/market');
```

```ts
// app/api/ai-intel/route.ts
import { proxyPost } from '@/lib/backend-proxy';
export const runtime = 'nodejs';
export const POST = proxyPost('/api/ai-intel');
```

```ts
// app/api/stream/route.ts  ← SSE uses redirect, not proxy
import { proxySSE } from '@/lib/backend-proxy';
export const runtime = 'nodejs';
export const GET = proxySSE();
```

**Client components don't change.** They still call `/api/market`, `/api/news`, etc. The proxy is invisible.

**Preserving TypeScript types:** If any component imports types from the old route file (e.g., `import type { AIIntelPayload } from '@/app/api/ai-intel/route'`), re-export them from the stub:

```ts
// app/api/ai-intel/route.ts
import { proxyPost } from '@/lib/backend-proxy';
export const POST = proxyPost('/api/ai-intel');
export type { AIIntelPayload, ThreatLevel } from './types'; // re-export types
```

---

### Step 7: Exclude `backend/` from Next.js TypeScript Checking

In the root `tsconfig.json`, add `"backend"` to the `exclude` array:

```json
{
  "exclude": ["node_modules", "backend"]
}
```

Without this, `npx tsc --noEmit` (and Vercel's build) will try to type-check Express code with Next.js's DOM type environment, causing cascading errors.

---

### Step 8: Add `railway.json` to `backend/`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

---

### Step 9: Set Up Railway Service

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select your repository
3. **Critical:** In Service Settings → **Root Directory**, set it to `/backend`
   - Without this, Railway tries to build the entire monorepo from the root, using the root `package.json` for `npm ci`, causing lock file mismatches
4. Set environment variables (Variables tab):
   - `GROQ_API_KEY` = your Groq key
   - `NODE_ENV` = `production`
   - `PORT` is set automatically by Railway — do not override it
5. In Service Settings → Networking → **Generate Domain** to get your public URL (e.g., `https://your-app.up.railway.app`)

---

### Step 10: Set Up Vercel Environment Variables

In Vercel → Project → Settings → Environment Variables, add:

| Variable | Value | Scope |
|---|---|---|
| `BACKEND_URL` | `https://your-app.up.railway.app` | Production, Preview |
| `NEXT_PUBLIC_BACKEND_URL` | `https://your-app.up.railway.app` | Production, Preview |

- `BACKEND_URL` is server-side only — used by Next.js API proxy routes (no `NEXT_PUBLIC_` prefix)
- `NEXT_PUBLIC_BACKEND_URL` is exposed to the browser — required for client-side code that needs the Railway URL directly (e.g., the SSE redirect target for `EventSource`)

After adding variables, trigger a redeploy in Vercel.

---

### Step 11: Update Client-Side SSE Connection

In `app/page.tsx` (or wherever `EventSource` is created), update the URL to use the Railway backend directly after the redirect:

```ts
const sseUrl = process.env.NEXT_PUBLIC_BACKEND_URL
  ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/stream`
  : '/api/stream'; // falls back to Vercel proxy in dev (which redirects to localhost:4000)

const es = new EventSource(sseUrl);
```

---

## 5. Environment Variables Reference

### Vercel (frontend)

| Variable | Required | Description |
|---|---|---|
| `BACKEND_URL` | Yes | Railway backend base URL (server-side proxy). No trailing slash. |
| `NEXT_PUBLIC_BACKEND_URL` | Yes | Same Railway URL, exposed to browser for SSE EventSource |
| `NODE_ENV` | Auto | Set to `production` by Vercel automatically |

### Railway (backend)

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Groq API key for all AI features |
| `NODE_ENV` | Recommended | Set to `production` |
| `PORT` | Auto | Set automatically by Railway — do not override |

### `.env.local` (local development only)

```bash
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
GROQ_API_KEY=gsk_...  # only needed if running AI features locally
```

---

## 6. Local Development Setup

Run both services simultaneously in two terminals:

```bash
# Terminal 1 — Next.js frontend (port 3000)
cd frametheglobe
npm run dev

# Terminal 2 — Express backend (port 4000)
cd frametheglobe/backend
npm run dev          # uses tsx watch for hot reload
```

The frontend's `BACKEND_URL=http://localhost:4000` (in `.env.local`) makes all proxy routes forward to the local backend. The experience is identical to production — all `/api/*` calls hit the local Express server.

**Note:** If `.env.local` doesn't set `BACKEND_URL`, the proxy helper defaults to `http://localhost:4000`, so it works even without the `.env.local` file.

---

## 7. Data Flow & Request Lifecycle

### Standard Data Request (e.g., oil price)

```
1. IranOilBoard component mounts
2. Component calls fetch('/api/market')
3. Vercel receives GET /api/market
4. Vercel proxy (2-line route) calls Railway: GET https://railway-url/api/market
5. Railway checks in-memory cache (populated every 60s by background refresh)
6. Cache hit → returns JSON in ~1ms
7. Vercel proxy returns JSON to browser
8. Vercel duration: ~10ms × 256MB = ~2.5MB-seconds (essentially free)
```

### SSE (Live News Stream)

```
1. Browser creates EventSource('/api/stream')
2. Vercel receives GET /api/stream
3. Vercel proxy issues 307 Redirect → https://railway-url/api/stream
4. Vercel connection ends immediately (~1ms)
5. Browser follows redirect, connects directly to Railway SSE endpoint
6. Railway maintains persistent SSE connection to browser
7. Railway pushes news updates to all connected browsers simultaneously
8. Vercel cost: ~1ms × 256MB = ~0.25MB-seconds (negligible)
```

### AI Analysis Request

```
1. User clicks a price ticker
2. TickerAnalysisDrawer calls POST /api/analyze-ticker with ticker data
3. Vercel proxy forwards body to Railway POST /api/analyze-ticker
4. Railway checks in-process cache (5-min TTL keyed by symbol+price)
5. Cache miss → Railway calls Groq API (up to 15s)
6. Railway caches result, returns analysis JSON
7. Drawer renders AI analysis
8. Same ticker clicked again within 5 min → Railway returns from cache in ~1ms
```

---

## 8. UI/UX Design System

### Design Language

- **Tactical HUD philosophy**: Information density over whitespace — every pixel serves a purpose
- **Glassmorphism**: `backdrop-filter: blur(12px)` on header and HUD overlay elements
- **Widget headers**: `.widget-hd` class with CSS variables `--widget-hd-bg` and `--widget-hd-border` for consistent standout styling across all boards
- **Colour palette**: Dark theme default with `--bg-primary: #0a0f1a`, accent purple `#9b59b6` for AI features, `#3498db` for primary actions

### Responsive Strategy

- Mobile-first media queries in `globals.css`
- AI modals: 2-column grid collapses to 1 column below 560px
- AI Briefing button label hides below 820px (icon only)
- Touch targets: `minHeight: 44px`, `touch-action: manipulation` on all interactive elements
- Sidebar: overlay mode on mobile with `body.overflow: hidden` while open

### Key CSS Variables

```css
--widget-hd-bg: rgba(255,255,255,0.04);    /* widget header background */
--widget-hd-border: rgba(255,255,255,0.1); /* widget header bottom border */
--text-primary: #e2e8f0;                   /* main readable text */
--text-secondary: #94a3b8;                 /* secondary labels */
--text-muted: #64748b;                     /* muted/timestamp text */
```

---

## 9. AI Features

### Ticker Click → Price Intelligence

- **Trigger**: Clicking any price cell in IranOilBoard, PreciousMetalsBoard, or HormuzCommoditiesBoard
- **Context**: `AIAnalysisContext` (React Context) provides `openDrawer(tickerData)` to nested components without prop drilling
- **Component**: `TickerAnalysisDrawer` — right-side slide-in panel
- **API**: `POST /api/analyze-ticker` → Railway → Groq `llama-3.1-8b-instant`
- **Cache**: 5-minute in-process cache keyed by `symbol+price` on Railway
- **Fallback**: Algorithmic analysis if Groq is unavailable

### Analyst Briefing Button (⚡ AI Briefing)

- **Trigger**: "⚡ AI Briefing" button in `CompactHeader`
- **Component**: `AnalystBriefingModal` — full-screen overlay
- **Flow**: Fetches oil/metals/polymarket data in parallel → builds summaries → `POST /api/analyst-briefing` → Groq generates 4-section structured assessment
- **Sections**: Market Summary, Conflict Alignment, Risk Assessment, Watchpoints
- **API**: `POST /api/analyst-briefing` → Railway → Groq
- **Cache**: 10-minute in-process cache on Railway
- **Rate limit**: 10 requests/60s per IP

---

## 10. Security Hardening

### HTTP Security Headers (via `next.config.ts`)

```
Content-Security-Policy     — allowlist for scripts, styles, frames, connects
X-Frame-Options             — DENY
X-Content-Type-Options      — nosniff
Referrer-Policy             — strict-origin-when-cross-origin
Permissions-Policy          — camera=(), microphone=(), geolocation=()
Strict-Transport-Security   — max-age=63072000; includeSubDomains; preload
```

### API Rate Limiting (`lib/rate-limit.ts`)

Sliding-window in-process rate limiter applied to all AI routes:
- `/api/analyze-ticker`: 30 requests / 60 seconds per IP
- `/api/analyst-briefing`: 10 requests / 60 seconds per IP
- `/api/flash-brief`: 20 requests / 60 seconds per IP

### Other Hardening

- `AbortController` with timeouts on all external fetches (8–15s depending on route)
- Input validation on all POST endpoints (body size limits, required field checks)
- CORS whitelist on Railway rejects all non-whitelisted origins
- No API keys stored on Vercel — all secrets live exclusively on Railway

---

## 11. Performance Optimisations

### Visibility-Aware Polling (`lib/use-visibility-polling.ts`)

Custom React hook that pauses `setInterval` polling when the browser tab is hidden and resumes on focus. Applied to all components that poll: `IranOilBoard`, `MarketTicker`, `HormuzCommoditiesBoard`, `AIIntelPanel`, `OilTicker`, `PreciousMetalsBoard`, `IranWarCostBoard`, `MapView`, `FlashBrief`.

### YouTube Facade (`LiveVideoWidget.tsx`)

YouTube iframes are not loaded until the user clicks the video thumbnail. Prevents YouTube's ~500kb of JS from loading for visitors who never interact with the video section.

### Edge Runtime for Polymarket

`app/api/polymarket/route.ts` runs on Vercel's Edge runtime (`export const runtime = 'edge'`). Edge functions are cheaper, globally distributed, and have no cold-start overhead. This route stays on Vercel (not proxied to Railway) because it's a simple external API call with no shared state.

### In-Memory Caching on Railway

Because Railway is a persistent process, module-level caches accumulate across requests:

```ts
let _cache: MarketData | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

// In handler:
if (_cache && Date.now() - _cacheTime < CACHE_TTL) return res.json(_cache);
_cache = await fetchFromUpstream();
_cacheTime = Date.now();
```

This pattern is useless on Vercel (every cold lambda has empty memory) but works perfectly on Railway.

---

## 12. Known Gotchas & Lessons Learned

---

## Addendum — Recent Frontend Delivery Updates (Apr 2026)

These updates were applied after the initial split-stack migration.

### A) Theater Escalation Pulse Expansion

`SidebarTheaterPulse` in `app/page.tsx` now includes:

- Nuclear/IAEA-related wire count (6h window)
- Brent-WTI spread with daily context (`/api/market`)
- Polymarket maximum YES probability (`/api/polymarket`)

The pulse elevation logic was extended to include nuclear threshold conditions.

### B) Visibility-Aware Polling

Selective refreshes (market/probability strip metrics) use visibility-aware polling so background tabs do not continuously re-fetch.

### C) Readability Upgrades (Both Nav Columns)

- Left nav (`SidebarPanel`) typography/spacing refinement
- Right nav (`intel-column` / Strategic Brief) heading + secondary text legibility tuning
- Shared `ftg-nav-readable` usage for clearer rendering

### D) Mobile Header Hardening

To prevent top-row overlap on small phones:

- compact header controls progressively hide at narrow breakpoints
- 320-375px behavior degrades to essential controls for clarity

### E) Sticky Header + Sticky Breaking Ticker

- Main command header remains sticky at top
- Breaking ticker is also sticky and positioned beneath the header
- Ticker top offset is computed from measured header height (`ResizeObserver`) for breakpoint-safe alignment

For implementation history, see `docs/RECENT_UPDATES.md`.

### Railway Railpack vs NIXPACKS

Railway upgraded their default builder from Nixpacks to **Railpack** (v0.22.2+). If your `railway.json` specifies `"builder": "NIXPACKS"` but Railway uses Railpack, the `buildCommand` in `railway.json` is ignored and Railpack runs `npm ci` instead. **Fix:** In the Railway Dashboard → Service Settings → Build, explicitly set `Build Command` to `npm install && npm run build`. Alternatively, Railpack respects `buildCommand` in `railway.json` when the builder is correctly detected.

### `npm ci` Fails with "Missing from lock file"

`npm ci` requires `package.json` and `package-lock.json` to be exactly in sync. If you add a package locally with `npm install` but forget to commit `package-lock.json`, Railway's build fails. **Always commit `package-lock.json` after any `npm install` in `backend/`.**

### Root Directory Must Be Set to `/backend` in Railway

If Railway's Root Directory is not set to `/backend`, Railpack detects the monorepo root, picks up the Next.js `package.json`, and tries to run `npm run start` (which would run Next.js, not Express). **Always set Root Directory to `/backend`** in Railway service settings.

### SSE Cannot Be Proxied — Use Redirect Instead

If `proxyGet` is used for the SSE endpoint, Vercel holds the streaming connection open, charging for the full duration — identical to the original problem. Use `proxySSE()` which issues a `307 Temporary Redirect` instead. The browser follows the redirect directly to Railway; Vercel's involvement ends in ~1ms.

### `NEXT_PUBLIC_BACKEND_URL` vs `BACKEND_URL`

- `BACKEND_URL` — server-side only (used in Next.js API routes during SSR/proxy)
- `NEXT_PUBLIC_BACKEND_URL` — client-side (embedded into the JavaScript bundle at build time)

If `NEXT_PUBLIC_BACKEND_URL` is not set but the client-side code references `process.env.NEXT_PUBLIC_BACKEND_URL`, it evaluates to `undefined` at runtime (not an error, just silently undefined). The SSE `EventSource` will fall back to `/api/stream` on Vercel, which then redirects to Railway — so it works either way, but with one extra redirect.

### TypeScript Imports Require `.js` Extension with NodeNext

With `"module": "NodeNext"` in `backend/tsconfig.json`, TypeScript requires `.js` extensions on all relative imports (even though the source files are `.ts`):

```ts
// Correct:
import marketRouter from './routes/market.js';

// Wrong (will fail at runtime):
import marketRouter from './routes/market';
```

This is Node.js ESM behaviour — TypeScript resolves `.js` → `.ts` at compile time, Node.js resolves `.js` → `.js` at runtime.

---

*Last updated: March 2026 — FrameTheGlobe v7.0.0*
*Architecture: Vercel (Next.js frontend + thin proxies) + Railway (Express persistent backend)*

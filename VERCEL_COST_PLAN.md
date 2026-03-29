# FrameTheGlobe — Vercel Cost Reduction Plan
**Status:** Active — $15.88/$20 on-demand budget used, $35.40 upcoming invoice
**Goal:** Get monthly infra cost under $10 total
**Date:** March 2026

---

## Why the Bill Is High — Root Cause Diagnosis

Vercel meters three things on the Hobby/Pro plan: **function invocations**, **function duration (GB-seconds)**, and **bandwidth**. For FrameTheGlobe the first two are the problem.

### The #1 Culprit: `/api/stream` (SSE)

The `app/api/stream/route.ts` file is a **Server-Sent Events** endpoint. It was designed to hold a persistent connection open to each browser — heartbeating every 25 seconds, broadcasting news updates in real time.

The problem: **Vercel is serverless**. Every SSE connection occupies a live serverless function instance for its entire duration. The code itself even documents this:

```
 * Works on any persistent Node.js host (no serverless / edge needed).
```

What this means in practice:

- A visitor opens the site → their browser opens one SSE connection
- That SSE connection holds a 256MB Node.js lambda alive indefinitely
- After 10 minutes of reading: 10 min × 256MB = **2,560 MB-seconds** per visitor
- Vercel Hobby includes ~100,000 GB-seconds/month free, then meters overages
- With even 20 concurrent readers, you burn through the free tier in hours

The fallback polling (every 5 minutes via `/api/news`) already exists in `page.tsx` for browsers that don't support SSE. The SSE endpoint is adding cost without adding reliability.

### The #2 Culprit: Polling Frequency vs. Caching Gaps

Current per-visitor invocation map:

| API Route | Client Polls Every | Server Cache | Invocations/Visitor/Hour | Notes |
|---|---|---|---|---|
| `/api/stream` | SSE (persistent) | Never (force-dynamic) | 1 long-running | **Highest cost** |
| `/api/flights` | 60 seconds | 60s CDN | ~60 | Client polls same rate as cache TTL |
| `/api/market` | 3 minutes | 60s revalidate | ~20 | Extra invocations when cache cold |
| `/api/agri-market` | 3 minutes | 60s revalidate | ~20 | Same issue |
| `/api/news` | 5 minutes | **revalidate: 0** | ~12 | No CDN caching at all |
| `/api/ai-intel` | 15 minutes | **revalidate: 0** | ~4 | No CDN caching |
| `/api/oil-history` | On demand | **revalidate: 0** | Variable | No CDN caching |
| `/api/precious-metals` | On demand | 60s revalidate | ~10 | OK |
| `/api/polymarket` | On demand | 300s (edge runtime) | ~3 | Good — edge is cheaper |

**With 50 daily active users averaging 30-minute sessions:** ~6,000–10,000 invocations/day from polling alone, plus SSE duration charges.

### The #3 Factor: In-Memory Cache Is Useless on Vercel

Several routes (`/api/news`, `/api/ai-intel`, `/api/flights`, `/api/flash-brief`) use module-level in-memory caches (`let _cache = null`). These are completely ineffective on Vercel because:

- Each new request may spin up a **fresh cold lambda** with empty memory
- Multiple warm lambda instances exist simultaneously, each with their own cache
- The cache never accumulates — every cold start hits the upstream API again

This means the in-memory cache that was designed to prevent hammering Groq/Yahoo/RSS sources is not working as intended. Every visitor who hits a cold lambda triggers a full upstream fetch.

---

## Frontend / Backend Separation — Detailed Architecture

### The Core Idea

Right now FrameTheGlobe is a **monolith on Vercel**: the Next.js app handles both serving the React UI and running all 14 API routes as serverless functions. Every single data-fetching call (market prices, news, flights, AI analysis) spins up its own isolated lambda with no shared state between them.

The split is simple:

```
BEFORE (all on Vercel, expensive):
  Browser → Vercel → /api/market          → Yahoo Finance
                   → /api/news            → 100+ RSS feeds
                   → /api/stream (SSE)    → persistent lambda (huge cost)
                   → /api/ai-intel        → Groq API
                   → /api/flights         → adsb.lol
                   → ...11 more routes

AFTER (Vercel = UI only, Railway = all data):
  Browser → Vercel → serves React HTML/JS/CSS (static, free)
                   → /api/* (thin proxy)  → Railway Express server

          → Railway → /api/market          → Yahoo Finance  (persistent cache)
                    → /api/news            → RSS feeds       (persistent cache)
                    → /api/stream (SSE)    → push to browser (free on persistent Node)
                    → /api/ai-intel        → Groq API        (persistent cache)
                    → /api/flights         → adsb.lol        (persistent cache)
                    → ...all other routes
```

### What Moves Where

**Stays on Vercel (forever free):**
- The entire React frontend: pages, components, styles, fonts
- `next.config.mjs`, `tailwind.config.ts`, all static assets
- `/api/polymarket` — already on Edge runtime, costs essentially nothing

**Moves to Railway:**
- Every `app/api/*/route.ts` handler that fetches external data
- All `lib/` modules: `news-store.ts`, `fetcher.ts`, `sources.ts`, `flights.ts`, `rate-limit.ts`
- The SSE broadcaster (`/api/stream`) — works perfectly on persistent Node.js

**Thin proxy layer (stays on Vercel, replaces the heavy routes):**
- Each Vercel API route becomes a 3-line proxy that forwards to Railway
- Components don't change at all — they still call `/api/news`, `/api/market`, etc.
- Vercel proxy routes add ~5ms overhead but count as lightweight invocations

### Why This Slashes the Bill

On Vercel, a serverless function invocation that calls Yahoo Finance and waits 2 seconds costs:
- 1 invocation count + ~512MB × 2s = **1GB-second of duration**

The same request on Railway:
- Already has data in memory → responds in ~1ms → **0 GB-seconds on Vercel** (proxy is instant)
- Railway cost: fixed $5/month regardless of traffic

Additionally, in-memory caches (`news-store.ts`, all the `let _cache = null` patterns) actually work on Railway because it's a **persistent process**. One warm Railway process serves hundreds of visitors — each getting cached data instantly, with the upstream API called only once per cache TTL.

### Request Flow After Migration

```
Visitor opens frametheglobe.xyz

1. Browser fetches React app from Vercel CDN (static, free)

2. IranOilBoard mounts → calls /api/market
   Vercel proxy: GET /api/market → Railway GET /api/market
   Railway: has WTI/Brent in memory from 2 min ago → returns instantly
   Vercel proxy duration: ~10ms → near-zero cost

3. News feed loads → EventSource('/api/stream') opens SSE connection
   Vercel proxy: /api/stream → 301 redirect to Railway SSE URL
   Browser connects directly to Railway SSE endpoint
   Railway: persistent broadcaster pushes updates to all clients at once

4. AI Intel button → POST /api/ai-intel
   Vercel proxy: forwards body to Railway
   Railway: checks in-memory cache by headline fingerprint
   If cache hit (15 min TTL): returns in ~1ms
   If cache miss: calls Groq, caches result, returns

5. Visitor leaves after 30 minutes
   Vercel cost for session: ~50ms of proxy duration (all data from Railway cache)
   Previous cost: ~30min × 256MB SSE + dozens of cold lambda invocations
```

### Environment Variables Across Both Platforms

```
Vercel (only needs):
  BACKEND_URL = https://ftg-backend.up.railway.app
  NODE_ENV    = production

Railway (gets all the secrets):
  GROQ_API_KEY = gsk_...
  NODE_ENV     = production
  PORT         = 3000  (set automatically by Railway)
```

No API keys live on Vercel. All sensitive keys move to Railway.

### CORS & Security

Railway Express will whitelist only FrameTheGlobe's origin:

```ts
cors({ origin: ['https://frametheglobe.xyz', 'http://localhost:3000'] })
```

Browsers can only call the Railway API via the Vercel proxy (same-origin). Direct Railway URL is CORS-blocked for browsers — only Vercel's server-side proxy can reach it. This prevents third parties from hammering the Railway backend directly.

### Local Development

Both services run simultaneously in development:

```bash
# Terminal 1: Next.js frontend
cd frametheglobe && npm run dev       # localhost:3000

# Terminal 2: Railway backend
cd backend && npm run dev             # localhost:4000
```

`.env.local` gets `BACKEND_URL=http://localhost:4000`.

The development experience is identical — all `/api/*` calls proxy to localhost:4000 instead of Railway.

---

## The Three-Tier Fix Plan

---

### Tier 1: Immediate Code Fixes (Do Now — No Infrastructure Change)

These changes can be committed and deployed to Vercel today. They won't solve everything but will noticeably reduce the bill.

**Time required:** ~30 minutes to implement and deploy.

---

#### Fix 1: Disable SSE — Force All Clients to Poll

**File:** `app/page.tsx`
**Change:** Comment out the EventSource connection block. Every client falls through to the existing `pollFallback` which calls `/api/news` every 5 minutes.

The polling fallback already exists and works. SSE is a nice-to-have that's costing real money on serverless. We disable it here and re-enable it once we're on Railway (where it works properly and costs nothing extra).

**Before (simplified):**
```ts
es = new EventSource('/api/stream');  // ← holds lambda alive indefinitely
```

**After:**
```ts
// SSE disabled on Vercel — re-enable when backend moves to Railway
// es = new EventSource('/api/stream');
pollFallback = setInterval(fetchNews, 5 * 60 * 1000);
```

**Expected saving:** 50-70% of function duration charges eliminated.

---

#### Fix 2: Add CDN Cache to `/api/news`

**File:** `app/api/news/route.ts`
**Current:** `export const revalidate = 0` — every request hits a fresh lambda
**Change:** `export const revalidate = 120`

The route already has intelligent in-memory handling (news-store), but `revalidate: 0` tells Vercel's CDN to never cache the HTTP response. Even setting this to 120 seconds means that most requests within a 2-minute window are served from Vercel's edge cache — **zero function invocations** for those requests.

The news-store's stale-check logic still controls actual RSS fetching frequency; this just adds an HTTP layer cache on top.

---

#### Fix 3: Slow Down the Flights Client Poll

**File:** `app/components/MapView.tsx`
**Current:** `const FLIGHT_POLL_MS = 60_000` (every 60 seconds)
**Change:** `const FLIGHT_POLL_MS = 300_000` (every 5 minutes)

The server already caches flight data for 5 minutes. Polling every 60 seconds means 5 requests are served from the in-memory cache, but on Vercel each still **triggers a lambda invocation** (even for a cached response, the function runs to serve it). Matching the client poll to the cache TTL reduces invocations by 5×.

---

#### Fix 4: Add `revalidate` to Uncached Routes

**Files and changes:**

| File | Current | New |
|---|---|---|
| `app/api/oil-history/route.ts` | `revalidate: 0` | `revalidate: 180` |
| `app/api/ai-intel/route.ts` | `revalidate: 0` | `revalidate: 900` (15 min) |
| `app/api/flash-brief/route.ts` | (check) | `revalidate: 3600` (1 hr) |

For `ai-intel` and `flash-brief`, the response doesn't change more often than their cache TTLs anyway. The CDN cache means the first request within the window calls Groq; subsequent requests get the cached JSON instantly.

---

#### Fix 5: Remove `/api/test-groq`

**File:** `app/api/test-groq/route.ts`
**Action:** Delete this file. It was a diagnostic endpoint. It's still callable by anyone who knows the URL and will call Groq on every hit.

---

**Commit message for Tier 1 changes:**
```
perf: reduce Vercel invocations — disable SSE, add CDN cache headers, slow flights poll
```

**Expected total saving from Tier 1:** Reduce function invocations by ~60% and function duration by ~70%. Should bring the next invoice under $15.

---

### Tier 2: Move the Backend to Railway (Do This Week)

This is the proper long-term fix. The architecture becomes:

```
Browser
  │
  ├──→ Vercel (frametheglobe.xyz)
  │      Next.js frontend only: HTML, CSS, JS, static pages
  │      No more API routes here (except maybe /api/polymarket which is edge)
  │
  └──→ Railway (api.frametheglobe.xyz or similar)
         Express/Fastify Node.js server
         Persistent process: in-memory caches actually work
         SSE works properly: one process, one broadcaster, all clients subscribe
         Runs 24/7 at fixed cost (~$5/month on Railway Starter)
```

---

#### Step 1: Sign Up for Railway

URL: https://railway.app
Plan: **Hobby** ($5/month) — includes $5 credit, so effective cost can be $0 for low-usage apps
What you get: 512MB RAM, shared CPU, 100GB bandwidth, persistent Node.js process

Create a new project → "Deploy from GitHub repo" → we'll point it at a `/backend` folder in the FrameTheGlobe repo (or a separate repo, your choice).

---

#### Step 2: Create the Express Backend

We'll create a new folder: `backend/` at the root of the FrameTheGlobe repo.

Structure:
```
backend/
  src/
    index.ts          ← Express app entry point
    routes/
      news.ts         ← moved from app/api/news/route.ts
      market.ts       ← moved from app/api/market/route.ts
      agri-market.ts  ← moved from app/api/agri-market/route.ts
      flights.ts      ← moved from app/api/flights/route.ts
      stream.ts       ← moved from app/api/stream/route.ts (SSE works here!)
      oil-history.ts
      precious-metals.ts
      ai-intel.ts
      flash-brief.ts
      analyst-briefing.ts
      article-brief.ts
      analyze-ticker.ts
    lib/
      news-store.ts   ← shared in-memory store (works properly on persistent Node)
      fetcher.ts
      sources.ts
  package.json
  tsconfig.json
  railway.json        ← Railway deploy config
```

The migration is mostly copy-paste: each `route.ts` file becomes an Express handler. The `NextRequest/NextResponse` imports swap for `req/res`. The actual business logic (fetch, parse, return JSON) is identical.

---

#### Step 3: Wire Next.js to the Backend

Add one environment variable to both `.env.local` and Vercel:

```
BACKEND_URL=https://your-app.up.railway.app
```

Then in Next.js, instead of calling `/api/news`, call `${process.env.BACKEND_URL}/api/news`. This is a small change to each component's fetch URL — or we can add a thin Next.js proxy route that just forwards to Railway (keeps component code unchanged).

The proxy approach is easier:

```ts
// app/api/news/route.ts (new thin version — just a proxy)
export async function GET(req: Request) {
  const res = await fetch(`${process.env.BACKEND_URL}/api/news`);
  return new Response(res.body, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=120' }
  });
}
```

This way the components don't change at all. All heavy lifting moves to Railway.

---

#### Step 4: Re-enable SSE on Railway

Once the backend is on Railway, `app/api/stream/route.ts` moves to `backend/src/routes/stream.ts` and works exactly as designed — persistent Node.js process, one SSE broadcaster, all clients subscribe for free. The fix from Tier 1 (disabling SSE on Vercel) gets reverted, pointing the `EventSource` at Railway instead:

```ts
es = new EventSource(`${BACKEND_URL}/api/stream`);
```

---

#### Step 5: CORS Configuration

The Railway server needs to allow requests from `frametheglobe.xyz`:

```ts
import cors from 'cors';
app.use(cors({ origin: ['https://frametheglobe.xyz', 'http://localhost:3000'] }));
```

---

#### Railway Deploy Config (`backend/railway.json`)

```json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

Railway auto-detects Node.js, runs `npm install` and `npm run build`, then starts with the command above.

---

#### Environment Variables on Railway

Copy these from Vercel to Railway's environment settings:

```
GROQ_API_KEY=...
NODE_ENV=production
PORT=3000  (Railway sets this automatically)
```

---

### Tier 3: Long-Term Optimisation (After Railway is Running)

Once the backend is on a persistent Node.js server, several improvements become possible that weren't on Vercel:

---

#### Smart Shared RSS Cache

Currently every cold-start lambda fetches all RSS feeds from scratch (~100 sources). On Railway there's one warm process. We can implement a true shared cache:

- Fetch all feeds once on startup
- Refresh every 10 minutes via a `setInterval` background job
- All API requests and SSE clients read from this shared in-memory store
- Zero duplicate upstream requests regardless of traffic

This is actually what `news-store.ts` was designed for — it just doesn't work on serverless because there's no persistent process.

---

#### Single SSE Broadcaster (Pub/Sub)

Instead of each SSE client connection triggering its own feed refresh logic, the backend maintains one broadcaster:

```
Background job (every 10 min) → fetches feeds → updates cache → publishes to all SSE clients
```

All connected browsers get news simultaneously. Zero extra overhead per additional viewer.

---

#### Redis for Multi-Instance Scaling (Optional)

If traffic grows and Railway needs multiple instances, add Railway's free Redis add-on. The in-memory news cache and Groq response cache move to Redis, shared across all instances. Cost: $0 on Railway's free Redis tier (up to 25MB).

---

#### Cron-Based Groq Pre-Generation

Instead of generating AI intel on-demand (triggering Groq on every 15th-minute poll), pre-generate it server-side every 15 minutes via a background job. Every client request just reads the pre-generated JSON from memory. Groq is called exactly 4 times/hour regardless of visitor count.

---

#### Edge Runtime for Static/Semi-Static Routes

Move the `/api/polymarket` pattern (already on edge runtime) to more routes. Edge functions at Vercel are:
- Cheaper than Node.js serverless (different pricing tier)
- Globally distributed (lower latency)
- Good for: simple proxies, lightweight JSON transforms, routes that don't need Node.js builtins

Candidates: `precious-metals`, `oil-history` (after moving heavy lifting to Railway).

---

## Cost Projections

| Scenario | Monthly Vercel Cost | Monthly Railway | Total |
|---|---|---|---|
| Current (no changes) | ~$35 | $0 | ~$35 |
| After Tier 1 only | ~$12–15 | $0 | ~$15 |
| After Tier 1 + 2 | ~$3–5 (frontend only) | $5 | ~$8–10 |
| After Tier 1 + 2 + 3 | ~$0–3 (mostly free) | $5 | ~$5–8 |

Vercel's Hobby plan includes substantial free tier for a pure frontend:
- 100GB bandwidth/month (free)
- 6,000 function invocations/day (free) — easy to stay under if only thin proxy routes remain
- 100GB-seconds function duration/month (free)

---

## Implementation Checklist

### Tier 1 (Today)
- [ ] Disable SSE in `app/page.tsx` — comment out `new EventSource('/api/stream')`
- [ ] Add `export const revalidate = 120` to `app/api/news/route.ts`
- [ ] Change `FLIGHT_POLL_MS` in `MapView.tsx` from `60_000` to `300_000`
- [ ] Add `export const revalidate = 180` to `app/api/oil-history/route.ts`
- [ ] Add `export const revalidate = 900` to `app/api/ai-intel/route.ts`
- [ ] Delete `app/api/test-groq/route.ts`
- [ ] Commit and push → Vercel deploys automatically

### Tier 2 (This Week)
- [ ] Sign up for Railway (https://railway.app)
- [ ] Create `backend/` folder in repo with Express server scaffold
- [ ] Migrate API route handlers to Express (copy business logic)
- [ ] Set environment variables on Railway (GROQ_API_KEY etc.)
- [ ] Deploy backend to Railway, verify `/health` endpoint
- [ ] Add `BACKEND_URL` to Vercel environment variables
- [ ] Update Next.js API routes to proxy requests to `BACKEND_URL`
- [ ] Re-enable SSE — point EventSource at Railway backend URL
- [ ] Test end-to-end: news feed, oil prices, agri prices, Groq AI, flights
- [ ] Monitor Railway metrics for 24 hours
- [ ] Tag release as v6.2.0

### Tier 3 (Ongoing)
- [ ] Add background feed refresh job to Railway Express server
- [ ] Implement single SSE broadcaster replacing per-client refresh logic
- [ ] Move Groq calls to background pre-generation cron
- [ ] Evaluate Redis add-on if Railway scales to multiple instances

---

## File Change Summary for Tier 1

```
app/page.tsx                      — disable EventSource block
app/components/MapView.tsx        — FLIGHT_POLL_MS: 60_000 → 300_000
app/api/news/route.ts             — revalidate: 0 → 120
app/api/oil-history/route.ts      — revalidate: 0 → 180
app/api/ai-intel/route.ts         — revalidate: 0 → 900
app/api/test-groq/route.ts        — DELETE
```

## File Change Summary for Tier 2

```
backend/                          — NEW folder: Express API server
backend/src/index.ts              — Express entry point with health route
backend/src/routes/*.ts           — Migrated API handlers
backend/package.json              — dependencies: express, cors, node-fetch
backend/tsconfig.json             — TypeScript config
backend/railway.json              — Railway deploy config
app/api/news/route.ts             — Thin proxy to BACKEND_URL
app/api/market/route.ts           — Thin proxy to BACKEND_URL
app/api/agri-market/route.ts      — Thin proxy to BACKEND_URL
app/api/flights/route.ts          — Thin proxy to BACKEND_URL
app/api/stream/route.ts           — DELETE (handled by Railway backend)
app/api/ai-intel/route.ts         — Thin proxy to BACKEND_URL
app/api/flash-brief/route.ts      — Thin proxy to BACKEND_URL
app/page.tsx                      — Re-enable SSE pointing at BACKEND_URL
.env.local                        — Add BACKEND_URL=http://localhost:4000 (dev)
vercel.env                        — Add BACKEND_URL=https://xxx.up.railway.app
```

---

*Last updated: March 2026 — FrameTheGlobe infrastructure planning*

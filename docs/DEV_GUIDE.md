# FrameTheGlobe Developer Guide

This document explains how to run, test, and safely modify the FrameTheGlobe codebase. It is written to match the current implementation in this repo (Next.js App Router + in-memory SSE store + RSS ingestion).

## Quick Start (Local)

### 1. Prerequisites
- Node.js version: the repo targets Node `22` in Netlify, and also supports local `22` (see `.nvmrc`, `next.config.ts` comments, and `netlify.toml`).
- Package manager: `npm` (a `package-lock.json` exists).

### 2. Install dependencies

From the repo root:

```bash
npm ci
```

If you prefer `npm install`:

```bash
npm install
```

### 3. Configure environment

Create a `.env.local` file (repo root).

The repo’s existing `.env.example` only mentions optional OpenSky credentials, but the app’s AI features depend on:
- `GROQ_API_KEY` (optional; enables Groq/LLM-generated briefs and AI intel)

If you do not set `GROQ_API_KEY`, the API routes will fall back to deterministic algorithmic synthesis.

Example:

```bash
# Optional (only if you want AI-generated intelligence)
GROQ_API_KEY=your_key_here
```

### 4. Run the dev server

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Local Commands Reference

### Run
- `npm run dev` : `next dev --webpack`
- `npm run start` : `next start`

### Build
- `npm run build` : `bash scripts/build.sh`

Important note: `scripts/build.sh` is explicitly a **Hostinger build script**. It:
- runs `next build`
- creates `tmp/restart.txt`
- kills `next-server` processes via `pkill`

That is correct for Hostinger’s deployment model, but it can be disruptive if you’re running other `next-server` processes locally. If you need a “pure” build for local experimentation, prefer running `npx next build --webpack` directly (and only use `npm run build` when you specifically want the Hostinger behavior).

### Lint
- `npm run lint` : `eslint`

### Tests
- `npm run test` : `vitest run`
- `npm run test:watch` : `vitest`

## Debug Checklist Script

Run:

```bash
bash scripts/check.sh
```

This script is a targeted “preflight” for common integration issues. It checks (among other things):
- TypeScript compilation errors (`npx tsc --noEmit`)
- unit tests (`npm run test`)
- potential React style shorthand conflicts
- presence of `use client` when hooks are used
- duplicate source IDs in `lib/sources.ts`
- presence of key files (page, layout, css, key APIs)
- `.env.local` presence and whether ACLED credentials appear to still be placeholders

## Key Runtime Concepts (So Changes Don’t Break Production)

### 1. SSE depends on a persistent Node runtime

The app’s low-latency updates flow through `/api/stream` using **Server-Sent Events (SSE)**.

In `lib/news-store.ts`, the server maintains:
- an in-memory cached news payload (`_cache`)
- an in-memory SSE subscriber registry (`_subscribers`)
- a background refresh interval (only started when `typeof window === 'undefined'`)

On platforms that don’t keep a warm Node process, in-memory state can reset between requests. The UI also supports HTTP fetch fallbacks and localStorage caching so it remains usable.

### 2. Per-source cache + conditional GET in the fetcher

`lib/fetcher.ts` implements:
- per-source in-memory cache with a TTL (`CACHE_TTL_MS = 15 minutes`)
- conditional requests using `If-None-Match` (ETag) and `If-Modified-Since` (Last-Modified)
- a failure skip mechanism:
  - after `SKIP_THRESHOLD` consecutive failures, the source is skipped for `SKIP_TTL_MS` (30 minutes)

### 3. Client-side caching

The main client page (`app/page.tsx`) restores cached payload immediately on load:
- uses `localStorage` key `ftg_news_v2`
- caches the items + health report
- discards cached data after `LS_MAX_AGE = 30 minutes`

This prevents a “blank UI” on reload and also reduces provider load by relying on cached results until SSE/HTTP refresh arrives.

## Where to Look When You Change Something

Use these pointers as a “map”:
- UI and client orchestration: `app/page.tsx`
- SSE + shared in-memory store: `app/api/stream/route.ts`, `lib/news-store.ts`
- RSS aggregation + scoring: `app/api/news/route.ts`, `lib/fetcher.ts`, `lib/sources.ts`
- Map + aircraft: `app/api/flights/route.ts`, `lib/flights.ts`, `app/components/MapView.tsx`
- AI endpoints: `app/api/ai-intel/route.ts`, `app/api/flash-brief/route.ts`, `app/api/article-brief/route.ts`
- Styling + theme tokens: `app/globals.css`, `app/layout.tsx`

## Troubleshooting

### SSE doesn’t update live
1. Confirm the server route is reachable: `/api/stream`
2. Ensure proxy/load balancer buffering is disabled for SSE paths.
   - The SSE response sets `X-Accel-Buffering: no`
   - The README/route comments note `proxy_buffering off` for nginx-like setups.
3. Confirm the client has SSE support:
   - the UI falls back to polling every 5 minutes if `EventSource` is unavailable.

### Builds fail on Hostinger
- If static chunk paths 404, ensure your deployment follows the Hostinger script expectations:
  - `hostinger-post-pull.sh` removes `.next` and rebuilds
  - `scripts/build.sh` touches `tmp/restart.txt` and kills stale `next-server` processes

### AI appears “missing”
- If you did not set `GROQ_API_KEY`, the AI endpoints will return deterministic algorithmic outputs instead.

## Notes for Contributors

When adding a new data source, remember:
- every source should have a unique `id` in `lib/sources.ts`
- failure behavior (skip windows and cache TTL) is implemented per source ID

When adding new UI widgets:
- prefer keeping the main client page’s state logic stable
- isolate non-trivial transformations into dedicated functions (or components) so recomputations remain predictable


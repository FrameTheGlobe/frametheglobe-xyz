# Architecture & Build Notes

This document explains what the app does and how it was built in this repository:
- module layout
- ingestion and scoring pipeline
- SSE delivery
- clustering/storyline logic
- optional AI endpoints
- build/deployment choices (Hostinger, Netlify, etc.)

All descriptions below are grounded in the current source tree.

## High-Level: What the App Does

FrameTheGlobe is a real-time geopolitical intelligence dashboard that:
- aggregates RSS feeds from a curated source set (`lib/sources.ts`)
- normalizes and filters incoming items to focus on the Iran War / broader theater
- scores items for relevance and de-duplicates narrative repetition
- clusters similar titles into “storylines” (the UI’s backbone)
- delivers live updates using SSE (`/api/stream`)
- provides additional “systems” views:
  - tickers and market signals
  - flight activity (ADS-B)
  - brief/intel generation (optional Groq AI; deterministic fallbacks)
  - a Leaflet-based map (client-only)

## Module Map (How Code Is Organized)

### Data sources
- `lib/sources.ts`
  - defines `SOURCES`: an array of `{ id, name, url, region, color, prefiltered? }`
  - sources are grouped implicitly by `region` and used to filter fetches

### Ingestion, scoring, and fetch controls
- `lib/fetcher.ts`
  - RSS fetching + parsing via `rss-parser`
  - in-memory per-source cache
  - conditional GET support using `ETag` and `Last-Modified`
  - failure skip windows for repeated upstream errors
  - “Iran Theater” keyword matching and item scoring:
    - `computeRelevanceScore(text)`
    - `computeNoveltyPenalty(item, allItems)`
    - final `finalScore = max(0, relevanceScore - noveltyPenalty) * trustWeight`

### Shared in-memory cache + SSE subscriber registry
- `lib/news-store.ts`
  - store-level TTL: `CACHE_TTL_MS = 10 minutes`
  - per-request force refresh cooldown: `FORCE_REFRESH_COOLDOWN_MS = 5 minutes`
  - SSE subscriber registry:
    - `addSSESubscriber(id, enqueue)`
    - `removeSSESubscriber(id)`
  - broadcasts store updates by converting payloads into SSE-formatted strings
  - background refresh:
    - interval runs every ~8 minutes (kept under the 10-minute TTL)
    - re-fetches all sources and updates `_cache`

### API routes (server)
- `app/api/news/route.ts`
  - serves JSON payload from `lib/news-store.ts`
  - supports:
    - `?refresh=1` (rate-limited)
    - `?region=<region>` (filters sources)
  - sets `health` and `failedSources` in payload

- `app/api/stream/route.ts`
  - SSE endpoint
  - sets `runtime = 'nodejs'` and forces dynamic behavior
  - adds per-IP connection limits (cap per IP)
  - keeps the connection alive with heartbeat comments

- `app/api/rss/route.ts`
  - returns an RSS 2.0 document derived from the same cached payload used by `/api/news`
  - clamps `?limit` to a safe maximum (100)
  - returns `503` if the cache is empty on cold start

- Brief and analysis endpoints
  - `app/api/flash-brief/route.ts` (POST)
    - returns a morning brief (AI if `GROQ_API_KEY` exists, else algorithmic)
    - cached server-side in-process for 60 minutes keyed by a fingerprint
  - `app/api/article-brief/route.ts` (POST)
    - returns a 2–3 sentence “what this means” brief for one article
    - in-process cached in a Map keyed by title slice
  - `app/api/ai-intel/route.ts` (POST)
    - returns structured intelligence payload:
      - `strategicRisk`, `theaters`, `instability`, `forecasts`, `insights`, `sigint`, etc.
    - Groq path when `GROQ_API_KEY` exists; else deterministic synthesis
    - in-process cache TTL 15 minutes keyed by fingerprint

### Client entry page (UI orchestration)
- `app/page.tsx`
  - defines lens/filter system (`LENSES`)
  - defines alert profiles (keyword bundles + lens targeting)
  - maintains UI state (active lenses, active sources, pinned items, theme, etc.)
  - fetches `/api/news` and `/api/market`
  - restores cached payload from localStorage immediately
  - connects to SSE (`EventSource('/api/stream')`) with polling fallback
  - computes storylines:
    - `buildClusters(items: FeedItem[])`

## The Intelligence Pipeline (Detailed)

### 1. Fetching: per-source cache + conditional requests

`lib/fetcher.ts` implements `fetchFeed(source)`:
- checks if the source is temporarily skipped due to repeated failures
- returns in-memory cached items if still inside TTL
- sends conditional headers to providers when `etag` / `lastModified` exist
- handles `304 Not Modified` by refreshing the cache timestamp and returning cached items
- parses RSS XML into items using `rss-parser`

Normalization includes:
- ensure `title` exists (fallback logic if missing)
- derive `pubDate` from `pubDate` / `isoDate` / fallback to current time
- strip HTML tags from `summary`
- resolve relative/relative-guid links into absolute URLs when possible
- extract `imageUrl` from `enclosure` or media content when present

### 2. Filtering: focus on theater keywords

After scoring normalization, `fetchFeed` applies:
- if `source.prefiltered` is set: skip the matching filter (source is assumed pre-focused)
- else:
  - `matchesIranTheater(item)` uses a large keyword set over the combined title/summary text

### 3. Item scoring: relevance minus novelty, weighted by trust

In the fetcher:
- `computeRelevanceScore(text)`:
  - phrase boosts (exact-ish phrase presence in the text)
  - token-based weighted keywords that map token/keyword interactions to numeric boosts
- `computeNoveltyPenalty(item, allItems)`:
  - finds recent items (6-hour window)
  - penalizes items that have high Jaccard similarity to multiple recent items

Final score (conceptually):
- trustWeight (from `SOURCE_TRUST[sourceId]`)
- relevance minus novelty

### 4. Store-level caching + distribution

When `/api/news` refreshes or background refresh triggers:
- `setNewsCache(payload)` stores data in `lib/news-store.ts` and broadcasts it to SSE clients

The store TTL and forced refresh cooldown help prevent stampedes and feed abuse.

## Storyline Clustering (UI Engine)

Storylines are built on the client in `app/page.tsx` using `buildClusters(items)`.

### 1. Title tokenization

`titleToKeySet(title)`:
- lowercases
- strips non-alphanumeric characters
- splits into tokens
- removes stopwords (`CLUSTER_STOPWORDS`)
- keeps tokens longer than 2 chars

### 2. Similarity metric

`jaccardSimilarity(a, b)`:
- similarity = `|intersection| / |union|`

### 3. Clustering criteria

Clusters are seeded with one item and then:
- another item is assigned if:
  - time window: within 12 hours of the seed item
  - similarity threshold: Jaccard >= 0.40

This is a simplified approach that emphasizes speed and “good enough” narrative grouping.

### 4. Cluster scoring

For each cluster:
- it sorts cluster items by `pubDate` (newest first)
- computes:
  - recency drop-off (exponential decay)
  - breaking news boost for anything < 30 minutes old
  - narrative diversity boost based on unique region count
  - keywordBoost capped at 2.5
- final `score` combines cluster size, recency, breakingBoost, diversityBoost, and keywordBoost

### 5. Consensus and contradiction enrichment

Clusters are enriched with:
- `consensus`:
  - derived from source diversity, trust, and corroboration count
- `contradiction`:
  - derived from novelty penalty, trust, and low relevance signals

These outputs drive UI color/state decisions and operator-style “confidence” cues.

## SSE Delivery: Real-Time With Guard Rails

### 1. SSE endpoint behavior

`app/api/stream/route.ts`:
- uses a server-side ReadableStream
- registers each client in `lib/news-store.ts` using `addSSESubscriber`
- enqueues SSE updates whenever the store broadcasts a new payload

### 2. Heartbeats

To keep the connection alive, it sends heartbeat comments:
- comment format: `: heartbeat\n\n`
- interval: every 25 seconds

### 3. Cleanup and disconnect

When the request is aborted or the SSE stream is cancelled:
- heartbeat interval is cleared
- subscriber is removed
- IP connection counters are decremented

### 4. Client SSE consumption + polling fallback

In `app/page.tsx`:
- initial HTTP load happens (`fetchNews()`)
- then SSE connection is attempted:
  - `EventSource('/api/stream')`
- on SSE errors:
  - after a few attempts it falls back to polling every 5 minutes
  - it also schedules periodic SSE retry attempts

This ensures the UI remains “alive” even through networking issues.

## AI Endpoints: Groq-Optional, Deterministic-First

### `GROQ_API_KEY` optional behavior

If `GROQ_API_KEY` exists:
- endpoints call Groq’s chat completions
- they require structured JSON responses (via prompt constraints / JSON extraction)

If `GROQ_API_KEY` is absent:
- endpoints use algorithmic synthesis based on keyword corpora

### In-process caching

The AI endpoints cache results in memory (per server instance) to reduce repeated calls:
- `flash-brief`: 60 minutes TTL
- `article-brief`: 30 minutes TTL in Map
- `ai-intel`: 15 minutes TTL, keyed by a fingerprint of top headlines

## Map & Flights Subsystem

Flights are served by:
- `lib/flights.ts` which calls adsb.lol
- `app/api/flights/route.ts` which wraps it in a JSON API and supports `?strategic=1`

This is a node-only subsystem (no SSR).

## Build & Deployment: Why the Repo Has These “Hostinger-Specific” Parts

### 1. Next.js config tweaks (`next.config.ts`)

`next.config.ts` contains Hostinger-specific notes, including:
- intentionally not setting `output: 'standalone'`
  - because Hostinger’s Apache intercepts static files and expects them in specific locations
- `serverExternalPackages: ['rss-parser', 'xml2js', 'sax']`
  - prevents Hostinger sandbox restrictions from breaking RSS parsing libraries

It also sets cache headers:
- immutable caching for `/_next/static/*` chunks
- no-cache for HTML routes (to avoid hydration breakages from stale chunk hashes)

### 2. Hostinger build script (`scripts/build.sh`)

`scripts/build.sh`:
- runs `next build`
- creates `tmp/restart.txt` to signal Passenger
- kills stale `next-server` processes to avoid serving old HTML referencing deleted chunk hashes

### 3. Hostinger post-pull script (`hostinger-post-pull.sh`)

`hostinger-post-pull.sh`:
- forces Node 20
- installs prod dependencies only (`npm install --omit=dev`)
- deletes `.next`
- runs `npm run build`
- touches `tmp/restart.txt`
- optionally restarts `pm2` if installed

### 4. Custom server (`server.js`)

`server.js` ensures:
- it always uses the project root via `__dirname`
- `process.env.NODE_ENV` is forced to `production`
- it runs `next({ dev: false, dir })` and delegates requests to `handle`

This avoids Hostinger injecting NODE_ENV incorrectly and breaking the chunk hashes expected by pre-rendered HTML.

### 5. Netlify (`netlify.toml`)

`netlify.toml` specifies:
- build command `npm run build`
- Node version 22 for the build environment

## Notes on `proxy.ts` (Edge Middleware)

There is a `proxy.ts` file that defines:
- route matching for `/api/:path*`
- UA-based blocking for headless automation fingerprints

However, Next.js applies middleware only when the middleware entrypoint exists (typically `middleware.ts`). In this repo, there is no `middleware.ts`, so verify wiring before relying on the behavior described in `proxy.ts`.

## Recommended Change Workflow

When you modify ingestion, scoring, or clustering:
1. run TypeScript (`npx tsc --noEmit`) and unit tests (`npm run test`)
2. run the debug checklist (`bash scripts/check.sh`)
3. validate that `/api/news` payload shape still matches client expectations
4. check SSE heartbeat and reconnect logic (client and server) remain intact


# FrameTheGlobe App Philosophy

FrameTheGlobe exists to reduce the time between “something is happening” and “I understand what matters”.

It is deliberately built like a cockpit:
- high information density
- stateful signals (live/connecting/polling)
- clustering and corroboration cues
- fast switching between lenses (topics)

The goal is not to be a traditional feed reader. The goal is to help you *operate* on incoming signals.

## What “Intelligence” Means in This App

In this repo, “intelligence” is produced by deterministic and lightweight heuristics plus optional AI synthesis.

There are two main sources of intelligence:

### 1. Deterministic signal pipeline
This is always available:
- fetch and normalize RSS items (`lib/fetcher.ts`)
- score relevance and novelty
- cluster similar titles into storylines (`app/page.tsx`)
- enrich clusters with consensus/contradiction indicators

### 2. Optional AI synthesis
This is additive:
- when `GROQ_API_KEY` is set, API routes call Groq to generate structured summaries
- when it is not set, the app falls back to algorithmic briefs and synthesis

The app is structured so the UI and operational experience still work in either mode.

## Principles Behind the Implementation

### Resilience over purity
RSS feeds are messy:
- missing titles
- HTML embedded in summary fields
- different date formats
- inconsistent link/guid fields

The fetcher normalizes items and tries to keep the app functional when upstream data is incomplete.

### Speed with safety valves
The implementation uses multiple “guard rails”:
- per-source caching (TTL) and conditional GET (ETag / Last-Modified)
- per-source failure skip windows
- batch fetching across sources
- SSE connection caps per IP
- client-side localStorage caching as a fast path

These are intended to protect:
- users from blank/slow screens
- feed providers from unintentional abuse patterns
- the server from uncontrolled load

### Low latency delivery with graceful fallback
Live updates are delivered by SSE (`/api/stream`).

If SSE isn’t available or fails repeatedly, the UI switches to polling and periodically retries SSE.

This makes the app robust across different hosting setups and browsers.

## Operational Assumptions

### In-memory state is a feature when the server stays warm
`lib/news-store.ts` is an in-memory singleton:
- cached payload is kept in `_cache`
- SSE subscribers are kept in `_subscribers`
- a background refresh interval warms the cache on a persistent Node runtime

If you deploy to an environment that does not keep a warm Node runtime, the SSE/cached behavior will reset more often. The UI mitigates this with HTTP fetches and localStorage.

### The app treats “latest” as a relative measure
Some decisions are time-based:
- scoring uses exponential time decay
- clustering uses a 12-hour time window
- localStorage cache expires after 30 minutes
- feed cache TTL is 15 minutes, store cache TTL is 10 minutes

These choices keep the “intel” view aligned to recent events instead of historical backlog.

## Ethics / Content Notes (Practical)

This application aggregates third-party sources. It does not “prove” claims; it:
- groups similar stories
- surfaces corroboration/novelty signals
- optionally synthesizes a narrative brief

For any use in high-stakes contexts, treat the outputs as an operational aid and verify against primary reporting.


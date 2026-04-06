# Deployment Checklist (Vercel + Railway)

Use this checklist before and after every production push.

## 1) Pre-push checks

- `npm run lint`
- `npm run test`
- `npm run verify:env` (or set env vars and run in the target environment)

## 2) Frontend (Vercel) checks

Required env vars:

- `BACKEND_URL=https://<railway-backend-domain>`
- `NEXT_PUBLIC_BACKEND_URL=https://<railway-backend-domain>`

Verification:

- Open `https://<vercel-domain>/api/news` and confirm JSON response
- Open `https://<vercel-domain>/api/market` and confirm JSON response
- Open app and verify:
  - live news load
  - theater widgets load
  - live feeds render

If stale UI appears:

- Redeploy latest commit with build cache disabled
- Hard refresh browser (`Cmd+Shift+R`)

## 3) Backend (Railway) checks

- Service root directory is `/backend`
- Start command uses `node dist/index.js`
- Health endpoint returns 200 at `/health`

Recommended env vars:

- `NODE_ENV=production`
- `GROQ_API_KEY` (AI routes use fallback when absent)

Verification:

- `https://<railway-domain>/health` returns `{ ok: true, ... }`
- `https://<railway-domain>/api/news` returns payload with `items`

## 4) Post-deploy regression checks

- Confirm `/api/stream` redirects to backend stream endpoint
- Confirm Iran theater cost/missile sections are visible in UI
- Confirm polymarket/live-feeds blocks are not empty due to proxy/env issues


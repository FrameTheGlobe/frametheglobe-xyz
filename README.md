# FrameTheGlobe

Iran war theater news aggregator — [frametheglobe.xyz](https://frametheglobe.xyz). Next.js 16 (App Router), React 19, TypeScript, Tailwind 4.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on your own Node.js server

The app is built to run on a **single Node.js process** (no serverless or edge). All API routes use the Node.js runtime; the live stream (`/api/stream`) and in-memory cache require one persistent process.

**Requirements:** Node.js **20.9 or higher** (see `engines` in `package.json`).

1. On your server:
   ```bash
   git clone <your-repo> && cd frametheglobexyz
   npm ci
   npm run build
   npm start
   ```
2. The app listens on `PORT` (default `3000`). Use a process manager (e.g. systemd, PM2) and a reverse proxy (nginx, Caddy) in front.
3. **SSE:** For `/api/stream` to work behind nginx, disable buffering:
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
4. **Optional env:**  
   - `ACLED_API_KEY` and `ACLED_EMAIL` — if set, ACLED source is enabled; otherwise it is skipped (no errors).

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js deployment](https://nextjs.org/docs/app/building-your-application/deploying)

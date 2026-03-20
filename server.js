// server.js — custom Next.js server for Hostinger Node.js hosting
//
// WHY THIS EXISTS:
//
// 1. dir: __dirname
//    Hostinger's runner may launch this file from a CWD that differs from the
//    repo root. `next start` resolves .next/ relative to CWD — if that's wrong,
//    every /_next/static/ chunk 404s while the pre-rendered HTML shell still
//    renders. Passing dir: __dirname pins the project root to this file's
//    location, which is always correct.
//
// 2. Explicit production mode
//    Hostinger's App Hosting does NOT inject NODE_ENV automatically. Without it,
//    `process.env.NODE_ENV !== 'production'` is true and Next.js launches in
//    dev mode — which ignores the pre-built .next/ chunks and recompiles
//    everything in-memory with different hashes. The pre-rendered HTML references
//    the production hashes → every JS/CSS chunk returns 404.
//    We force production: true here so the built .next/ is always used.
//
// 3. PORT
//    Hostinger injects the assigned port via process.env.PORT. Falls back to 3000
//    for local development.

'use strict';

// Force production mode regardless of what the host injects.
// This is safe — this file is never used for local development (use `npm run dev`).
process.env.NODE_ENV = 'production';

const http    = require('http');
const { parse } = require('url');
const next    = require('next');

const port = parseInt(process.env.PORT || '3000', 10);
const dir  = __dirname; // always the repo root, regardless of CWD

const app    = next({ dev: false, dir });
const handle = app.getRequestHandler();

app.prepare().then(function () {
  http.createServer(function (req, res) {
    try {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Unhandled request error:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, function (err) {
    if (err) throw err;
    console.log('> FrameTheGlobe ready on port ' + port);
  });
}).catch(function (err) {
  console.error('Failed to start Next.js server:', err);
  process.exit(1);
});

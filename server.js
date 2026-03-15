'use strict';
/**
 * server.js — Hostinger startup file for FrameTheGlobe
 *
 * hPanel → Node.js → Startup file : server.js
 * hPanel → Node.js → Node version : 20.x
 *
 * The build (npm run build) is handled by GitHub Actions before this
 * file runs — do NOT put build logic here as it gets killed on Hostinger.
 */

const { createServer } = require('http');
const { parse }        = require('url');
const next             = require('next');
const path             = require('path');
const fs               = require('fs');

const port     = parseInt(process.env.PORT, 10) || 3000;
const hostname = '0.0.0.0';

// Bail early with a clear message if the build hasn't run yet
if (!fs.existsSync(path.join(__dirname, '.next', 'BUILD_ID'))) {
  console.error('[FTG] ERROR: .next not found. Run "npm run build" first.');
  console.error('[FTG] GitHub Actions should have done this — check the Actions log.');
  process.exit(1);
}

// ── Start Next.js production server ──────────────────────────────────────────
const app    = next({ dev: false, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('[FTG] Request error:', err);
        res.statusCode = 500;
        res.end('Internal server error');
      }
    }).listen(port, hostname, err => {
      if (err) throw err;
      console.log(`[FTG] Ready on http://${hostname}:${port}`);
    });
  })
  .catch(err => {
    console.error('[FTG] Failed to start server:', err);
    process.exit(1);
  });

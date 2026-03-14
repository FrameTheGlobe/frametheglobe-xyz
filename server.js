'use strict';
/**
 * server.js — Hostinger startup file for FrameTheGlobe
 *
 * Hostinger hPanel → Node.js → Startup file: server.js
 * Hostinger hPanel → Node.js → Node version: 20.x
 *
 * This file:
 *  1. Builds the Next.js app if the build output is missing
 *  2. Starts the Next.js production server on the Hostinger-assigned PORT
 */

const { createServer } = require('http');
const { parse }        = require('url');
const next             = require('next');
const { execSync }     = require('child_process');
const fs               = require('fs');
const path             = require('path');

const port     = parseInt(process.env.PORT, 10) || 3000;
const hostname = '0.0.0.0';

// ── Build if not already built ────────────────────────────────────────────────
const buildIdPath = path.join(__dirname, '.next', 'BUILD_ID');
if (!fs.existsSync(buildIdPath)) {
  console.log('[FTG] .next not found — running npm run build...');
  try {
    execSync('npm run build', { cwd: __dirname, stdio: 'inherit' });
    console.log('[FTG] Build complete.');
  } catch (err) {
    console.error('[FTG] Build failed:', err.message);
    process.exit(1);
  }
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

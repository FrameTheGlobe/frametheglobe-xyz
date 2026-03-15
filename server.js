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

// ── Hostinger Static File Fix ────────────────────────────────────────────────
// On Hostinger LiteSpeed + Node.js, static file requests to /_next/static/...
// are usually intercepted by the web server (avoiding the Node.js proxy).
// Since the web server looks for an actual folder matching the URL in the
// Document Root, and refusing to serve hidden dot-directories like `.next`,
// explicitly copying `.next/static` to `_next/static` solves the 404 issue.
try {
  const nextStatic = path.join(__dirname, '.next', 'static');
  const underscoreNextStatic = path.join(__dirname, '_next', 'static');
  if (fs.existsSync(nextStatic)) {
    console.log('[FTG] Exporting static chunks to ./_next/static for LiteSpeed...');
    execSync(`rm -rf "${path.join(__dirname, '_next')}"`);
    fs.mkdirSync(path.join(__dirname, '_next'), { recursive: true });
    execSync(`cp -r "${nextStatic}" "${underscoreNextStatic}"`);
  }
} catch (err) {
  console.error('[FTG] Note: Failed to export _next static files:', err.message);
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

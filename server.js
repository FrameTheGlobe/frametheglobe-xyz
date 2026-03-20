// server.js — custom Next.js server for Hostinger Node.js hosting
//
// WHY THIS EXISTS:
// Hostinger's Node.js runner executes the startup file from a working directory
// that may differ from the project root. When `next start` launches without an
// explicit --dir, it looks for .next/ relative to CWD, which can be wrong,
// causing every /_next/static/ asset to return 404 while the SSR HTML still
// renders (because Next.js falls back to the pre-rendered shell).
//
// `dir: __dirname` pins the project root to wherever THIS file lives, which is
// always the repo root — regardless of what CWD Hostinger uses.
//
// PORT: Hostinger injects the assigned port via process.env.PORT. This server
// respects that automatically; `next start` does too, but being explicit here
// avoids any edge-cases with their runner.

'use strict';

const http    = require('http');
const { parse } = require('url');
const path    = require('path');
const next    = require('next');

const dev  = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const dir  = __dirname; // always the repo root, regardless of CWD

const app    = next({ dev, dir });
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

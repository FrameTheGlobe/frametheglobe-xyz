/**
 * FrameTheGlobe — Express backend
 *
 * Runs on Railway as a persistent Node.js process.
 * All heavy API routes live here; Vercel serves only the Next.js frontend
 * and a thin proxy layer that forwards to this server.
 *
 * Benefits over Vercel serverless:
 *  - In-memory caches persist between requests (no cold-start cache miss)
 *  - SSE connections are cheap (one process, many subscribers)
 *  - Fixed ~$5/month cost regardless of traffic
 *  - No 10-second timeout — Groq calls can take as long as needed
 */

import express from 'express';
import cors from 'cors';

import marketRouter       from './routes/market.js';
import agriMarketRouter   from './routes/agri-market.js';
import flightsRouter      from './routes/flights.js';
import oilHistoryRouter   from './routes/oil-history.js';
import preciousMetalsRouter from './routes/precious-metals.js';
import newsRouter         from './routes/news.js';
import streamRouter       from './routes/stream.js';
import aiIntelRouter      from './routes/ai-intel.js';
import flashBriefRouter   from './routes/flash-brief.js';
import analystBriefingRouter from './routes/analyst-briefing.js';
import analyzeTickerRouter   from './routes/analyze-ticker.js';
import articleBriefRouter    from './routes/article-brief.js';

const app  = express();
const PORT = process.env.PORT ?? 4000;

// ── CORS ────────────────────────────────────────────────────────────────────
// Allow requests from the Vercel frontend and local dev.
const ALLOWED_ORIGINS = [
  'https://frametheglobe.xyz',
  'https://www.frametheglobe.xyz',
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server (no origin header) and whitelisted origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    ok:      true,
    service: 'frametheglobe-backend',
    uptime:  Math.floor(process.uptime()),
    memory:  `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    env:     process.env.NODE_ENV ?? 'development',
    ts:      new Date().toISOString(),
  });
});

// ── API routes ───────────────────────────────────────────────────────────────
app.use('/api/market',            marketRouter);
app.use('/api/agri-market',       agriMarketRouter);
app.use('/api/flights',           flightsRouter);
app.use('/api/oil-history',       oilHistoryRouter);
app.use('/api/precious-metals',   preciousMetalsRouter);
app.use('/api/news',              newsRouter);
app.use('/api/stream',            streamRouter);
app.use('/api/ai-intel',          aiIntelRouter);
app.use('/api/flash-brief',       flashBriefRouter);
app.use('/api/analyst-briefing',  analystBriefingRouter);
app.use('/api/analyze-ticker',    analyzeTickerRouter);
app.use('/api/article-brief',     articleBriefRouter);

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[FTG backend] Listening on port ${PORT}`);
  console.log(`[FTG backend] GROQ_API_KEY: ${process.env.GROQ_API_KEY ? 'set ✓' : 'NOT SET'}`);
});

export default app;

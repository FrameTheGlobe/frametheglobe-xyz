/**
 * POST /api/analyst-briefing
 * AI-generated market + conflict intelligence briefing.
 * Cache: 10 min. Rate-limit: 10/60s per IP.
 */

import { Router, Request, Response } from 'express';
import { rateLimit, retryAfterSeconds } from '../lib/rate-limit.js';

const router = Router();

type BriefingResult = {
  marketSummary: string; conflictAlignment: string; riskAssessment: string;
  watchpoints: string[]; riskScore: number;
  riskLabel: 'CRITICAL' | 'ELEVATED' | 'MODERATE' | 'LOW';
  generatedBy: 'groq-ai' | 'algorithmic'; generatedAt: string;
};

type CacheEntry = { result: BriefingResult; at: number; key: string };
let _cache: CacheEntry | null = null;
const CACHE_TTL = 10 * 60 * 1000;

async function callGroq(oilSummary: string, metalsSummary: string, polymarketSummary: string): Promise<Omit<BriefingResult, 'generatedAt' | 'generatedBy'> | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const prompt = `You are a senior geopolitical energy and defense analyst. Generate a structured intelligence briefing from this live Iran conflict dashboard snapshot.\n\nLIVE DATA (${new Date().toUTCString()}):\n\nOIL & ENERGY MARKETS:\n${oilSummary}\n\nSAFE-HAVEN METALS:\n${metalsSummary}\n\nPREDICTION MARKETS (Polymarket):\n${polymarketSummary}\n\nReturn JSON with exactly this structure:\n{\n  "marketSummary": "2-3 sentences on commodity signals and Iran conflict risk pricing",\n  "conflictAlignment": "2-3 sentences on whether markets correctly price Polymarket conflict odds",\n  "riskAssessment": "2-3 sentences on strategic risk level and key drivers",\n  "watchpoints": ["specific 24-48h catalyst 1","distinct catalyst 2","leading indicator 3"],\n  "riskScore": 65,\n  "riskLabel": "ELEVATED"\n}\nriskLabel must be one of: CRITICAL, ELEVATED, MODERATE, LOW.`;
  const controller = new AbortController();
  const tid        = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 700, temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: 'Senior geopolitical analyst. JSON only.' }, { role: 'user', content: prompt }] }),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const raw   = data?.choices?.[0]?.message?.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch { return null; }
  finally { clearTimeout(tid); }
}

function algorithmicBriefing(oilSummary: string, polymarketSummary: string): Omit<BriefingResult, 'generatedAt' | 'generatedBy'> {
  const poly      = polymarketSummary.toLowerCase();
  const oilUp     = oilSummary.includes('+');
  const highOdds  = /7[0-9]%|8[0-9]%|9[0-9]%/.test(poly);
  const medOdds   = /5[0-9]%|6[0-9]%/.test(poly);
  const riskScore = highOdds ? 72 : medOdds ? 58 : 44;
  const riskLabel = riskScore >= 70 ? 'ELEVATED' : riskScore >= 50 ? 'MODERATE' : 'LOW';
  return {
    marketSummary: `${oilUp ? 'Oil and commodities are advancing' : 'Commodity markets are mixed'}, reflecting an embedded Iran conflict risk premium. Safe-haven metals ${oilUp ? 'are tracking gains' : 'remain elevated'}, suggesting sustained geopolitical uncertainty in cross-asset positioning.`,
    conflictAlignment: `Polymarket prediction odds and commodity prices are ${highOdds ? 'strongly aligned, both pricing elevated conflict probability' : 'broadly consistent but showing some divergence'}. Any rapid divergence is an early indicator of new intelligence entering the market.`,
    riskAssessment: `Strategic risk in the Iran theater is currently assessed at ${riskLabel} (${riskScore}/100). Key escalation drivers: IRGC naval activity near Hormuz and US Congressional authorization signals. De-escalation requires credible diplomatic back-channel signals — currently absent.`,
    watchpoints: [
      'IAEA Iran inspection report — any enrichment acceleration would sharply reprice conflict odds',
      'IRGC naval patrol activity near Hormuz — tanker interdiction signal would be immediate oil catalyst',
      'US Congressional signals on Iran military authorization — Polymarket odds are the leading indicator',
    ],
    riskScore, riskLabel: riskLabel as BriefingResult['riskLabel'],
  };
}

router.post('/', async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'anon';
  if (!rateLimit(`analyst-briefing:${ip}`, 10, 60_000)) {
    return res.status(429).set('Retry-After', String(retryAfterSeconds(`analyst-briefing:${ip}`))).json({ error: 'Rate limit exceeded' });
  }
  const b                 = (req.body ?? {}) as any;
  const oilSummary        = String(b.oilSummary        ?? '').slice(0, 800);
  const metalsSummary     = String(b.metalsSummary     ?? '').slice(0, 400);
  const polymarketSummary = String(b.polymarketSummary ?? '').slice(0, 600);
  if (!oilSummary) return res.status(400).json({ error: 'oilSummary is required' });
  const fingerprint = `${oilSummary.slice(0, 50)}|${polymarketSummary.slice(0, 50)}`;
  if (_cache && Date.now() - _cache.at < CACHE_TTL && _cache.key === fingerprint) {
    return res.json({ ..._cache.result, cached: true });
  }
  const groqResult = await callGroq(oilSummary, metalsSummary, polymarketSummary);
  const partial    = groqResult ?? algorithmicBriefing(oilSummary, polymarketSummary);
  const result: BriefingResult = { ...partial, generatedBy: groqResult ? 'groq-ai' : 'algorithmic', generatedAt: new Date().toISOString() };
  _cache = { result, at: Date.now(), key: fingerprint };
  return res.json(result);
});

export default router;

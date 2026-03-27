/**
 * /api/analyst-briefing  (POST)
 *
 * Generates a structured 4-section analyst briefing from a live market snapshot.
 * The client sends text summaries of current oil/metals/polymarket data (formatted
 * from the widget state) and receives an AI-written intelligence brief.
 *
 * Falls back to a deterministic brief when GROQ_API_KEY is absent.
 * Cache: 10 min keyed by fingerprint of input summaries.
 * Rate-limit: 10 req / 60 s per IP (heavier call).
 */

import { NextResponse } from 'next/server';
import { rateLimit, retryAfterSeconds } from '@/lib/rate-limit';

export const runtime   = 'nodejs';
export const revalidate = 0;

// ── Types ──────────────────────────────────────────────────────────────────────

export type BriefingResult = {
  marketSummary:     string;
  conflictAlignment: string;
  riskAssessment:    string;
  watchpoints:       string[];
  riskScore:         number;
  riskLabel:         'CRITICAL' | 'ELEVATED' | 'MODERATE' | 'LOW';
  generatedBy:       'groq-ai' | 'algorithmic';
  generatedAt:       string;
};

// ── Cache ──────────────────────────────────────────────────────────────────────

type CacheEntry = { result: BriefingResult; at: number; key: string };
let _cache: CacheEntry | null = null;
const CACHE_TTL = 10 * 60 * 1000;

// ── Groq call ─────────────────────────────────────────────────────────────────

async function callGroq(
  oilSummary: string,
  metalsSummary: string,
  polymarketSummary: string,
): Promise<Omit<BriefingResult, 'generatedAt' | 'generatedBy'> | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are a senior geopolitical energy and defense analyst. Generate a structured intelligence briefing from this live Iran conflict dashboard snapshot.

LIVE DATA (${new Date().toUTCString()}):

OIL & ENERGY MARKETS:
${oilSummary}

SAFE-HAVEN METALS:
${metalsSummary}

PREDICTION MARKETS (Polymarket):
${polymarketSummary}

Return JSON with exactly this structure — replace ALL placeholder text with genuine analysis from the data above:
{
  "marketSummary": "2-3 sentences on what the collective commodity and metals signals are saying right now about Iran conflict risk pricing",
  "conflictAlignment": "2-3 sentences on whether markets are correctly pricing the Polymarket conflict odds, and any notable divergence or alignment",
  "riskAssessment": "2-3 sentences on the current strategic risk level, key escalation drivers, and de-escalation factors to watch",
  "watchpoints": [
    "A specific, actionable 24-48h catalyst tied to Iran conflict or market data above",
    "A second distinct catalyst from a different domain (diplomatic/military/economic)",
    "A third catalyst — a leading indicator or divergence signal to monitor"
  ],
  "riskScore": 65,
  "riskLabel": "ELEVATED"
}

riskLabel must be one of: CRITICAL, ELEVATED, MODERATE, LOW. Be analytical and specific. No generic statements.`;

  const controller = new AbortController();
  const tid        = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:           'llama-3.1-8b-instant',
        max_tokens:      700,
        temperature:     0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role:    'system',
            content: 'You are a senior geopolitical analyst. Respond with valid JSON only. No markdown, no code blocks.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const data  = await res.json();
    const raw   = data?.choices?.[0]?.message?.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(match[0]) as any;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

// ── Algorithmic fallback ───────────────────────────────────────────────────────

function algorithmicBriefing(
  oilSummary: string,
  polymarketSummary: string,
): Omit<BriefingResult, 'generatedAt' | 'generatedBy'> {
  const poly = polymarketSummary.toLowerCase();
  const oilUp = oilSummary.includes('+');

  // Rough risk heuristic from Polymarket text
  const highOdds   = /7[0-9]%|8[0-9]%|9[0-9]%/.test(poly);
  const medOdds    = /5[0-9]%|6[0-9]%/.test(poly);
  const riskScore  = highOdds ? 72 : medOdds ? 58 : 44;
  const riskLabel  = riskScore >= 70 ? 'ELEVATED' : riskScore >= 50 ? 'MODERATE' : 'LOW';

  return {
    marketSummary: `${oilUp ? 'Oil and commodities are advancing' : 'Commodity markets are mixed'}, with prices reflecting an embedded Iran conflict risk premium. Safe-haven metals are ${oilUp ? 'tracking commodity gains' : 'holding elevated levels'}, suggesting sustained geopolitical uncertainty is pricing into cross-asset positioning. The collective signal points to markets treating Iran escalation risk as a live, ongoing variable rather than a tail scenario.`,
    conflictAlignment: `Polymarket prediction odds and commodity prices are ${highOdds ? 'strongly aligned, both pricing elevated conflict probability' : 'broadly consistent but showing some divergence worth monitoring'}. ${highOdds ? 'Current oil risk premiums appear justified by the elevated Polymarket conflict odds on US forces entering Iran.' : 'If Polymarket odds rise materially from current levels, oil and metals may have further upside to price in.'} Any rapid divergence between prediction markets and commodity pricing is an early indicator of new intelligence entering the market.`,
    riskAssessment: `Strategic risk in the Iran theater is currently assessed at ${riskLabel} (${riskScore}/100). Key escalation drivers: IRGC naval activity near Hormuz Strait, US Congressional authorization signals, and Israeli strike posture remain the primary binary risk factors. De-escalation pathway requires credible diplomatic back-channel signals — currently absent from prediction market pricing.`,
    watchpoints: [
      'IAEA Iran inspection report — any acceleration in uranium enrichment would sharply reprice Polymarket conflict odds and trigger an oil risk premium spike',
      'IRGC naval patrol activity near the Strait of Hormuz — a tanker interdiction or mine deployment signal would be an immediate oil price catalyst',
      'US Congressional signals on Iran military authorization — Polymarket\'s Dec-31 odds are the leading market indicator to monitor for diplomatic or military escalation',
    ],
    riskScore,
    riskLabel: riskLabel as BriefingResult['riskLabel'],
  };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  if (!rateLimit(`analyst-briefing:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(`analyst-briefing:${ip}`)) } },
    );
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const b = (body ?? {}) as Record<string, unknown>;
  const oilSummary        = String(b.oilSummary        ?? '').slice(0, 800);
  const metalsSummary     = String(b.metalsSummary     ?? '').slice(0, 400);
  const polymarketSummary = String(b.polymarketSummary ?? '').slice(0, 600);

  if (!oilSummary) {
    return NextResponse.json({ error: 'oilSummary is required' }, { status: 400 });
  }

  const fingerprint = `${oilSummary.slice(0, 50)}|${polymarketSummary.slice(0, 50)}`;
  if (_cache && Date.now() - _cache.at < CACHE_TTL && _cache.key === fingerprint) {
    return NextResponse.json({ ..._cache.result, cached: true });
  }

  const groqResult = await callGroq(oilSummary, metalsSummary, polymarketSummary);
  const partial    = groqResult ?? algorithmicBriefing(oilSummary, polymarketSummary);

  const result: BriefingResult = {
    ...partial,
    generatedBy: groqResult ? 'groq-ai' : 'algorithmic',
    generatedAt: new Date().toISOString(),
  };

  _cache = { result, at: Date.now(), key: fingerprint };

  return NextResponse.json(result);
}

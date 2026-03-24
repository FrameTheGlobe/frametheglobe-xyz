/**
 * /api/article-brief  (POST)
 *
 * Accepts { title: string; summary?: string; sourceName?: string; region?: string }
 * Returns a 2-3 sentence "What this means" brief for a single article.
 * Uses llama-3.1-8b-instant for low-latency responses.
 * In-process cache keyed by title hash (30 min TTL).
 */

import { NextResponse } from 'next/server';

export const runtime   = 'nodejs';
export const revalidate = 0;

export type ArticleBriefPayload = {
  brief: string;
  significance: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'MONITOR';
  generatedBy: 'groq-ai' | 'algorithmic';
};

// ── In-process cache ───────────────────────────────────────────────────────

const _cache = new Map<string, { payload: ArticleBriefPayload; at: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ── Groq call ─────────────────────────────────────────────────────────────

async function callGroq(title: string, summary: string, region: string, sourceName: string): Promise<ArticleBriefPayload | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const prompt = `Article: "${title}"
Summary: ${summary || '(none)'}
Source: ${sourceName} | Region: ${region}

In 2-3 sentences: What does this mean strategically? Who is affected? What should analysts watch for next?
Also rate significance: CRITICAL / HIGH / ELEVATED / MONITOR

Respond in this exact JSON format:
{"brief": "2-3 sentence strategic analysis here.", "significance": "HIGH"}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 200,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a senior intelligence analyst. Respond with valid JSON only. Brief must be 2-3 sentences, direct, strategic.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const raw  = data?.choices?.[0]?.message?.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const sig = ['CRITICAL','HIGH','ELEVATED','MONITOR'].includes(parsed.significance)
      ? parsed.significance as ArticleBriefPayload['significance']
      : 'MONITOR';
    return { brief: parsed.brief ?? '', significance: sig, generatedBy: 'groq-ai' };
  } catch {
    return null;
  }
}

// ── Algorithmic fallback ───────────────────────────────────────────────────

const CRIT_KW = ['nuclear','warhead','strike','invasion','mass','casualties','imminent'];
const HIGH_KW = ['missile','airstrike','attack','killed','bomb','offensive','escalat'];
const ELEV_KW = ['tensions','military','sanctions','threat','conflict','deploy','intercept'];

function algorithmicBrief(title: string, summary: string, region: string): ArticleBriefPayload {
  const text = `${title} ${summary}`.toLowerCase();
  const significance: ArticleBriefPayload['significance'] =
    CRIT_KW.some(k => text.includes(k)) ? 'CRITICAL' :
    HIGH_KW.some(k => text.includes(k)) ? 'HIGH' :
    ELEV_KW.some(k => text.includes(k)) ? 'ELEVATED' : 'MONITOR';

  const regionLabel = region === 'levant' ? 'Levant theater' :
    region === 'iranian' ? 'Iran/Persian Gulf theater' :
    region === 'gulf' ? 'Gulf/MENA region' : 'the region';

  return {
    brief: `This development in ${regionLabel} warrants monitoring for downstream effects on regional stability. `
      + `The story touches on ${significance === 'CRITICAL' || significance === 'HIGH' ? 'active conflict or escalation dynamics' : 'political or security developments'} `
      + `that may influence energy markets and allied force postures. Add GROQ_API_KEY for AI-powered analysis.`,
    significance,
    generatedBy: 'algorithmic',
  };
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body       = await request.json();
    const title:      string = body?.title ?? '';
    const summary:    string = body?.summary ?? '';
    const sourceName: string = body?.sourceName ?? 'Unknown';
    const region:     string = body?.region ?? 'global';

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const cacheKey = title.slice(0, 60);
    const cached = _cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      return NextResponse.json({ ...cached.payload, cached: true });
    }

    const aiResult = await callGroq(title, summary, region, sourceName);
    const payload: ArticleBriefPayload = aiResult ?? algorithmicBrief(title, summary, region);

    _cache.set(cacheKey, { payload, at: Date.now() });

    const res = NextResponse.json(payload);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[FTG article-brief]', err);
    return NextResponse.json({ error: 'Brief generation failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Send a POST request' }, { status: 405 });
}

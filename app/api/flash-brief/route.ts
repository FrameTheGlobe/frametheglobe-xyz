/**
 * /api/flash-brief  (POST)
 *
 * Accepts { items: MinItem[] } — the client's current feed.
 * Returns a CIA-style morning brief: punchy, scannable, 5-8 sentences.
 * Cached server-side for 60 minutes keyed by top-10 headline fingerprint.
 * Falls back to an algorithmic brief when GROQ_API_KEY is absent.
 */

import { NextResponse } from 'next/server';

export const runtime   = 'nodejs';
export const revalidate = 0;

type MinItem = {
  title: string;
  summary?: string;
  sourceName?: string;
  region?: string;
  pubDate?: string;
  relevanceScore?: number;
};

export type FlashBriefPayload = {
  brief: string;
  generatedAt: string;
  generatedBy: 'groq-ai' | 'algorithmic';
  storiesAnalysed: number;
  topThemes: string[];
};

// ── In-process cache ───────────────────────────────────────────────────────

type CacheEntry = { payload: FlashBriefPayload; at: number; fingerprint: string };
let _cache: CacheEntry | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 60 minutes

function fingerprint(items: MinItem[]): string {
  return items.slice(0, 10).map(i => i.title.slice(0, 25)).join('|');
}

// ── Groq call ─────────────────────────────────────────────────────────────

async function callGroq(items: MinItem[]): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const headlines = items.slice(0, 15).map((item, i) =>
    `${i + 1}. [${item.region ?? 'global'}] ${item.sourceName ?? '?'}: ${item.title}`
  ).join('\n');

  const prompt = `You are a senior CIA analyst writing the morning intelligence brief for the Director.

Based on these ${items.length} live headlines, write a punchy, scannable brief of 5-8 sentences maximum. 
Style: direct, confident, no fluff. Think CIA morning brief meets Bloomberg first word.
Cover: the single most important development, key escalation signals, and one thing to watch.
NO bullet points. NO headers. Plain flowing prose only.

LIVE HEADLINES (${new Date().toUTCString()}):
${headlines}

Write the brief now:`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 600,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content: 'You are a senior intelligence analyst. Write clear, direct prose. No markdown, no bullet points, no headers. Plain text only.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

// ── Algorithmic fallback ───────────────────────────────────────────────────

const ESCALATION_KW = ['strike', 'attack', 'missile', 'bomb', 'killed', 'explosion', 'war', 'invasion', 'assault', 'drone', 'rocket', 'airstrike'];
const NUCLEAR_KW    = ['nuclear', 'uranium', 'iaea', 'enrichment', 'jcpoa', 'warhead', 'natanz'];
const MARKET_KW     = ['oil', 'brent', 'wti', 'opec', 'sanctions', 'energy', 'gas'];
const DIPLO_KW      = ['ceasefire', 'talks', 'negotiations', 'deal', 'agreement', 'summit', 'diplomat'];

function algorithmicBrief(items: MinItem[]): FlashBriefPayload {
  const texts = items.map(i => `${i.title} ${i.summary ?? ''}`.toLowerCase());
  const escCount  = texts.filter(t => ESCALATION_KW.some(k => t.includes(k))).length;
  const nucCount  = texts.filter(t => NUCLEAR_KW.some(k => t.includes(k))).length;
  const mktCount  = texts.filter(t => MARKET_KW.some(k => t.includes(k))).length;
  const dipCount  = texts.filter(t => DIPLO_KW.some(k => t.includes(k))).length;

  const sources = new Set(items.map(i => i.sourceName ?? '')).size;
  const topItem = items[0];

  const themes: string[] = [];
  if (escCount > 3) themes.push('Kinetic Escalation');
  if (nucCount > 1) themes.push('Nuclear Dimension');
  if (mktCount > 3) themes.push('Energy Markets');
  if (dipCount > 2) themes.push('Diplomatic Activity');
  if (themes.length === 0) themes.push('Monitoring');

  const brief = `Intelligence cycle running across ${items.length} dispatches from ${sources} sources. `
    + (escCount > 0 ? `${escCount} escalation-tagged reports in the current cycle — active military or security developments require monitoring. ` : '')
    + (nucCount > 0 ? `${nucCount} nuclear/diplomatic signals detected. ` : '')
    + (topItem ? `Lead story: "${topItem.title.slice(0, 90)}${topItem.title.length > 90 ? '…' : ''}". ` : '')
    + (mktCount > 0 ? `Energy market indicators present in ${mktCount} stories — watch for price correlation signals. ` : '')
    + `AI narrative synthesis temporarily unavailable — algorithmic summary active.`;

  return {
    brief,
    generatedAt: new Date().toISOString(),
    generatedBy: 'algorithmic',
    storiesAnalysed: items.length,
    topThemes: themes,
  };
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body  = await request.json();
    const items: MinItem[] = Array.isArray(body?.items) ? body.items : [];
    const forceRefresh = body?.forceRefresh === true;

    if (!items.length) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const fp = fingerprint(items);

    if (!forceRefresh && _cache && Date.now() - _cache.at < CACHE_TTL && _cache.fingerprint === fp) {
      return NextResponse.json({ ..._cache.payload, cached: true });
    }

    const aiText = await callGroq(items);

    const payload: FlashBriefPayload = aiText
      ? {
          brief: aiText,
          generatedAt: new Date().toISOString(),
          generatedBy: 'groq-ai',
          storiesAnalysed: items.length,
          topThemes: [],
        }
      : algorithmicBrief(items);

    _cache = { payload, at: Date.now(), fingerprint: fp };

    const res = NextResponse.json(payload);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[FTG flash-brief]', err);
    return NextResponse.json({ error: 'Brief generation failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Send a POST request with { items: MinItem[] }' }, { status: 405 });
}

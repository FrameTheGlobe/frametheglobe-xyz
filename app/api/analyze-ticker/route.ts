/**
 * /api/analyze-ticker  (POST)
 *
 * On-demand Groq analysis for a single price ticker.
 * Called when an analyst clicks a price cell in the oil/metals/commodities boards.
 * Falls back to a deterministic contextual note when GROQ_API_KEY is absent.
 *
 * Cache: 5 min per {symbol}:{rounded-price} to avoid re-hitting Groq on rapid
 *        repeated clicks at the same price level.
 * Rate-limit: 30 req / 60 s per IP.
 */

import { NextResponse } from 'next/server';
import { rateLimit, retryAfterSeconds } from '@/lib/rate-limit';

export const runtime   = 'nodejs';
export const revalidate = 0;

// ── Types ──────────────────────────────────────────────────────────────────────

export type TickerCategory = 'oil' | 'metals' | 'commodities';

export type TickerClickPayload = {
  symbol:        string;
  name:          string;
  price:         number;
  change:        number;
  changePercent: number;
  currency:      string;
  unit:          string;
  category:      TickerCategory;
};

export type TickerAnalysisResult = {
  analysis: string;
  source:   'groq-ai' | 'algorithmic';
};

// ── In-process cache ───────────────────────────────────────────────────────────

type CacheEntry = TickerAnalysisResult & { at: number };
const _cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

// ── Groq call ─────────────────────────────────────────────────────────────────

async function callGroq(t: TickerClickPayload): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const dir    = t.change >= 0 ? 'up' : 'down';
  const chgStr = `${t.change >= 0 ? '+' : ''}${t.change.toFixed(2)} (${t.changePercent >= 0 ? '+' : ''}${t.changePercent.toFixed(2)}%)`;

  const categoryContext: Record<TickerCategory, string> = {
    oil:         'Strait of Hormuz throughput, IRGC naval posture, Iran sanctions, tanker freight rates, OPEC+ compliance, Red Sea corridor disruption',
    metals:      'safe-haven demand from Iran conflict escalation, JCPOA/nuclear talks signals, US dollar correlation, central bank reserve diversification',
    commodities: 'Persian Gulf supply chains, Iran urea/fertilizer export exposure, Hormuz shipping disruption, food inflation cascade from energy costs',
  };

  const prompt = `You are a senior geopolitical energy and commodities analyst embedded on an Iran conflict intelligence dashboard.

An analyst just clicked on this price ticker:
- Asset: ${t.name} (${t.symbol})
- Category: ${t.category}
- Price: ${t.currency}${t.price.toFixed(2)} ${t.unit}
- Today's move: ${chgStr} | Direction: ${dir}
- Relevant geopolitical lens: ${categoryContext[t.category]}

Write a direct 3-sentence analyst note (max 90 words) covering:
1. What Iran-conflict or regional factor may be driving this move today
2. The key supply/demand dynamic specific to this asset in the current context
3. One precise watchpoint for the next 24-48 hours

No bullet points. No headers. Professional intelligence brief tone. Be specific — cite Hormuz, IRGC, IAEA, OPEC+, Houthis, etc. as relevant.`;

  const controller = new AbortController();
  const tid        = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:       'llama-3.1-8b-instant',
        max_tokens:  160,
        temperature: 0.35,
        messages: [
          {
            role:    'system',
            content: 'You are a senior geopolitical analyst. Write 3 direct sentences. No bullets. No headers. Max 90 words.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content ?? '').trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

// ── Algorithmic fallback ───────────────────────────────────────────────────────

const FALLBACK_NOTES: Record<TickerCategory, string[]> = {
  oil: [
    'Iran conflict risk premium is embedded in current pricing, with Hormuz throughput (19.8M bpd) as the critical binary variable. IRGC naval posture and Red Sea escort requirements are adding structural freight cost pressure. Watch: any Israeli strike signal on Iranian energy infrastructure or IRGC interdiction of tanker traffic.',
    'OPEC+ compliance at ~98.2% leaves minimal spare capacity buffer against any Iran-linked supply disruption. Hormuz closure scenarios are increasingly priced into the forward curve given Polymarket conflict odds. Watch: US Congressional authorization signals on Iran military action and IAEA inspection reports.',
  ],
  metals: [
    'Safe-haven demand tied to Iran conflict escalation probability is supporting this metal above fundamental levels. The IAEA inspection standoff and JCPOA framework uncertainty sustain the geopolitical risk premium. Watch: any US-Iran back-channel diplomatic signal, which would rapidly deflate safe-haven positioning.',
    'Flight-to-safety flows from Middle East escalation risk are a primary near-term driver at this price level. Central bank reserve diversification activity adds a structural demand floor independent of conflict outcomes. Watch: Polymarket conflict probability moves and US State Department Iran negotiation signals.',
  ],
  commodities: [
    'Persian Gulf supply chain exposure is the primary Iran-linked driver. A Hormuz blockage scenario would disrupt Iran\'s ~7.5Mt/yr urea output, adding an estimated $40-80/t to spot prices and cascading into downstream food costs. Watch: Hormuz shipping intelligence and IRGC patrol activity near the Strait.',
    'Red Sea corridor disruptions are extending shipping routes by 10-14 days on key lanes, adding structural cost pressure independent of direct Iran conflict outcomes. Iranian fertilizer export capacity is a key supply swing factor for this commodity. Watch: Bab-el-Mandeb chokepoint status and Houthi maritime activity.',
  ],
};

function algorithmicNote(t: TickerClickPayload): string {
  const dir   = t.change >= 0 ? 'advancing' : 'declining';
  const mag   = Math.abs(t.changePercent) > 2 ? 'sharply' : Math.abs(t.changePercent) > 0.5 ? 'moderately' : 'marginally';
  const notes = FALLBACK_NOTES[t.category];
  const note  = notes[Math.abs(Math.round(t.price)) % notes.length];
  return `${t.name} is ${mag} ${dir} today (${t.change >= 0 ? '+' : ''}${t.changePercent.toFixed(2)}%). ${note}`;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  if (!rateLimit(`analyze-ticker:${ip}`, 30, 60_000)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(`analyze-ticker:${ip}`)) } },
    );
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const b = (body ?? {}) as Record<string, unknown>;

  const ticker: TickerClickPayload = {
    symbol:        String(b.symbol        ?? '').slice(0, 30),
    name:          String(b.name          ?? '').slice(0, 80),
    price:         typeof b.price         === 'number' ? b.price         : 0,
    change:        typeof b.change        === 'number' ? b.change        : 0,
    changePercent: typeof b.changePercent === 'number' ? b.changePercent : 0,
    currency:      String(b.currency      ?? '$').slice(0, 5),
    unit:          String(b.unit          ?? '').slice(0, 30),
    category:      (['oil', 'metals', 'commodities'].includes(String(b.category))
      ? b.category
      : 'commodities') as TickerCategory,
  };

  if (!ticker.symbol || !ticker.name) {
    return NextResponse.json({ error: 'symbol and name are required' }, { status: 400 });
  }

  // Cache key rounded to whole price to avoid thrashing on sub-cent moves
  const cacheKey = `${ticker.symbol}:${Math.round(ticker.price)}`;
  const cached   = _cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json({ analysis: cached.analysis, source: cached.source });
  }

  const groqText = await callGroq(ticker);
  const analysis = groqText ?? algorithmicNote(ticker);
  const source   = groqText ? 'groq-ai' as const : 'algorithmic' as const;

  _cache.set(cacheKey, { analysis, source, at: Date.now() });
  // Prune cache if it grows too large
  if (_cache.size > 300) _cache.delete(_cache.keys().next().value!);

  return NextResponse.json({ analysis, source } satisfies TickerAnalysisResult);
}

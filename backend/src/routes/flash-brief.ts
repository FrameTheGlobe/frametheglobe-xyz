/**
 * POST /api/flash-brief
 * CIA-style morning brief from live headlines.
 * Cache: 60 min keyed by headline fingerprint. Rate-limit: 10/60s per IP.
 */

import { Router, Request, Response } from 'express';
import { rateLimit, retryAfterSeconds } from '../lib/rate-limit.js';

const router = Router();

type MinItem = { title: string; summary?: string; sourceName?: string; region?: string; pubDate?: string; relevanceScore?: number; };
type FlashBriefPayload = { brief: string; generatedAt: string; generatedBy: 'groq-ai' | 'algorithmic'; storiesAnalysed: number; topThemes: string[]; };

type CacheEntry = { payload: FlashBriefPayload; at: number; fingerprint: string };
let _cache: CacheEntry | null = null;
const CACHE_TTL = 60 * 60 * 1000;

function fingerprint(items: MinItem[]): string {
  return items.slice(0, 10).map(i => i.title.slice(0, 25)).join('|');
}

async function callGroq(items: MinItem[]): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const headlines = items.slice(0, 15).map((item, i) => `${i + 1}. [${item.region ?? 'global'}] ${item.sourceName ?? '?'}: ${item.title}`).join('\n');
  const prompt    = `You are a senior CIA analyst writing the morning intelligence brief for the Director.\n\nBased on these ${items.length} live headlines, write a punchy, scannable brief of 5-8 sentences maximum.\nStyle: direct, confident, no fluff. Think CIA morning brief meets Bloomberg first word.\nCover: the single most important development, key escalation signals, and one thing to watch.\nNO bullet points. NO headers. Plain flowing prose only.\n\nLIVE HEADLINES (${new Date().toUTCString()}):\n${headlines}\n\nWrite the brief now:`;
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 600, temperature: 0.4,
        messages: [{ role: 'system', content: 'Senior CIA analyst. 5-8 sentences max. No bullets. Flowing prose.' }, { role: 'user', content: prompt }] }),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch { return null; }
  finally { clearTimeout(timeout); }
}

const ESCALATION_KW = ['strike','attack','missile','bomb','killed','explosion','war','invasion','assault','drone','rocket','airstrike'];
const NUCLEAR_KW    = ['nuclear','uranium','iaea','enrichment','jcpoa','warhead','natanz'];
const MARKET_KW     = ['oil','brent','wti','opec','sanctions','energy','gas'];
const DIPLO_KW      = ['ceasefire','talks','negotiations','deal','agreement','summit','diplomat'];

function algorithmicBrief(items: MinItem[]): FlashBriefPayload {
  const texts     = items.map(i => `${i.title} ${i.summary ?? ''}`.toLowerCase());
  const escCount  = texts.filter(t => ESCALATION_KW.some(k => t.includes(k))).length;
  const nucCount  = texts.filter(t => NUCLEAR_KW.some(k => t.includes(k))).length;
  const mktCount  = texts.filter(t => MARKET_KW.some(k => t.includes(k))).length;
  const dipCount  = texts.filter(t => DIPLO_KW.some(k => t.includes(k))).length;
  const sources   = new Set(items.map(i => i.sourceName ?? '')).size;
  const topItem   = items[0];
  const themes: string[] = [];
  if (escCount > 3) themes.push('Kinetic Escalation');
  if (nucCount > 1) themes.push('Nuclear Dimension');
  if (mktCount > 3) themes.push('Energy Markets');
  if (dipCount > 2) themes.push('Diplomatic Activity');
  if (themes.length === 0) themes.push('Monitoring');
  const brief = `Intelligence cycle running across ${items.length} dispatches from ${sources} sources. `
    + (escCount > 0 ? `${escCount} escalation-tagged reports in the current cycle. ` : '')
    + (nucCount > 0 ? `${nucCount} nuclear/diplomatic signals detected. ` : '')
    + (topItem ? `Lead story: "${topItem.title.slice(0, 90)}${topItem.title.length > 90 ? '…' : ''}". ` : '')
    + (mktCount > 0 ? `Energy market indicators present in ${mktCount} stories. ` : '')
    + 'AI narrative synthesis temporarily unavailable — algorithmic summary active.';
  return { brief, generatedAt: new Date().toISOString(), generatedBy: 'algorithmic', storiesAnalysed: items.length, topThemes: themes };
}

router.post('/', async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`flash-brief:${ip}`, 10, 60_000)) {
    return res.status(429).set('Retry-After', String(retryAfterSeconds(`flash-brief:${ip}`))).json({ error: 'Too many requests' });
  }
  const rawItems     = (req.body ?? {}).items;
  const forceRefresh = (req.body ?? {}).forceRefresh === true;
  if (!Array.isArray(rawItems) || rawItems.length === 0) return res.status(400).json({ error: 'No items provided' });
  const items: MinItem[] = rawItems.slice(0, 50).map((raw: unknown) => {
    const r = (raw ?? {}) as any;
    return { title: String(r.title ?? '').slice(0, 500), summary: String(r.summary ?? '').slice(0, 1000) || undefined,
             sourceName: String(r.sourceName ?? '').slice(0, 100) || undefined,
             region: String(r.region ?? '').slice(0, 50) || undefined };
  }).filter(i => i.title.length > 0);
  const fp = fingerprint(items);
  if (!forceRefresh && _cache && Date.now() - _cache.at < CACHE_TTL && _cache.fingerprint === fp) {
    return res.json({ ..._cache.payload, cached: true });
  }
  const aiText  = await callGroq(items);
  const payload: FlashBriefPayload = aiText
    ? { brief: aiText, generatedAt: new Date().toISOString(), generatedBy: 'groq-ai', storiesAnalysed: items.length, topThemes: [] }
    : algorithmicBrief(items);
  if (payload.generatedBy === 'groq-ai') _cache = { payload, at: Date.now(), fingerprint: fp };
  return res.json(payload);
});

router.get('/', (_req: Request, res: Response) => res.status(405).json({ error: 'Send a POST request with { items }' }));

export default router;

/**
 * POST /api/analyze-ticker
 * On-demand Groq analysis for a single price ticker click.
 * Cache: 5 min per symbol:price. Rate-limit: 30/60s per IP.
 */

import { Router, Request, Response } from 'express';
import { rateLimit, retryAfterSeconds } from '../lib/rate-limit.js';

const router = Router();

type TickerCategory = 'oil' | 'metals' | 'commodities';
type TickerClickPayload = {
  symbol: string; name: string; price: number; change: number;
  changePercent: number; currency: string; unit: string; category: TickerCategory;
};

const _cache = new Map<string, { analysis: string; source: 'groq-ai' | 'algorithmic'; at: number }>();
const CACHE_TTL = 5 * 60 * 1000;

const CATEGORY_CONTEXT: Record<TickerCategory, string> = {
  oil:         'Strait of Hormuz throughput, IRGC naval posture, Iran sanctions, tanker freight rates, OPEC+ compliance, Red Sea corridor disruption',
  metals:      'safe-haven demand from Iran conflict escalation, JCPOA/nuclear talks signals, US dollar correlation, central bank reserve diversification',
  commodities: 'Persian Gulf supply chains, Iran urea/fertilizer export exposure, Hormuz shipping disruption, food inflation cascade from energy costs',
};

const FALLBACK_NOTES: Record<TickerCategory, string[]> = {
  oil: [
    'Iran conflict risk premium is embedded in current pricing, with Hormuz throughput (19.8M bpd) as the critical binary variable. IRGC naval posture and Red Sea escort requirements are adding structural freight cost pressure. Watch: any Israeli strike signal on Iranian energy infrastructure or IRGC interdiction of tanker traffic.',
    'OPEC+ compliance at ~98.2% leaves minimal spare capacity buffer against any Iran-linked supply disruption. Hormuz closure scenarios are increasingly priced into the forward curve. Watch: US Congressional authorization signals and IAEA inspection reports.',
  ],
  metals: [
    'Safe-haven demand tied to Iran conflict escalation probability is supporting this metal above fundamental levels. The IAEA inspection standoff and JCPOA uncertainty sustain the geopolitical risk premium. Watch: any US-Iran back-channel diplomatic signal, which would rapidly deflate safe-haven positioning.',
    'Flight-to-safety flows from Middle East escalation risk are a primary near-term driver. Central bank reserve diversification adds a structural demand floor. Watch: Polymarket conflict probability moves and US State Department Iran negotiation signals.',
  ],
  commodities: [
    'Persian Gulf supply chain exposure is the primary Iran-linked driver. A Hormuz blockage scenario would disrupt Iran\'s ~7.5Mt/yr urea output, adding an estimated $40-80/t to spot prices. Watch: Hormuz shipping intelligence and IRGC patrol activity near the Strait.',
    'Red Sea corridor disruptions are extending shipping routes by 10-14 days on key lanes, adding structural cost pressure. Iranian fertilizer export capacity is a key supply swing factor. Watch: Bab-el-Mandeb chokepoint status and Houthi maritime activity.',
  ],
};

async function callGroq(t: TickerClickPayload): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const chgStr = `${t.change >= 0 ? '+' : ''}${t.change.toFixed(2)} (${t.changePercent >= 0 ? '+' : ''}${t.changePercent.toFixed(2)}%)`;
  const prompt = `You are a senior geopolitical energy and commodities analyst.\n\nAn analyst clicked:\n- Asset: ${t.name} (${t.symbol})\n- Category: ${t.category}\n- Price: ${t.currency}${t.price.toFixed(2)} ${t.unit}\n- Today's move: ${chgStr}\n- Geopolitical lens: ${CATEGORY_CONTEXT[t.category]}\n\nWrite a direct 3-sentence analyst note (max 90 words). Cover: (1) Iran-conflict driver today, (2) key supply/demand dynamic, (3) 24-48h watchpoint. No bullets. No headers. Professional intelligence brief.`;
  const controller = new AbortController();
  const tid        = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 160, temperature: 0.35,
        messages: [{ role: 'system', content: '3 direct sentences, no bullets, max 90 words.' }, { role: 'user', content: prompt }] }),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?.choices?.[0]?.message?.content ?? '').trim() || null;
  } catch { return null; }
  finally { clearTimeout(tid); }
}

router.post('/', async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'anon';
  if (!rateLimit(`analyze-ticker:${ip}`, 30, 60_000)) {
    return res.status(429).set('Retry-After', String(retryAfterSeconds(`analyze-ticker:${ip}`))).json({ error: 'Rate limit exceeded' });
  }
  const b = (req.body ?? {}) as any;
  const ticker: TickerClickPayload = {
    symbol:        String(b.symbol        ?? '').slice(0, 30),
    name:          String(b.name          ?? '').slice(0, 80),
    price:         typeof b.price         === 'number' ? b.price         : 0,
    change:        typeof b.change        === 'number' ? b.change        : 0,
    changePercent: typeof b.changePercent === 'number' ? b.changePercent : 0,
    currency:      String(b.currency      ?? '$').slice(0, 5),
    unit:          String(b.unit          ?? '').slice(0, 30),
    category:      (['oil','metals','commodities'].includes(String(b.category)) ? b.category : 'commodities') as TickerCategory,
  };
  if (!ticker.symbol || !ticker.name) return res.status(400).json({ error: 'symbol and name required' });
  const cacheKey = `${ticker.symbol}:${Math.round(ticker.price)}`;
  const cached   = _cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) return res.json({ analysis: cached.analysis, source: cached.source });
  const groqText = await callGroq(ticker);
  const notes    = FALLBACK_NOTES[ticker.category];
  const fallback = notes[Math.abs(Math.round(ticker.price)) % notes.length];
  const dir      = ticker.change >= 0 ? 'advancing' : 'declining';
  const mag      = Math.abs(ticker.changePercent) > 2 ? 'sharply' : Math.abs(ticker.changePercent) > 0.5 ? 'moderately' : 'marginally';
  const analysis = groqText ?? `${ticker.name} is ${mag} ${dir} today (${ticker.change >= 0 ? '+' : ''}${ticker.changePercent.toFixed(2)}%). ${fallback}`;
  const source   = groqText ? 'groq-ai' as const : 'algorithmic' as const;
  _cache.set(cacheKey, { analysis, source, at: Date.now() });
  if (_cache.size > 300) _cache.delete(_cache.keys().next().value!);
  return res.json({ analysis, source });
});

export default router;

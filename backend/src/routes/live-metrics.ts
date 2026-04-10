import { Router, Request, Response } from 'express';
import { getNewsCache } from '../lib/news-store.js';

const router = Router();

type LiveMetricResult = {
  id: string;
  valueDisplay: string;
  valueQualifier?: string;
  caveat?: string;
};

type CacheEntry = { payload: LiveMetricResult[]; at: number };
let _cache: CacheEntry | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function extractLiveMetrics(items: string[]): Promise<LiveMetricResult[] | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const prompt = `Analyze these ${items.length} recent news headlines for the Israel/Lebanon conflict.
Extract real-time numerical figures for the following metrics:
1. "israel-lebanon-ceasefire-violations": The estimated number of ceasefire violations reported since the Nov 27 agreement.
2. "lebanon-fatalities-since-ceasefire-window": The reported number of fatalities in Lebanon since the ceasefire began.

If the headlines contain exact or updated numbers, use them. If they do not explicitly contain exact numbers, estimate based on mentions or return the most recent known baseline.

Respond with exactly this strict JSON format and nothing else.
[
  {
    "id": "israel-lebanon-ceasefire-violations",
    "valueDisplay": "30+",
    "valueQualifier": "incidents",
    "caveat": "Extracted from recent reporting."
  },
  {
    "id": "lebanon-fatalities-since-ceasefire-window",
    "valueDisplay": "124",
    "valueQualifier": "estimated",
    "caveat": "Extracted from recent reporting."
  }
]

Do not include any markdown fences or preamble. Use purely valid JSON.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 500,
        temperature: 0.2,
        response_format: { type: 'json_object' }, // Note: Groq expects an object if json_object is enabled.
        messages: [
          {
            role: 'system',
            content: 'You are a precise data extractor. Always respond with a valid JSON object holding a "data" array.',
          },
          { role: 'user', content: prompt.replace('[', '{"data": [').replace(']', ']}') },
        ],
      }),
    });

    if (!res.ok) return null;

    const body = await res.json() as any;
    const raw = body?.choices?.[0]?.message?.content ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed.data)) {
      return parsed.data as LiveMetricResult[];
    }
    return null;
  } catch (err) {
    console.error('[FTG live-metrics] Extraction error:', err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

router.get('/', async (_req: Request, res: Response) => {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
    return res
      .set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=300')
      .json({ ok: true, cached: true, metrics: _cache.payload });
  }

  const news = getNewsCache();
  const items = news?.items ?? [];
  const relevantItems = items
    .filter(it => /lebanon|israel|hezbollah|ceasefire|violation|strike|fatalit|killed/i.test(`${it.title} ${it.summary}`))
    .slice(0, 50)
    .map(it => `[${it.sourceName}] ${it.title}`);

  if (relevantItems.length === 0) {
    return res.json({ ok: false, error: 'No relevant news cached yet' });
  }

  const extracted = await extractLiveMetrics(relevantItems);
  if (!extracted) {
    // If Groq fails or no API key, return the previous cache if exists, or fallback array
    if (_cache) {
      return res.json({ ok: true, cached: true, metrics: _cache.payload, error: 'ai_fallback' });
    }
    return res.json({ ok: false, error: 'Extraction failed' });
  }

  _cache = { payload: extracted, at: Date.now() };

  return res
    .set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=300')
    .json({ ok: true, cached: false, metrics: extracted });
});

export default router;

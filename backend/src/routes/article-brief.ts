/**
 * POST /api/article-brief
 * "What this means" 2-3 sentence brief for a single news article.
 * Cache: 30 min by title.
 */

import { Router, Request, Response } from 'express';

const router = Router();

type ArticleBriefPayload = {
  brief: string;
  significance: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'MONITOR';
  generatedBy: 'groq-ai' | 'algorithmic';
};

const _cache = new Map<string, { payload: ArticleBriefPayload; at: number }>();
const CACHE_TTL = 30 * 60 * 1000;

async function callGroq(title: string, summary: string, region: string, sourceName: string): Promise<ArticleBriefPayload | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const prompt = `Article: "${title}"\nSummary: ${summary || '(none)'}\nSource: ${sourceName} | Region: ${region}\n\nIn 2-3 sentences: What does this mean strategically? Who is affected? What should analysts watch for next?\nAlso rate significance: CRITICAL / HIGH / ELEVATED / MONITOR\n\nRespond in this exact JSON format:\n{"brief": "2-3 sentence strategic analysis here.", "significance": "HIGH"}`;
  const controller = new AbortController();
  const tid        = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 200, temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: 'Senior intelligence analyst. JSON only. 2-3 sentences.' }, { role: 'user', content: prompt }] }),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const raw   = data?.choices?.[0]?.message?.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return {
      brief:        String(parsed.brief        ?? '').trim() || null,
      significance: (['CRITICAL','HIGH','ELEVATED','MONITOR'].includes(parsed.significance) ? parsed.significance : 'MONITOR') as ArticleBriefPayload['significance'],
      generatedBy:  'groq-ai',
    } as ArticleBriefPayload;
  } catch { return null; }
  finally { clearTimeout(tid); }
}

function algorithmicBrief(title: string, region: string): ArticleBriefPayload {
  const t   = title.toLowerCase();
  const sig = /attack|strike|missile|nuclear|war|invasion|escalat/.test(t) ? 'HIGH'
            : /sanction|tension|threat|deploy|crisis/.test(t) ? 'ELEVATED'
            : 'MONITOR';
  return {
    brief: `This development in ${region} requires monitoring for downstream geopolitical implications. Analysts should assess the potential for escalation signals and cross-asset market impact. Set GROQ_API_KEY for AI-generated context.`,
    significance: sig as ArticleBriefPayload['significance'],
    generatedBy: 'algorithmic',
  };
}

router.post('/', async (req: Request, res: Response) => {
  const b          = (req.body ?? {}) as any;
  const title      = String(b.title      ?? '').slice(0, 500);
  const summary    = String(b.summary    ?? '').slice(0, 1000);
  const sourceName = String(b.sourceName ?? 'Unknown').slice(0, 100);
  const region     = String(b.region     ?? 'global').slice(0, 50);
  if (!title) return res.status(400).json({ error: 'title is required' });
  const cacheKey = title.slice(0, 100).toLowerCase();
  const cached   = _cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) return res.json({ ...cached.payload, cached: true });
  const groqResult = await callGroq(title, summary, region, sourceName);
  const payload    = groqResult ?? algorithmicBrief(title, region);
  _cache.set(cacheKey, { payload, at: Date.now() });
  if (_cache.size > 500) _cache.delete(_cache.keys().next().value!);
  return res.json(payload);
});

export default router;

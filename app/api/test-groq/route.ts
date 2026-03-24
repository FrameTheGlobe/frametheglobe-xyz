/**
 * GET /api/test-groq
 * Diagnostic — tests the EXACT same Groq call as /api/ai-intel
 * with synthetic headlines. Returns raw response + parse result.
 * Remove after debugging.
 */
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';

const FAKE_HEADLINES = Array.from({ length: 20 }, (_, i) => [
  `${i + 1}. [iran] Reuters: Iran IRGC launches drone exercise near Strait of Hormuz`,
  `${i + 1}. [ukraine] BBC: Ukraine forces repel Russian advance near Kharkiv`,
  `${i + 1}. [global] AP: Oil prices fall amid demand concerns and OPEC output increase`,
  `${i + 1}. [china] CNN: China PLA conducts naval drills near Taiwan Strait`,
][i % 4]).join('\n');

export async function GET() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'GROQ_API_KEY not set' }, { status: 500 });
  }

  const prompt = `Analyse these 20 live geopolitical news headlines and return a JSON intelligence assessment.

LIVE FEED (${new Date().toUTCString()}):
${FAKE_HEADLINES}

Return JSON with exactly this structure (all fields required):
{
  "strategicRisk": { "score": 55, "label": "ELEVATED", "trend": "Rising", "deltaPoints": 3, "primaryDrivers": ["Iran", "China", "Ukraine"], "analystNote": "Two sentences of genuine analysis." },
  "theaters": [
    { "id": "iran",     "name": "Iran Theater",             "level": "ELEV", "summary": "Two sentences.", "airOps": 12, "groundAssets": 45, "navalAssets": 8,  "recentEvents": 6, "trend": "escalating" },
    { "id": "ukraine",  "name": "Eastern European Theater", "level": "HIGH", "summary": "Two sentences.", "airOps": 30, "groundAssets": 80, "navalAssets": 5,  "recentEvents": 12, "trend": "stable" },
    { "id": "taiwan",   "name": "Indo-Pacific Theater",     "level": "NORM", "summary": "Two sentences.", "airOps": 8,  "groundAssets": 20, "navalAssets": 15, "recentEvents": 3, "trend": "stable" },
    { "id": "blacksea", "name": "Black Sea / Caucasus",     "level": "NORM", "summary": "Two sentences.", "airOps": 5,  "groundAssets": 15, "navalAssets": 4,  "recentEvents": 2, "trend": "de-escalating" }
  ],
  "instability": [
    { "country": "Iran",    "flag": "🇮🇷", "score": 78, "unrest": 60, "conflict": 85, "sanctions": 90, "infoWarfare": 70, "delta": 2, "trend": "up" },
    { "country": "Russia",  "flag": "🇷🇺", "score": 72, "unrest": 55, "conflict": 80, "sanctions": 88, "infoWarfare": 75, "delta": 0, "trend": "stable" },
    { "country": "Ukraine", "flag": "🇺🇦", "score": 68, "unrest": 50, "conflict": 82, "sanctions": 40, "infoWarfare": 60, "delta": 1, "trend": "up" },
    { "country": "China",   "flag": "🇨🇳", "score": 55, "unrest": 30, "conflict": 45, "sanctions": 50, "infoWarfare": 80, "delta": 1, "trend": "up" },
    { "country": "Israel",  "flag": "🇮🇱", "score": 65, "unrest": 40, "conflict": 75, "sanctions": 20, "infoWarfare": 55, "delta": 0, "trend": "stable" }
  ],
  "forecasts": [
    { "id": "fc-1", "category": "Conflict",  "title": "Specific forecast.", "probability": 65, "horizon": "7d",  "confidence": "Medium", "basis": "Evidence." },
    { "id": "fc-2", "category": "Market",    "title": "Specific forecast.", "probability": 72, "horizon": "30d", "confidence": "High",   "basis": "Evidence." },
    { "id": "fc-3", "category": "Political", "title": "Specific forecast.", "probability": 48, "horizon": "7d",  "confidence": "Low",    "basis": "Evidence." },
    { "id": "fc-4", "category": "Military",  "title": "Specific forecast.", "probability": 55, "horizon": "24h", "confidence": "Medium", "basis": "Evidence." }
  ],
  "insights": {
    "worldBrief": "Three to four sentences of genuine world situation analysis.",
    "focalPoints": "Three to four sentences on key developments analysts should watch."
  },
  "diplomaticStatus": [
    { "actor": "US-Iran", "status": "STALLED",    "detail": "One sentence.", "color": "#e67e22" },
    { "actor": "Russia-Ukraine", "status": "COLLAPSED", "detail": "One sentence.", "color": "#c0392b" }
  ],
  "economicWarfare": [
    { "label": "Iran Sanctions", "value": "High",   "detail": "One sentence.", "trend": "rising" },
    { "label": "Russia SWIFT",   "value": "Active", "detail": "One sentence.", "trend": "stable" }
  ]
}

Rules: replace ALL placeholder text with real analysis. level must be CRIT/ELEV/HIGH/NORM/UNKN.`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 4000,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a senior strategic intelligence analyst. Always respond with valid JSON only — no markdown, no explanation, no code blocks.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    const data = await res.json();
    const raw     = data?.choices?.[0]?.message?.content ?? '';
    const finish  = data?.choices?.[0]?.finish_reason ?? 'unknown';
    const usage   = data?.usage ?? {};

    let parseOk   = false;
    let parseErr  = '';
    let parsed    = null;

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed  = JSON.parse(jsonMatch[0]);
        parseOk = true;
      } catch (e) {
        parseErr = String(e);
      }
    } else {
      parseErr = 'No JSON object found in response';
    }

    return NextResponse.json({
      ok:          res.ok,
      httpStatus:  res.status,
      finishReason: finish,
      usage,
      rawLength:   raw.length,
      parseOk,
      parseError:  parseErr,
      parsedKeys:  parsed ? Object.keys(parsed) : [],
      groqError:   data?.error ?? null,
      // First 500 chars of raw response for inspection
      rawPreview:  raw.slice(0, 500),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, fetchError: String(err) }, { status: 500 });
  }
}

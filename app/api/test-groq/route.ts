/**
 * GET /api/test-groq
 * Quick diagnostic — verifies GROQ_API_KEY is set and the API responds.
 * Remove this file after debugging is done.
 */
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';

export async function GET() {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'GROQ_API_KEY not set in environment' }, { status: 500 });
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 100,
        messages: [
          { role: 'system', content: 'Respond with valid JSON only.' },
          { role: 'user',   content: 'Return {"status":"ok","message":"Groq is working"}' },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    const data = await res.json();

    return NextResponse.json({
      ok:         res.ok,
      httpStatus: res.status,
      keyPrefix:  apiKey.slice(0, 8) + '...',
      model:      'llama-3.3-70b-versatile',
      rawResponse: data,
      content:    data?.choices?.[0]?.message?.content ?? null,
      error:      data?.error ?? null,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

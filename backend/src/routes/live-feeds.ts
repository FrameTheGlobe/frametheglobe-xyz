/**
 * GET /api/live-feeds
 *
 * Dynamic YouTube feed resolver (no hardcoded video IDs in the frontend).
 *
 * Config is provided via Railway environment variable:
 *   YOUTUBE_LIVE_FEEDS_JSON='[{"id":"aljazeera","name":"Al Jazeera English","channelId":"UC..."},
 *                             {"id":"sky","name":"Sky News","channelId":"UC...","videoId":"YDvsBbKfLPA"}]'
 *
 * If a feed entry includes videoId, it is used as an explicit override.
 * Otherwise the handler resolves the latest videoId via YouTube channel RSS:
 *   https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
 *
 * No paid APIs, no keys, no scraping. RSS is public and stable.
 *
 * IMPORTANT:
 * If YOUTUBE_LIVE_FEEDS_JSON is missing/invalid, we fall back to a curated
 * built-in list so production never renders an empty live-feed widget.
 */

import { Router, Request, Response } from 'express';
import Parser from 'rss-parser';

const router = Router();

type FeedConfig = { id: string; name: string; channelId: string; videoId?: string };
type ResolvedFeed = {
  id: string;
  name: string;
  channelId: string;
  videoId: string | null;
  link: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  embedUrl: string;
  source: 'override' | 'rss' | 'fallback';
};

const parser = new Parser({ timeout: 5000 });

// Built-in fallback feeds. These keep the widget functional even when Railway
// env vars are missing or misconfigured.
const DEFAULT_FEEDS: FeedConfig[] = [
  // Use channel-based live stream embeds by default to avoid stale/private IDs.
  { id: 'aljazeera', name: 'Al Jazeera English', channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg' },
  { id: 'skynews', name: 'Sky News', channelId: 'UCoMdktPbSTixAyNGwb-UYkQ' },
  { id: 'dwnews', name: 'DW News', channelId: 'UCknLrEdhRCp1aegoMqRaCZg' },
  { id: 'france24', name: 'France 24 English', channelId: 'UCEgdi0XIXXZ-qJOFPf4JSKw' },
];

function safeJsonParse<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function extractVideoId(link: string | undefined | null): string | null {
  if (!link) return null;
  // Common format: https://www.youtube.com/watch?v=VIDEOID
  const m = link.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (m?.[1]) return m[1];
  // Short format: https://youtu.be/VIDEOID
  const m2 = link.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (m2?.[1]) return m2[1];
  return null;
}

function thumb(videoId: string | null): string | null {
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function embed(channelId: string, videoId: string | null): string {
  if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;
  return `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channelId)}&autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;
}

async function resolveFromRss(channelId: string): Promise<{ videoId: string | null; link: string | null; publishedAt: string | null }> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return { videoId: null, link: null, publishedAt: null };
    const xml = await res.text();
    const feed = await parser.parseString(xml);
    const first = feed.items?.[0];
    const link = (first?.link as string | undefined) ?? null;
    const publishedAt = (first?.pubDate as string | undefined) ?? (first?.isoDate as string | undefined) ?? null;
    return { videoId: extractVideoId(link), link, publishedAt };
  } catch {
    return { videoId: null, link: null, publishedAt: null };
  } finally {
    clearTimeout(timeout);
  }
}

router.get('/', async (_req: Request, res: Response) => {
  const cfg = safeJsonParse<FeedConfig[]>(process.env.YOUTUBE_LIVE_FEEDS_JSON);
  const envFeeds: FeedConfig[] = Array.isArray(cfg) ? cfg : [];
  const usingFallback = envFeeds.length === 0;
  const feeds: FeedConfig[] = usingFallback ? DEFAULT_FEEDS : envFeeds;

  const resolved: ResolvedFeed[] = await Promise.all(
    feeds.map(async (f) => {
      if (f.videoId) {
        return {
          id: f.id,
          name: f.name,
          channelId: f.channelId,
          videoId: f.videoId,
          link: `https://www.youtube.com/watch?v=${f.videoId}`,
          publishedAt: null,
          thumbnailUrl: thumb(f.videoId),
          embedUrl: embed(f.channelId, f.videoId),
          source: 'override' as const,
        };
      }
      const r = await resolveFromRss(f.channelId);
      const videoId = r.videoId;
      return {
        id: f.id,
        name: f.name,
        channelId: f.channelId,
        videoId,
        link: r.link,
        publishedAt: r.publishedAt,
        thumbnailUrl: thumb(videoId),
        embedUrl: embed(f.channelId, videoId),
        source: videoId ? 'rss' as const : 'fallback' as const,
      };
    })
  );

  return res
    .set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=120')
    .json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      feeds: resolved,
      warning: usingFallback ? 'Using built-in fallback live-feed config (set YOUTUBE_LIVE_FEEDS_JSON to override).' : undefined,
    });
});

export default router;


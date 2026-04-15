/**
 * lib/breaking-filter.ts
 *
 * Breaking news detection for Flash Brief view.
 * Filters items from last 30 minutes with high relevance or breaking keywords.
 */

import type { FeedItem } from '@/lib/fetcher';

const BREAKING_KEYWORDS = /breaking|urgent|alert|flash|critical|developing|just in/i;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const HIGH_RELEVANCE_THRESHOLD = 70;

/**
 * Check if a news item qualifies as breaking
 */
export function isBreakingNews(item: FeedItem): boolean {
  const age = Date.now() - new Date(item.pubDate || Date.now()).getTime();
  const isRecent = age < THIRTY_MINUTES_MS;
  const hasKeywords = BREAKING_KEYWORDS.test(item.title || '');
  const highScore = (item.relevanceScore || 0) > HIGH_RELEVANCE_THRESHOLD;
  
  return isRecent && (hasKeywords || highScore);
}

/**
 * Filter feed items to only breaking news
 */
export function filterBreakingNews(items: FeedItem[]): FeedItem[] {
  return items.filter(isBreakingNews).sort((a, b) => {
    const dateA = new Date(a.pubDate || 0).getTime();
    const dateB = new Date(b.pubDate || 0).getTime();
    return dateB - dateA; // Most recent first
  });
}

/**
 * Filter feed items for a broader "rolling" feed for Flash View (last 12 hours)
 */
export function filterRollingFeed(items: FeedItem[]): FeedItem[] {
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
  const now = Date.now();
  
  return items
    .filter(item => {
      const pubTime = new Date(item.pubDate || now).getTime();
      return (now - pubTime) < TWELVE_HOURS_MS;
    })
    .sort((a, b) => {
      const dateA = new Date(a.pubDate || 0).getTime();
      const dateB = new Date(b.pubDate || 0).getTime();
      return dateB - dateA;
    });
}

/**
 * Format relative time for breaking news
 */
export function getRelativeTime(pubDate: string): string {
  const diff = Date.now() - new Date(pubDate).getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours !== 1 ? 's' : ''} ago`;
  return 'Over 24 hours ago';
}

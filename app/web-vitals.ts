/**
 * app/web-vitals.ts
 *
 * Zero-cost Core Web Vitals reporting.
 *
 * Called automatically by Next.js via the `reportWebVitals` export in
 * app/layout or via _app.tsx in pages router. No external service needed —
 * results appear in the browser DevTools console (Performance tab → Web Vitals)
 * and in Vercel's free build output.
 *
 * To forward metrics to a free self-hosted analytics service (e.g. Umami,
 * Plausible CE, PostHog OSS), uncomment the `sendToAnalytics` block below.
 */

export type WebVitalsMetric = {
  id:    string;
  name:  string;
  label: 'web-vital' | 'custom';
  value: number;
};

export function reportWebVitals(metric: WebVitalsMetric) {
  if (process.env.NODE_ENV === 'development') {
    // Friendly console output during local dev
    const emoji =
      metric.name === 'LCP' ? '🖼' :
      metric.name === 'FID' ? '👆' :
      metric.name === 'CLS' ? '📐' :
      metric.name === 'FCP' ? '🎨' :
      metric.name === 'TTFB' ? '🌐' : '📊';
    console.info(`${emoji} ${metric.name}: ${Math.round(metric.value)}${metric.name === 'CLS' ? '' : 'ms'}`);
  }

  // ── Uncomment to forward to a free self-hosted analytics endpoint ──────────
  // const body = JSON.stringify({ name: metric.name, value: metric.value, id: metric.id });
  // navigator.sendBeacon('/api/vitals', body);   // implement /api/vitals to store/log
}

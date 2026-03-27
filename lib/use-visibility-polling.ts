/**
 * lib/use-visibility-polling.ts
 *
 * Drop-in replacement for a plain setInterval that respects the Page
 * Visibility API: the interval pauses while the tab is hidden, and
 * resumes (triggering an immediate refresh) when the user switches back.
 *
 * Prevents background tabs from burning through API quota and battery.
 */

import { useEffect, useRef } from 'react';

export function useVisibilityPolling(
  callback: () => void,
  intervalMs: number,
): void {
  // Keep a stable ref so we never need to re-create the effect when the
  // callback identity changes across renders.
  const cbRef = useRef(callback);
  useEffect(() => { cbRef.current = callback; }, [callback]);

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      timerId = setInterval(() => cbRef.current(), intervalMs);
    };

    const stop = () => {
      if (timerId !== null) { clearInterval(timerId); timerId = null; }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        cbRef.current(); // immediate refresh on tab focus
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);
}

'use client';

import { useEffect, useRef } from 'react';

/**
 * Run `fn` now and every `ms` while the tab is visible; a hidden tab doesn't ask at all, and coming
 * back asks at once. For the short-interval polls (draft boards) where a tab left open behind others
 * would otherwise hit the server every couple of seconds for nobody.
 */
export function useVisiblePoll(fn: () => unknown, ms: number): void {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  }, [fn]);

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'visible') void latest.current();
    };
    run();
    const id = setInterval(run, ms);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', run);
    };
  }, [ms]);
}

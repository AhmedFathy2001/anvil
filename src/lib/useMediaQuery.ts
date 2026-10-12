'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether a CSS media query matches, kept live as the window changes.
 *
 * The server can't know the viewport, so it renders as "no match" — and so does the browser's first
 * pass (getServerSnapshot), which is what keeps hydration identical. The real answer lands one render
 * later. Use it for what to SHOW, never for what to fetch.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

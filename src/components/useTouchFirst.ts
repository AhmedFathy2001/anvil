'use client';

import { useSyncExternalStore } from 'react';

const COARSE = '(pointer: coarse)';
const subscribeCoarse = (cb: () => void) => {
  const m = window.matchMedia(COARSE);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};

/**
 * True on a touch-first device: a phone, where nobody can install a RuneLite plugin right now.
 * False on the server and on the first paint, then corrected.
 */
export function useTouchFirst(): boolean {
  return useSyncExternalStore(subscribeCoarse, () => window.matchMedia(COARSE).matches, () => false);
}

'use client';

import { useSyncExternalStore } from 'react';

/**
 * Is anybody looking at this page right now?
 *
 * False when the tab is hidden, after IDLE_MS without a pointer, key, scroll or touch, and always
 * for somebody whose system asks for reduced motion. Animated logos and banners (MotionImg) freeze
 * on their current frame while it is false, and the clan hall stops refreshing, so a tab left open
 * on a second monitor all evening costs nothing. Any input brings everything back at once.
 *
 * ONE set of listeners for the whole page however many images subscribe: a clan directory renders
 * dozens of crests, and each adding its own pointermove listener would be the cost this exists to
 * avoid.
 */
const IDLE_MS = 60_000;

let active = true;
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
const subscribers = new Set<() => void>();

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function set(next: boolean) {
  if (reducedMotion()) next = false;
  if (next === active) return;
  active = next;
  subscribers.forEach((fn) => fn());
}

function bump() {
  if (document.visibilityState !== 'visible') return;
  set(true);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => set(false), IDLE_MS);
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const opts = { passive: true, capture: true } as const;
  // pointermove is the busiest; throttle it to one bump per second.
  let lastMove = 0;
  window.addEventListener('pointermove', () => {
    const t = Date.now();
    if (t - lastMove > 1000) {
      lastMove = t;
      bump();
    }
  }, opts);
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart'] as const) window.addEventListener(ev, bump, opts);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') bump();
    else set(false);
  });
  window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => (reducedMotion() ? set(false) : bump()));
  active = !reducedMotion() && document.visibilityState === 'visible';
  if (active) timer = setTimeout(() => set(false), IDLE_MS);
}

function subscribe(fn: () => void) {
  start();
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function usePageActive(): boolean {
  // The server (and the first client render) assume active, so hydration matches; the store then
  // corrects itself on subscribe.
  return useSyncExternalStore(subscribe, () => active, () => true);
}

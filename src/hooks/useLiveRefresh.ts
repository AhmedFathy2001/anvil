'use client';

import { useEffect, useRef } from 'react';

/**
 * Semi-realtime page updates without hammering the server. Polls a tiny "pulse" endpoint that answers
 * with a weak ETag (see lib/httpEtag jsonWithEtag): an unchanged board returns **304 with no body**, so
 * an idle page costs only request headers. Only when the pulse token actually changes do we call
 * `onChange` (typically `router.refresh()` + any client refetch) to pull the real update.
 *
 * Cadence is deliberately gentle:
 *  - fires on tab **focus / becoming visible** (the "I came back to look" moment),
 *  - plus a slow steady tick while the tab is visible AND focused (default 30s) as a backstop,
 *  - never while the tab is hidden or blurred (background tabs poll nothing),
 *  - throttled so rapid focus/blur can't burst (default min 8s between hits).
 *
 * The first poll on mount only SEEDS the current ETag (the page was just server-rendered, so it's
 * already fresh) — it never fires `onChange`, avoiding a spurious immediate refresh.
 */
export function useLiveRefresh(opts: {
  url: string;
  onChange: () => void;
  /** Minimum gap between network hits, ms. Throttles focus bursts. Default 8000. */
  minIntervalMs?: number;
  /** Steady poll while visible + focused, ms. 0 disables (focus-only). Default 30000. */
  intervalMs?: number;
  enabled?: boolean;
}): void {
  const { url, onChange, minIntervalMs = 8000, intervalMs = 30000, enabled = true } = opts;

  // Keep the latest onChange without re-subscribing listeners every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const etagRef = useRef<string | null>(null);
  const lastAtRef = useRef(0);
  const seededRef = useRef(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    let cancelled = false;

    const focused = () =>
      document.visibilityState === 'visible' && (typeof document.hasFocus !== 'function' || document.hasFocus());

    const poll = async (force = false) => {
      if (cancelled || inFlightRef.current) return;
      const now = Date.now();
      if (!force && now - lastAtRef.current < minIntervalMs) return; // throttle bursts
      if (!focused()) return; // never poll a hidden/blurred tab
      lastAtRef.current = now;
      inFlightRef.current = true;
      try {
        const res = await fetch(url, {
          headers: etagRef.current ? { 'If-None-Match': etagRef.current } : {},
          cache: 'no-store',
        });
        if (cancelled) return;
        if (res.status === 304) return; // unchanged — no body, nothing to do
        if (!res.ok) return;
        const tag = res.headers.get('ETag');
        const changed = etagRef.current !== null && tag !== etagRef.current;
        etagRef.current = tag;
        if (!seededRef.current) {
          seededRef.current = true; // first hit only records the baseline; page is already fresh
          return;
        }
        if (changed) onChangeRef.current();
      } catch {
        // Network blip — leave state as-is; the next focus/tick retries.
      } finally {
        inFlightRef.current = false;
      }
    };

    // Seed the baseline ETag once (no refresh).
    void poll(true);

    const onFocus = () => void poll();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    let timer: ReturnType<typeof setInterval> | null = null;
    if (intervalMs > 0) {
      timer = setInterval(() => void poll(), intervalMs);
    }

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer) clearInterval(timer);
    };
  }, [url, enabled, minIntervalMs, intervalMs]);
}

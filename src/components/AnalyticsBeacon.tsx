'use client';

import { useEffect, useRef } from 'react';
import { useParams, usePathname } from 'next/navigation';

import { clanSlugOf, routePattern } from '@/lib/analyticsPattern';

// One page view per navigation, to /api/analytics/collect (first-party; see lib/analytics).
//
// What leaves the browser is the ROUTE PATTERN, worked out here from the params Next resolved — the
// raw URL, with its RSNs and ids, never does. The session id is random and lives in sessionStorage,
// so it ends with the tab and there is no cookie to consent to. A browser asking not to be tracked
// (Do Not Track, Global Privacy Control) sends nothing at all.

const KEY = 'anvil.sid';

function sessionId(): string | null {
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, '');
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null; // storage blocked: no session, no beacon
  }
}

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

export default function AnalyticsBeacon() {
  // The pathname is the trigger; the path itself is read from the address bar, because the proxy
  // rewrites `/c/<slug>/…` onto the bare route and the browser's copy is the one with the clan in it.
  const pathname = usePathname();
  const params = useParams();
  const last = useRef<string | null>(null);

  useEffect(() => {
    try {
      const path = window.location.pathname;
      if (last.current === path || optedOut()) return;
      last.current = path;
      const s = sessionId();
      if (!s) return;
      const body = JSON.stringify({
        p: routePattern(path, params as Record<string, string | string[]>),
        s,
        c: clanSlugOf(path),
      });
      const blob = new Blob([body], { type: 'application/json' });
      if (!navigator.sendBeacon?.('/api/analytics/collect', blob)) {
        void fetch('/api/analytics/collect', { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    } catch {
      // Counting a visit is never worth breaking the page over.
    }
  }, [pathname, params]);

  return null;
}

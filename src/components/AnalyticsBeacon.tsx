'use client';

import { useEffect, useRef } from 'react';
import { useParams, usePathname } from 'next/navigation';

import { clanSlugOf, routePattern } from '@/lib/analyticsPattern';
import { isOptedOut } from '@/lib/analyticsSource';
import { clanFetch } from '@/lib/clanFetch';

// One page view per navigation, and one leave per page, to /api/analytics/collect (first-party; see
// lib/analytics).
//
// What leaves the browser is the ROUTE PATTERN, worked out here from the params Next resolved — the
// raw URL, with its RSNs and ids, never does — plus a viewport CLASS (not a size), the referrer HOST
// and campaign tags on a tab's first view only, and how long a page stayed open. The session id is
// random and lives in sessionStorage, so it ends with the tab and there is no cookie to consent to.
// A browser asking not to be tracked (Do Not Track, Global Privacy Control) sends nothing at all.

const KEY = 'anvil.sid';
const FIRST = 'anvil.ft';
const URL_ = '/api/analytics/collect';

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
  return isOptedOut(navigator as Navigator & { globalPrivacyControl?: boolean });
}

function send(body: object) {
  const json = JSON.stringify(body);
  const blob = new Blob([json], { type: 'application/json' });
  if (!navigator.sendBeacon?.(URL_, blob)) {
    void clanFetch(URL_, { method: 'POST', body: json, keepalive: true }).catch(() => {});
  }
}

/** The registrable part of a host, so a link from our own subdomain is not a "referrer". */
const base = (h: string) => h.split('.').slice(-2).join('.');

/** The first touch of this tab: set once, sent once. Null on every later view. */
function firstTouch(): Record<string, string> | null {
  try {
    if (sessionStorage.getItem(FIRST)) return null;
    sessionStorage.setItem(FIRST, '1');
    const q = new URLSearchParams(location.search);
    let r = '';
    try {
      r = document.referrer ? new URL(document.referrer).hostname : '';
    } catch {
      /* no referrer */
    }
    if (r && base(r) === base(location.hostname)) r = '';
    const t: Record<string, string> = {};
    if (r) t.r = r;
    for (const [k, v] of [['s', 'utm_source'], ['m', 'utm_medium'], ['c', 'utm_campaign'], ['f', 'ref']] as const) {
      const val = q.get(v);
      if (val) t[k] = val.slice(0, 64);
    }
    return t;
  } catch {
    return null;
  }
}

/** Sign-in links carry the tab's session id so the new account can be credited to where the visit began. */
function tagLogin(e: MouseEvent) {
  const a = (e.target as Element | null)?.closest?.('a[href*="/api/auth/discord/start"]') as HTMLAnchorElement | null;
  if (!a || optedOut()) return;
  const s = sessionId();
  if (!s) return;
  const u = new URL(a.href, location.href);
  if (!u.searchParams.has('sid')) {
    u.searchParams.set('sid', s);
    a.href = u.toString();
  }
}

export default function AnalyticsBeacon() {
  // The pathname is the trigger; the path itself is read from the address bar, because the proxy
  // rewrites `/c/<slug>/…` onto the bare route and the browser's copy is the one with the clan in it.
  const pathname = usePathname();
  const params = useParams();
  const last = useRef<string | null>(null);
  // The page currently open, for the leave beacon.
  const open = useRef<{ p: string; c: string | null; at: number } | null>(null);

  const leave = () => {
    const o = open.current;
    open.current = null;
    const s = sessionId();
    if (o && s) send({ p: o.p, s, c: o.c, l: Date.now() - o.at });
  };

  useEffect(() => {
    document.addEventListener('click', tagLogin, true);
    const hide = () => document.visibilityState === 'hidden' && leave();
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', leave);
    return () => {
      document.removeEventListener('click', tagLogin, true);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', leave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const path = window.location.pathname;
      if (last.current === path || optedOut()) return;
      leave();
      last.current = path;
      const s = sessionId();
      if (!s) return;
      const p = routePattern(path, params as Record<string, string | string[]>);
      const c = clanSlugOf(path);
      open.current = { p, c, at: Date.now() };
      const f = firstTouch();
      send({ p, s, c, w: window.innerWidth < 640 ? 'phone' : window.innerWidth < 1024 ? 'tablet' : 'desktop', ...(f ? { f } : {}) });
    } catch {
      // Counting a visit is never worth breaking the page over.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, params]);

  return null;
}

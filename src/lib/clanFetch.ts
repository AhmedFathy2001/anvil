'use client';

import { withClanPrefix } from '@/lib/clanScopedPaths';

/**
 * `fetch`, for an API path that belongs to a clan.
 *
 * A bare `fetch('/api/admin/clan')` from a page at `/c/theafkspot/admin` reaches the apex, where
 * there is no clan — and that request does not fail. The handler runs and answers a different
 * question, or writes somewhere else. That silence is why every clan-scoped call goes through here
 * and why the lint rule is a build gate rather than a review note.
 *
 * THE URL IS THE AUTHORITY. The prefix is read from `window.location`, which cannot disagree with
 * where the browser actually is. No hook, no provider, nothing passed down: a hook would constrain
 * this to component bodies (most of these calls live in event handlers), and a provider would have
 * to be threaded through every tree and would be wrong exactly where someone forgot.
 *
 * Only clan-scoped paths are touched — see lib/clanScopedPaths. `/api/profile` is the person's
 * wherever they are, and prefixing it would 404 a call that works.
 */
export function clanPrefixFromLocation(): string {
  // Guarded for the server pass of a client component. These calls happen in handlers and effects,
  // so this is defensive rather than load-bearing — but a crash during SSR would take the page with
  // it, which is a poor trade for one `typeof`.
  if (typeof window === 'undefined') return '';
  const m = /^\/c\/([a-z0-9-]{2,32})(?=\/|$)/.exec(window.location.pathname);
  return m ? m[0] : '';
}

/** The clan-aware path, without performing the request — for callers that build a URL first. */
export function clanUrl(path: string): string {
  return withClanPrefix(clanPrefixFromLocation(), path);
}

export function clanFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(clanUrl(path), init);
}

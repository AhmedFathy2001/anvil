'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { withClanPrefix } from '@/lib/clanScopedPaths';
import { parseClanPrefix } from '@/lib/clanScopedPaths';
import { useClanPrefixValue } from '@/components/ClanLink';

/**
 * The clan prefix a client component is currently under, read from the URL it is already at.
 *
 * The root layout's ClanPrefixProvider answers when it is there; the browser's own path is the
 * fallback for a tree rendered outside it.
 *
 * '' on the apex and on a clan's own subdomain, where paths are already correct.
 */
export function useClanPrefix(): string {
  const pathname = usePathname() ?? '';
  // The layout's own answer first (ClanPrefixProvider, the one ClanLink uses): it is the same on
  // the server and in the browser. The path alone is not: under a /c/<slug> address the two passes
  // can see it with and without the prefix, which built two different hrefs for one link (a
  // hydration mismatch on the task library's "Export pack").
  const provided = useClanPrefixValue();
  return useMemo(() => {
    return provided || (parseClanPrefix(pathname)?.prefix ?? '');
  }, [provided, pathname]);
}

/**
 * Prefix a path for the current clan.
 *
 *   const href = useClanHref();
 *   <Link href={href('/events/5')}>          ->  /c/theafkspot/events/5
 *   fetch(href('/api/admin/clan'))           ->  /c/theafkspot/api/admin/clan
 *
 * API calls carry the prefix for the same reason pages do: it is what tells the server which clan
 * the request is for. Without it the call reaches the apex, where there is no clan — and an API
 * route with no clan does not error, it answers a different question.
 */
export function useClanHref(): (path: string) => string {
  const prefix = useClanPrefix();
  return useCallback((path: string) => withClanPrefix(prefix, path), [prefix]);
}

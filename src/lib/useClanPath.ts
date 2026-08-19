'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { withClanPrefix } from '@/lib/clanScopedPaths';

/**
 * The clan prefix a client component is currently under, read from the URL it is already at.
 *
 * No context provider and nothing passed down from the server: the browser's own path is the
 * authority, and it cannot disagree with itself. A provider would have to be threaded through every
 * tree and would be wrong exactly when someone forgot.
 *
 * '' on the apex and on a clan's own subdomain, where paths are already correct.
 */
export function useClanPrefix(): string {
  const pathname = usePathname() ?? '';
  return useMemo(() => {
    const m = /^\/c\/([a-z0-9-]{2,32})(?=\/|$)/.exec(pathname);
    return m ? m[0] : '';
  }, [pathname]);
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

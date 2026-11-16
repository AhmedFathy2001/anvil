'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import { useClanPrefixValue } from '@/components/ClanLink';
import { linkCharacterHref, type ContinueKey } from '@/lib/clanScopedPaths';

/**
 * The link to "link a character first" that comes back to the page the person is on (or to `path`).
 *
 * The tenant prefix comes from the server's context, never from the pathname (the rewritten path has
 * lost it). The query string, which can hold an invite, is read after hydration so the server and
 * the first client paint agree; until then the link returns to the page without it.
 */
export function useLinkCharacterHere(): (key: ContinueKey, path?: string) => string {
  const prefix = useClanPrefixValue();
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  useEffect(() => setSearch(window.location.search), [pathname]);
  return (key, path) => linkCharacterHref(prefix, path ?? `${pathname ?? '/'}${search}`, key);
}

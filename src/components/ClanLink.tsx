'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, type ComponentProps } from 'react';

import { withClanPrefix } from '@/lib/clanScopedPaths';

/**
 * The clan prefix for the current page, handed down from the server.
 *
 * WHY NOT usePathname(). Middleware REWRITES `/c/<slug>/admin` to `/admin` before Next routes it, so
 * during server rendering the framework's idea of the path is the rewritten one — the prefix is gone
 * by the time a component could read it. The browser's URL still has it, which is why lib/clanFetch
 * can read window.location, but a link is rendered on the server too and would come out wrong there
 * and then hydrate into something different.
 *
 * So the prefix travels the one way it cannot be lost: middleware puts it in a header, the root
 * layout reads it, and this carries it down. Empty string on the apex and on a clan's own subdomain,
 * where paths are already right.
 */
const ClanPrefixContext = createContext('');

export function ClanPrefixProvider({ prefix, children }: { prefix: string; children: React.ReactNode }) {
  return <ClanPrefixContext.Provider value={prefix}>{children}</ClanPrefixContext.Provider>;
}

export function useClanPrefixValue(): string {
  return useContext(ClanPrefixContext);
}

/**
 * `next/link`, for somewhere inside a clan.
 *
 * Named rather than aliased over `Link` on purpose: a reader seeing `<ClanLink href="/admin/clan">`
 * knows the address is relative to a clan, where the same JSX with a plain `Link` would look
 * finished and be wrong. It only rewrites paths a clan actually owns — `/profile` and `/clans` pass
 * through, because they are the same URL from inside a clan or outside it.
 */
export default function ClanLink({ href, ...rest }: ComponentProps<typeof Link>) {
  const prefix = useClanPrefixValue();
  const resolved = typeof href === 'string' ? withClanPrefix(prefix, href) : href;
  return <Link href={resolved} {...rest} />;
}

/** The same prefixing, for a handler that needs a URL rather than a link — `router.push`, mostly. */
export function useClanUrl(): (path: string) => string {
  const prefix = useClanPrefixValue();
  return (path: string) => withClanPrefix(prefix, path);
}

/**
 * The current path with the clan prefix removed, for comparing against a plain route.
 *
 * Nav components store their targets as bare paths (`/admin/dashboard`) and highlight by comparing
 * to the current one. Under a prefix that comparison never matches — the browser is at
 * `/c/theafkspot/admin/dashboard` — so every item silently stops looking active. Not a crash, just a
 * nav that quietly forgets where you are.
 *
 * Stripping is the right direction rather than prefixing the targets: `usePathname` reports the
 * rewritten path during SSR and the real one on the client, and taking the prefix off whichever it
 * gives lands on the same answer both times.
 */
export function useClanRelativePath(): string {
  const pathname = usePathname() ?? '';
  return pathname.replace(/^\/c\/[a-z0-9-]{2,32}(?=\/|$)/, '') || '/';
}

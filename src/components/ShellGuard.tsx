'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Reload when the shell on screen belongs to a different clan than the URL does.
 *
 * THE SHAPE OF THE PROBLEM. Which shell you get — the platform rail or a clan's top nav — is decided
 * in the ROOT layout, from the clan the request resolved to. Next never re-renders a root layout on a
 * client navigation, and it cannot: every clan's pages rewrite to the same routes (`/c/a/events`,
 * `/c/b/events` and `/events` are one route), so there is no segment change for it to react to.
 *
 * ClanLink already forces a document load for the links it can classify, and that covers nearly
 * everything. It cannot cover what does not go through it: a server redirect that lands somewhere
 * else, a router.push written without the helper, the back button. Those arrive with the previous
 * clan's nav still drawn — the apex home wearing a clan's switcher, which is what made the site look
 * like it had lost track of where it was.
 *
 * So this is the backstop rather than the mechanism. It compares the clan the shell was RENDERED for
 * against the clan the address bar is actually showing, and when they disagree the page is already
 * wrong — a reload is the cheapest way to make it right.
 *
 * IT CANNOT LOOP. The reload asks the server for the URL that is already in the address bar, and the
 * server derives the shell from that same URL, so the second render matches by construction. The one
 * case with no `/c/` on either side — a clan's own subdomain, where the prefix is empty and the path
 * carries no slug — compares null to null and does nothing.
 */
function clanOf(path: string): string | null {
  return /^\/c\/([a-z0-9-]{2,32})(?=\/|$)/.exec(path)?.[1] ?? null;
}

export default function ShellGuard({ prefix }: { prefix: string }) {
  // Only as a trigger: usePathname is the REWRITTEN path during server rendering (middleware strips
  // the prefix before Next routes), so the comparison itself reads the browser's own URL, which
  // keeps it. This runs in an effect, where there is always a window.
  const pathname = usePathname();

  useEffect(() => {
    if (clanOf(window.location.pathname) !== clanOf(prefix)) {
      window.location.reload();
    }
  }, [pathname, prefix]);

  return null;
}

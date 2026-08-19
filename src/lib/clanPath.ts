// Building links and API calls inside a clan.
//
// A clan's pages live at `/c/<slug>/…`, so a bare `/events/5` in a link or a fetch is wrong: on the
// apex it either 404s or — worse for an API call — reaches a route with no clan at all, which is a
// request that quietly does the wrong thing rather than failing.
//
// THE PREFIX COMES FROM THE REQUEST, never from the clan. A request on the old per-clan subdomain
// has a clan but no prefix, and prefixing its links would send people somewhere they are not. That
// is also what makes the two addressing schemes able to coexist while the subdomain is being retired.
//
// Server components use `clanHref`. Client components use `useClanHref` from lib/useClanPath, which
// reads the prefix out of the URL it is already at.

import { clanPrefix } from '@/lib/clanContext';

/**
 * A path inside the current clan.
 *
 *   await clanHref('/events/5')   ->  /c/theafkspot/events/5   (path-addressed)
 *                                 ->  /events/5                (on a clan subdomain)
 *
 * Absolute URLs and anchors pass through untouched — a link to another clan, or to Discord, is not
 * this clan's to rewrite.
 */
export async function clanHref(path: string): Promise<string> {
  if (!path.startsWith('/')) return path;
  const prefix = await clanPrefix();
  return prefix ? `${prefix}${path}` : path;
}

/**
 * The prefixing function itself, for a caller that builds many links and does not want to await
 * each one.
 *
 *   const href = await clanHrefs();
 *   <Link href={href('/events')}>…
 */
export async function clanHrefs(): Promise<(path: string) => string> {
  const prefix = await clanPrefix();
  return (path: string) => (path.startsWith('/') && prefix ? `${prefix}${path}` : path);
}

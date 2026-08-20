// Which paths belong to a clan, and which belong to the platform.
//
// This is the one list both the link helpers and the lint rule read, and it exists so that ~470
// call sites do not each have to get the answer right. `clanHref('/events/5')` prefixes;
// `clanHref('/profile')` does not; the caller does not need to know which, and cannot get it wrong
// by knowing wrong.
//
// THE SPLIT, which is the WOM shape: a clan owns its roster, its events and its administration. A
// person owns their profile and their identity, and those follow them between clans rather than
// existing once per clan — a human with seats in two clans having two profile URLs is exactly what
// the identity remodel was for.

/** Path roots that live UNDER /c/<slug>. Everything a clan owns. */
export const CLAN_SCOPED_ROOTS = [
  '/events',
  '/members',
  '/admin',
  '/weekly',
  '/team',
  '/captain',
  '/player',
  '/feedback',
] as const;

/**
 * API roots that belong to a clan.
 *
 * Listed separately because the split does not follow the page one: `/api/profile` serves the
 * person even though `/profile` is their page, while `/api/plugin` is clan-scoped even though no
 * page corresponds to it.
 */
export const CLAN_SCOPED_API_ROOTS = [
  '/api/admin',
  '/api/events',
  '/api/team',
  '/api/plugin',
  '/api/captain',
  '/api/weekly',
  '/api/feedback',
  '/api/upload',
  '/api/hiscores',
  '/api/items',
] as const;

/** Roots that are the platform's, and must never be prefixed. */
export const PLATFORM_ROOTS = [
  '/clans',
  '/leaderboard',
  '/c/',
  '/u/',
  '/p/',
  '/e/',
  '/profile',
  '/staff',
  '/login',
  '/logout',
  '/guide',
  '/link-device',
  '/api/profile',
  '/api/staff',
  '/api/clans',
  '/api/auth',
  '/api/player',
  '/api/cron',
  '/api/webhooks',
  '/api/tls-check',
  '/api/version',
] as const;

/**
 * Does this path belong to the PLATFORM — the apex, no clan involved?
 *
 * Asked separately from `isClanScopedPath` because the two are not opposites. A path can be neither:
 * an unrecognised one is deliberately left alone rather than guessed at. Only a positive answer here
 * means "a clan prefix is meaningless on this path", which is a strong enough claim to redirect on.
 */
export function isPlatformPath(path: string): boolean {
  if (!path.startsWith('/')) return false;
  for (const root of PLATFORM_ROOTS) {
    // The namespaces are written with a trailing slash to read as namespaces; compare bare so that
    // `/c` itself matches too, and so `/clans` is not swallowed by `/c`.
    const bare = root.endsWith('/') ? root.slice(0, -1) : root;
    if (path === bare || path.startsWith(`${bare}/`) || path.startsWith(`${bare}?`)) return true;
  }
  return false;
}

/**
 * Does this path belong to a clan, and therefore take the prefix?
 *
 * Platform roots are checked FIRST because several are prefixes of clan ones — `/api/profile` would
 * otherwise match nothing and fall through, and `/api/player` sits under no clan despite the name.
 */
export function isClanScopedPath(path: string): boolean {
  if (!path.startsWith('/')) return false;
  if (isPlatformPath(path)) return false;
  for (const root of [...CLAN_SCOPED_API_ROOTS, ...CLAN_SCOPED_ROOTS]) {
    if (path === root || path.startsWith(`${root}/`) || path.startsWith(`${root}?`)) return true;
  }
  // The clan's own home. Anything else unrecognised is left alone rather than guessed at: a wrong
  // prefix is a 404, and an unprefixed platform path still works.
  return false;
}

/** Apply the prefix if — and only if — the path is one a clan owns. */
export function withClanPrefix(prefix: string, path: string): string {
  if (!prefix || !isClanScopedPath(path)) return path;
  return `${prefix}${path}`;
}

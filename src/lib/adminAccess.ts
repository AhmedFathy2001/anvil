// Which admin pages a grant may reach, and where to send someone who is somewhere else.
//
// THIS USED TO LIVE IN MIDDLEWARE, decided from the role baked into the session cookie. That worked
// while one clan owned the deployment. It cannot work now: a cookie minted on one clan's host would
// carry `role: admin` and route its holder around every other clan's admin pages, and middleware
// runs at the edge with no database to check against.
//
// So the rules move here, where the caller has already resolved the grant for the clan being looked
// at. Middleware keeps only what it can honestly do — is this session signed, and is it fresh.
//
// Pure functions, no imports: the point is that the routing table is one thing in one place that can
// be read and tested, rather than ninety lines of nested conditionals nobody wants to touch.

import { atLeast, rankOf } from '@/lib/clanRoles';

/** Authoring surfaces: a board's Tiles tab and the shared task library. */
function isAuthoringPath(pathname: string): boolean {
  if (pathname.startsWith('/admin/tile-library')) return true;
  // Creating an event is administration, not authoring, so it stays out.
  return pathname.startsWith('/admin/events') && pathname !== '/admin/events/new';
}

/** The Tiles tab of a specific board, and nothing else under that board. */
function eventSubPage(pathname: string): { id: string; sub: string } | null {
  const m = pathname.match(/^\/admin\/events\/(\d+)(\/.*)?$/);
  return m ? { id: m[1], sub: m[2] ?? '' } : null;
}

function isTilesTab(sub: string): boolean {
  return sub === '/tiles' || sub.startsWith('/tiles/');
}

/** What the holder of this grant sees when they open /admin with nowhere particular to go. */
export function adminLanding(access: AdminAccess): string {
  if (atLeast(access.role, 'moderator')) return '/admin/dashboard';
  return '/admin/events';
}

export interface AdminAccess {
  role: string;
  canEditTiles: boolean;
  editorScope: string;
}

/** Surfaces a moderator-tier grant reaches. Admins reach everything, so this is not consulted. */
const MODERATOR_PATHS = [
  '/admin/dashboard',
  '/admin/weekly',
  '/admin/people',
  // The clan hub, for History — the one tab there that is not an admin decision. The pages that ARE
  // (Profile, Access) each check for themselves and bounce a moderator to /admin/people.
  '/admin/clan',
  '/admin/schedule',
  '/admin/verifications',
  '/admin/fees',
  '/admin/tile-library',
];

/**
 * Null when the path is allowed; otherwise where to send them instead.
 *
 * Authoring is a CAPABILITY rather than a tier, which is what lets a moderator build boards without
 * being promoted, and a plain member author on granted boards without reaching any moderator
 * surface. Both cases are expressed by combining the two axes rather than by inventing a role.
 */
export function redirectFor(pathname: string, access: AdminAccess | null): string | null {
  // No grant in this clan means no admin area in this clan, whatever they hold elsewhere.
  if (!access) return '/';

  const authoring = access.canEditTiles;
  const scoped = authoring && access.editorScope === 'assigned';

  // Admin and owner: everything.
  if (atLeast(access.role, 'admin')) return null;

  // Nothing at all: not staff, and no authoring capability either.
  if (rankOf(access.role) < rankOf('moderator') && !authoring) return '/';

  // A plain member with authoring, or a board-scoped grant: the authoring surfaces only.
  if (rankOf(access.role) < rankOf('moderator') || scoped) {
    if (!isAuthoringPath(pathname)) return '/admin/events';
    const page = eventSubPage(pathname);
    // Inside a board they may author but not run it.
    if (page && !isTilesTab(page.sub)) return `/admin/events/${page.id}/tiles`;
    return null;
  }

  // Moderator tier (moderator, treasurer): the moderator surfaces, plus authoring if granted.
  const permitted = MODERATOR_PATHS.some((p) => pathname.startsWith(p)) || (authoring && isAuthoringPath(pathname));
  if (!permitted) return '/admin/dashboard';

  // They may open a board to author on, but the rest of it is administration.
  if (authoring) {
    const page = eventSubPage(pathname);
    if (page && !isTilesTab(page.sub)) return `/admin/events/${page.id}/tiles`;
  } else if (pathname.startsWith('/admin/events')) {
    // No authoring capability: the events section is administration and is not theirs.
    return '/admin/dashboard';
  }

  return null;
}

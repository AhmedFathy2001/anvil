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

/** A board's money tabs — the two a board treasurer is given (EventTabNav `moneyOnly`). */
function isMoneyTab(sub: string): boolean {
  return ['/signups', '/payouts'].some((t) => sub === t || sub.startsWith(`${t}/`));
}

/** Treasurer of one or more boards only — not of the clan (clan_staff.treasurer_scope 'assigned'). */
function isBoardTreasurer(access: AdminAccess): boolean {
  return access.role === 'treasurer' && access.treasurerScope === 'assigned';
}

/**
 * The clan's money pages. Rank alone does not reach them: treasurer and moderator tie, and collecting
 * money is the treasurer's job (lib/auth verifyFeeCollector, which the pages and their APIs check).
 */
const MONEY_PATHS = ['/admin/fees', '/admin/coffer'];

/** What the holder of this grant sees when they open /admin with nowhere particular to go. */
export function adminLanding(access: AdminAccess): string {
  if (isBoardTreasurer(access)) return '/admin/events';
  if (atLeast(access.role, 'moderator')) return '/admin/dashboard';
  if (!access.canEditTiles && access.canEditGuides) return '/admin/guides';
  return '/admin/events';
}

export interface AdminAccess {
  role: string;
  canEditTiles: boolean;
  editorScope: string;
  /** Guide authoring — like canEditTiles, a capability that can sit on a plain member. */
  canEditGuides?: boolean;
  /** 'assigned' = treasurer of the boards they were named on only, not of the clan. */
  treasurerScope?: string;
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
  // Clan events (a mass, a hangout): scheduling them is the same job as the calendar they sit on.
  '/admin/clan-events',
  '/admin/verifications',
  '/admin/fees',
  // Checking flagged proofs is moderation; this is the cross-board queue for people who can't open events.
  '/admin/proofs',
  // The coffer is the same job as fees — a treasurer's — so it reaches the same tier. MONEY_PATHS
  // below then keeps a plain moderator out of both, as the pages' verifyFeeCollector does.
  '/admin/coffer',
  '/admin/tile-library',
  // Every staff seat may read the clan's guides; the pages and routes check canEditGuides to write.
  '/admin/guides',
  // A co-hosted board's own corner: this clan's sign-ups, its team, the board if the host allows it,
  // and its Discord. The page re-checks the co-host seat; Discord setup is admin-only within it.
  '/admin/cohosted',
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

  // A guide writer below the staff tiers reaches the guides, whatever else they hold.
  const guides = access.canEditGuides === true;
  if (guides && pathname.startsWith('/admin/guides')) return null;

  // Nothing at all: not staff, and no authoring capability either.
  if (rankOf(access.role) < rankOf('moderator') && !authoring) return guides ? '/admin/guides' : '/';

  // A board-only treasurer: their boards' money tabs and the (filtered) events list, nothing else —
  // not the dashboard, the roster or the activity log. Every API behind those refuses them
  // (verifyAdminOrModerator), so the pages must too.
  if (isBoardTreasurer(access)) {
    if (pathname === '/admin/events') return null;
    const page = eventSubPage(pathname);
    if (page && isMoneyTab(page.sub)) return null;
    if (page && authoring && isTilesTab(page.sub)) return null;
    return page ? `/admin/events/${page.id}/signups` : '/admin/events';
  }

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
  // Money is the treasurer's, not the tier's: a moderator is sent home rather than shown a page they
  // cannot act on.
  if (MONEY_PATHS.some((p) => pathname.startsWith(p)) && access.role !== 'treasurer') return '/admin/dashboard';

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

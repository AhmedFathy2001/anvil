import { safeReturnPath } from './safe-redirect.ts';

// Which paths belong to a clan, and which belong to the platform.
//
// This is the one list both the link helpers and the lint rule read, and it exists so that ~470
// call sites do not each have to get the answer right. `clanHref('/events/5')` prefixes;
// `clanHref('/profile')` does not; the caller does not need to know which, and cannot get it wrong
// by knowing wrong.
//
// THE SPLIT: a clan owns its roster, its events and its administration. A
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
  // The clan's pot. Money belongs to a clan the way its roster does — a person with seats in two
  // clans is looking at two different coffers, never one of their own.
  '/coffer',
  // YOUR LOCKER IN THIS CLAN. `/profile` renders two different pages: unprefixed it is you across
  // the platform (clans, characters, sharing), and prefixed it is your standing INSIDE one — team,
  // board progress, trophies, the history of what you have played there. The second is per-clan by
  // nature, exactly as /members is, so a link to it from inside a clan takes the prefix.
  //
  // Both halves already existed in app/profile/page.tsx, which branches on whether a clan is named.
  // Only the address was missing, and without it the branch was unreachable.
  '/profile',
  // In-game guides. Like /profile it renders on the apex too (the Anvil library), and inside a clan
  // it is that clan's guides — so a link from inside one keeps the prefix.
  '/guides',
  // A clan event (a mass, a hangout): the clan's, like its weeklies.
  '/clan-events',
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
  '/api/coffer',
  '/api/clan-events',
] as const;

/** Roots that are the platform's, and must never be prefixed. */
export const PLATFORM_ROOTS = [
  '/clans',
  '/leaderboard',
  // Side-by-side characters and clans. Apex only, like /p/ — a comparison crosses clans by nature, so
  // a link to it from inside one must lose the prefix rather than 404 under it.
  '/compare',
  '/c/',
  // A creator space's address (clanBasePath). Its own namespace, so a space and a clan can share a
  // slug without one shadowing the other.
  '/s/',
  '/u/',
  '/p/',
  '/e/',
  // NOT '/profile'. It was here, and it made the clan locker unreachable: middleware 308s a platform
  // path out of its prefix, so /c/<slug>/profile bounced to the apex and `buildLocker` — career,
  // live boards, trophies, milestones, the whole history of what somebody has played — never
  // rendered in production at all. Seven hundred lines of dead code that nothing reported, because
  // a redirect to a working page is not an error.
  //
  // The page is genuinely BOTH, which is what the prefix is for everywhere else: bare /profile is
  // you across the platform, /c/<slug>/profile is you inside that clan. That does not break "one
  // human, one profile" — the person is still one page; the locker is your standing in one clan,
  // which is per-clan by nature, the way /c/<slug>/members is.
  '/staff',
  '/login',
  '/logout',
  '/guide',
  '/link-device',
  // First run for a PERSON, and it has to be platform: the flow's subject is somebody who has no
  // clan yet, so there is no host that could name one.
  '/welcome',
  '/api/onboarding',
  // Marketing / front door, apex only (each page 404s on a clan host).
  '/about',
  '/features',
  '/pricing',
  '/supporter',
  // Head-to-head challenges (lib/h2h): one person against another, whatever clans they are in.
  '/challenges',
  '/api/challenges',
  // "Host an event": making a creator space (lib/creatorSpaces) is a platform act, like /clans/new.
  '/host',
  '/api/creators',
  // Friends events (lib/friendEvents): a Supporter's invite links and their own list, never a clan's.
  '/f/',
  '/api/friends',
  // Release notes (lib/releases): Anvil's, not a clan's.
  '/changelog',
  // Its plain-words companion, personal to the reader (lib/whatsNew), still the platform's.
  '/whats-new',
  // Invite links (lib/referrals): a person's, never a clan's.
  '/r/',
  '/portal',
  '/legal',
  '/api/profile',
  '/api/staff',
  '/api/clans',
  '/api/auth',
  '/api/player',
  '/api/cron',
  '/api/webhooks',
  '/api/tls-check',
  '/api/version',
  // Page-view beacons: the clan is named in the body (lib/analyticsPattern), never by a prefix.
  '/api/analytics',
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
    if (
      path === bare ||
      path.startsWith(`${bare}/`) ||
      path.startsWith(`${bare}?`) ||
      // A fragment ends a path exactly the way a query does. Only `?` was handled, so a link to a
      // root's own anchor — `/staff#x` — read as an unrecognised path and was left alone.
      path.startsWith(`${bare}#`)
    ) {
      return true;
    }
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
    if (
      path === root ||
      path.startsWith(`${root}/`) ||
      path.startsWith(`${root}?`) ||
      // FIFTH WAY TO LOSE THE PREFIX. A fragment terminates a path just as a query does, and only
      // `?` was allowed for — so `/events#live` matched no root, fell through to "unrecognised,
      // leave it alone", and navigated the reader out of their clan. Deeper paths were unaffected
      // (`/events/12#live` still starts with `/events/`), which is exactly why it stayed hidden.
      path.startsWith(`${root}#`)
    ) {
      return true;
    }
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

/**
 * A path inside a clan named by SLUG rather than by the request.
 *
 * The exception to the rule above, and it needs one: a handful of pages are reached with no clan in
 * the address on purpose, because whoever opens them cannot be expected to know the slug. A team
 * invite is the case — the host mints it, a visiting clan pastes it around, and none of those people
 * are inside the host's prefix when they click. Such a page resolves the clan from what the link
 * NAMES (the invite's event) and then has to send the visitor on somewhere real, which the request's
 * own prefix — empty, on the apex — cannot tell it.
 *
 * Only for that shape. Everything else takes the prefix from the request via `clanHref`, or it
 * quietly links one clan's pages out of another's.
 */
export function clanHrefFor(
  target: string | { slug: string; kind?: string | null } | null | undefined,
  path: string,
): string {
  if (!target) return withClanPrefix('', path);
  return withClanPrefix(typeof target === 'string' ? `/c/${target}` : clanBasePath(target), path);
}

// ── Two namespaces: clans at /c/<slug>, creator spaces at /s/<slug> ─────────────────────────────
//
// Both live in the `clans` table and a slug is unique PER KIND (clans_kind_slug_unique), so the
// address has to say which kind it means — `/c/drenvox` and `/s/drenvox` can be two different
// tenants. Spaces used to sit under /c/ too, which meant a streamer's space squatted the slug a real
// in-game clan of the same name would want.
//
// Old `/c/<space>` links keep working: the resolver falls back to the space when no clan holds that
// slug, and a page request there is redirected to /s/ (app/layout).

/** The kind an address names. Anything that is not a creator space is addressed as a clan. */
export type AddressKind = 'clan' | 'creator';

/** `c` or `s` — the first path segment for a tenant of this kind. */
export function prefixSegment(kind: string | null | undefined): 'c' | 's' {
  return kind === 'creator' ? 's' : 'c';
}

/** The kind an address segment names. */
export function kindOfSegment(segment: string): AddressKind {
  return segment === 's' ? 'creator' : 'clan';
}

/** `/c/<slug>` for a clan, `/s/<slug>` for a creator space. Every link to a tenant goes through here. */
export function clanBasePath(c: { slug: string; kind?: string | null }): string {
  return `/${prefixSegment(c.kind)}/${c.slug}`;
}

/** A tenant's path: `clanPathOf(space, '/events/5')` → `/s/drenvox/events/5`. */
export function clanPathOf(c: { slug: string; kind?: string | null }, path = ''): string {
  return `${clanBasePath(c)}${path === '/' ? '' : path}`;
}

/** Matches either prefix at the start of a path. Group 1 is `c`/`s`, group 2 the slug. */
export const TENANT_PREFIX_RE = /^\/([cs])\/([a-z0-9-]{2,32})(?=\/|\?|#|$)/;

/** The tenant a path is under, or null for an unprefixed one. */
export function parseClanPrefix(path: string): { kind: AddressKind; slug: string; prefix: string } | null {
  const m = TENANT_PREFIX_RE.exec(path);
  return m ? { kind: kindOfSegment(m[1]), slug: m[2], prefix: m[0] } : null;
}

/** The path with its tenant prefix removed (`/s/x/events` → `/events`). */
export function stripClanPrefix(path: string): string {
  return path.replace(TENANT_PREFIX_RE, '') || '/';
}

/**
 * The sign-in link that comes back to `path` afterwards, with the tenant prefix kept.
 *
 * THE one place a `/login?return=` for "the page you are on" is built. `path` is whatever the
 * caller has: under a `/c/<slug>` address the server sees the path with the prefix already taken
 * off (`/members`), the browser sees it with the prefix on; `prefix` is the tenant the request is
 * under ('' on the apex). Either way the return names the clan page, not a platform page of the
 * same name: without the prefix, signing in from a clan's page landed on the apex.
 */
export function loginHref(prefix: string, path: string | null | undefined): string {
  const target = returnTargetOf(prefix, path);
  if (target === '/' || target === '/login' || target.startsWith('/login?')) return '/login';
  return `/login?return=${encodeURIComponent(target)}`;
}

/** The page `path` names, with the tenant prefix kept (shared by `loginHref` and `stepHref`). */
function returnTargetOf(prefix: string, path: string | null | undefined): string {
  const p = path && path.startsWith('/') ? path : '/';
  if (parseClanPrefix(p)) return p;
  if (prefix && (p === '/' || p.startsWith('/?'))) return `${prefix}${p.slice(1)}`;
  return withClanPrefix(prefix, p);
}

// ── "Do this first, then come back": a required step that carries its way home ───────────────────
//
// Signing in already returns (`loginHref`). The other steps a person is sent away to finish, such as
// linking a character, did not: they ended on Settings and had to find their own way back. One
// mechanism for all of them: the link carries `next` (a same-site path, prefix kept) and `for` (a
// SHORT FIXED KEY from the list below, never free text), and the step reads both back through
// `readContinue`, which refuses anything that is not a same-site page.

/**
 * What each origin needs from the step and how to word it. `needs`: `linked` = any character of
 * theirs; `verified` = one they have proved is theirs. `doing` completes "Link a character to ...";
 * `back` completes "Continue: back to ...".
 */
export const CONTINUE_KEYS = {
  'event-signup': { doing: 'continue signing up', back: 'your sign-up', needs: 'verified' },
  event: { doing: 'join the event', back: 'the event', needs: 'verified' },
  'clan-apply': { doing: 'apply to the clan', back: 'the clan page', needs: 'verified' },
  clan: { doing: 'find your place in the clan', back: 'the clan page', needs: 'linked' },
  challenge: { doing: 'start a challenge', back: 'challenges', needs: 'verified' },
  start: { doing: 'finish getting started', back: 'getting started', needs: 'linked' },
} as const;

export type ContinueKey = keyof typeof CONTINUE_KEYS;

export function isContinueKey(v: unknown): v is ContinueKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(CONTINUE_KEYS, v);
}

/** The places a return may never point: the step itself (a loop), sign-in, and anything that is not a page. */
const NEVER_RETURN_TO = /^\/(?:settings\/characters|login|logout|api)(?:[/?#]|$)/;

/**
 * A return target read from a URL, or null. Same-site paths only: one leading slash, no backslash,
 * whitespace or control characters (`safeReturnPath`), plus no encoded slash, backslash or control
 * character (`/%2F`, `/%5C`) that a proxy or an older browser might decode into one, and a length cap.
 */
export function safeContinuePath(raw: string | string[] | null | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const safe = safeReturnPath(value, '');
  if (!safe || safe === '/' || safe.length > 600) return null;
  if (/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(safe)) return null;
  if (NEVER_RETURN_TO.test(safe)) return null;
  return safe;
}

/**
 * A link to a required step that comes back to `path` afterwards: `<step>?next=<path>&for=<key>`,
 * the step's own `#hash` kept at the end. `prefix` and `path` are read exactly as `loginHref` reads
 * them. With a path that cannot be a return target it is the plain step link.
 */
export function stepHref(step: string, prefix: string, path: string | null | undefined, key: ContinueKey): string {
  const hashAt = step.indexOf('#');
  const base = hashAt < 0 ? step : step.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : step.slice(hashAt);
  const target = safeContinuePath(returnTargetOf(prefix, path));
  if (!target || !isContinueKey(key)) return step;
  return `${base}${base.includes('?') ? '&' : '?'}next=${encodeURIComponent(target)}&for=${key}${hash}`;
}

/** The link-a-character step, coming back to `path`. */
export function linkCharacterHref(prefix: string, path: string | null | undefined, key: ContinueKey): string {
  return stepHref('/settings/characters#link-account', prefix, path, key);
}

export interface ContinueTarget {
  next: string;
  key: ContinueKey;
}

/** `next` and `for` read back off a step's query. Null unless BOTH are valid. */
export function readContinue(params: { next?: string | string[] | null; for?: string | string[] | null }): ContinueTarget | null {
  const next = safeContinuePath(params.next);
  const rawKey = Array.isArray(params.for) ? params.for[0] : params.for;
  if (!next || !isContinueKey(rawKey)) return null;
  return { next, key: rawKey };
}

/** The `next`/`for` query to keep on a link that stays on the step (for example "Open the check"). */
export function continueQuery(c: ContinueTarget | null): string {
  return c ? `next=${encodeURIComponent(c.next)}&for=${c.key}` : '';
}

// May a stranger see this clan NAMED on a public surface?
//
// A different question from "may a stranger read this clan's pages" (lib/clanAccess), and it was
// being answered by three different queries that each got it slightly wrong. `/clans`, the platform
// leaderboard and the public player profiles each filtered on their own idea of who belongs, and
// `clans.visibility` appeared in none of them — so a clan set to `members`, which is a clan saying
// somebody with no seat may not read it AT ALL, was still listed by name, member count, weekly
// activity and recruiting status on the apex's most public page.
//
// TWO GATES, AND THEY ARE NOT TWO SWITCHES THAT MUST AGREE. The existing comments in clanLeaderboard
// and apexProfiles are right to be wary of that — a second flag meaning the same thing is how two
// answers drift apart. But these do not mean the same thing, and one implies the other:
//
//   visibility = 'public'    the clan is readable by strangers at all. STRICTLY STRONGER: a clan
//                            that refuses to be read has self-evidently not agreed to be listed.
//   public_showcase != 'off' the clan is readable, and also happy to be advertised. The narrower
//                            opt-out, for a public clan that just wants to stay off the directory.
//
// So listing requires both, and neither can be satisfied by accident: an unrecognised visibility
// string is not 'public', and the showcase default (absent row = listed) only ever applies to a clan
// that already passed the first gate.

import { and, eq, sql, type SQL } from 'drizzle-orm';

import { clans, settings } from '@/db/schema';
import { clanVisibilityOf } from '@/lib/clanVisibility';

/**
 * The opt-out key, defined HERE rather than in lib/pluginConfig, which re-exports it for the callers
 * that already reach for it there. It lives with the rule that reads it so this module can be
 * imported without a database — pluginConfig pulls in `@/db`, and a predicate over two strings
 * should not need a connection pool to be tested. See tests/pure-module-imports.
 */
export const PUBLIC_SHOWCASE_KEY = 'public_showcase';

/**
 * The `leftJoin` a listing query needs to see the showcase opt-out.
 *
 * LEFT, not inner: the absent row IS the default (listed), so an inner join would silently hide
 * every clan that has never touched the setting — which is nearly all of them.
 */
export function showcaseJoinOn(): SQL {
  return and(eq(settings.clanId, clans.id), eq(settings.key, PUBLIC_SHOWCASE_KEY))!;
}

/**
 * The WHERE for "this clan may appear on a public surface, by name".
 *
 * Pair it with `showcaseJoinOn()`. Callers add their own extra conditions — the leaderboard also
 * demands a verified in-game name, because a table is exactly where a claimed name would do damage.
 */
export function listedClanWhere(): SQL {
  return and(
    eq(clans.status, 'active'),
    // Anything that is not exactly 'public' is closed, matching `clanVisibilityOf`. A typo in this
    // column hides a clan; it must never expose one.
    eq(clans.visibility, 'public'),
    // `is distinct from` rather than `<> 'off'`, because a NULL — the absent row — has to read as
    // the default rather than as "unknown, therefore excluded".
    sql`${settings.value} is distinct from 'off'`,
  )!;
}

/**
 * The same rule for a clan row already in hand, where a join would be a second query.
 *
 * `showcase` is the raw setting value: null when there is no row.
 */
export function isClanListed(clan: { status: string; visibility: string | null }, showcase: string | null): boolean {
  return (
    clan.status === 'active' &&
    clanVisibilityOf(clan.visibility) === 'public' &&
    showcase !== 'off'
  );
}

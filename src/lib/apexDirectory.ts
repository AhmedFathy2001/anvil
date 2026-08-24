// The clan directory, shared by the apex home and /clans.
//
// Lifted out of app/page.tsx so both surfaces read it the same way. They existed as one before only
// because there was one of them; a second copy of a counting query is how two pages start
// disagreeing about how many members a clan has.

import { and, count, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans, events as eventsTable, memberDailyStats } from '@/db/schema';
import { apexDomain } from '@/lib/clanContext';
import type { DirectoryClan } from '@/components/ApexDirectory';

/**
 * Every clan a stranger may browse.
 *
 * Counted in SQL rather than per clan in a loop: the per-clan version measured 509ms for a handful,
 * which does not survive a hundred.
 */
export async function directoryClans(): Promise<DirectoryClan[]> {
  // clan-scope: global -- the directory IS the list of every clan.
  const rows = await db
    .select({
      id: clans.id,
      slug: clans.slug,
      name: clans.name,
      customDomain: clans.customDomain,
      verified: clans.ingameNameVerifiedAt,
      guestPolicy: clans.guestPolicy,
      members: count(clanMemberships.id),
    })
    .from(clans)
    .leftJoin(
      clanMemberships,
      and(
        eq(clanMemberships.clanId, clans.id),
        isNull(clanMemberships.leftAt),
        eq(clanMemberships.kind, 'member'),
      ),
    )
    .where(eq(clans.status, 'active'))
    .groupBy(clans.id, clans.slug, clans.name, clans.customDomain, clans.ingameNameVerifiedAt, clans.guestPolicy)
    .orderBy(clans.name);

  const eventCounts = await db
    .select({ clanId: eventsTable.clanId, n: count() })
    .from(eventsTable)
    .groupBy(eventsTable.clanId);
  const eventsByClan = new Map(eventCounts.map((e) => [e.clanId, Number(e.n)]));

  // IS IT ALIVE? The one thing a stranger most wants to know and the directory never said. A clan
  // with 400 members and nobody playing reads identically to a clan of 30 who all do, until you can
  // see how many of them moved this week. One grouped query for every clan, not one per clan.
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const clanIds = rows.map((r) => r.id);
  const activity = clanIds.length
    ? await db
        .select({
          clanId: clanMemberships.clanId,
          actives: sql<number>`count(distinct ${memberDailyStats.accountId})`,
          xp: sql<number>`coalesce(sum(${memberDailyStats.xpGained}), 0)`,
        })
        .from(memberDailyStats)
        .innerJoin(accounts, eq(accounts.id, memberDailyStats.accountId))
        // Joined by ACCOUNT, as every stats read must be — see lib/memberProfile for what came of
        // matching account-keyed rows against a seat id.
        .innerJoin(
          clanMemberships,
          and(eq(clanMemberships.accountId, accounts.id), isNull(clanMemberships.leftAt)),
        )
        .where(and(inArray(clanMemberships.clanId, clanIds), gte(memberDailyStats.day, weekAgo)))
        .groupBy(clanMemberships.clanId)
    : [];
  const activeBy = new Map(activity.map((a) => [a.clanId, { actives: Number(a.actives), xp: Number(a.xp) }]));

  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    host: r.customDomain || `${r.slug}.${apexDomain()}`,
    members: Number(r.members ?? 0),
    events: eventsByClan.get(r.id) ?? 0,
    verified: r.verified != null,
    guestPolicy: r.guestPolicy,
    activeThisWeek: activeBy.get(r.id)?.actives ?? 0,
    xpThisWeek: activeBy.get(r.id)?.xp ?? 0,
  }));
}

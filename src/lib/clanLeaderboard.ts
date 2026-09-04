// Clans measured against each other.
//
// This is the first surface that only makes sense because clans share a platform, and it is built
// entirely from rows that already exist — the daily stat sweep has been writing them per account
// since long before any of this. Nothing new is collected.
//
// WHY IT IS WELL-DEFINED NOW AND WAS NOT BEFORE. "Which clan does this account's XP count for" has
// exactly one answer since an account holds one member seat (S5). Without that rule a player mid-
// transfer would be claimed by two clans and counted twice, and the table would be quietly wrong in
// the direction nobody checks.
//
// GUESTS DO NOT COUNT. A visitor's gains belong to the clan they are a MEMBER of, not the one whose
// event they turned up to. Otherwise hosting a popular open event would inflate your standing with
// other clans' members, which is the opposite of a clan leaderboard.
//
// WHO APPEARS. Verified clans that have not opted out of being listed. Verification is what stops an
// unverified clan claiming a famous name and topping a table under it — the badge is load-bearing
// here rather than decorative.

import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans, memberDailyStats, settings } from '@/db/schema';
import { PUBLIC_SHOWCASE_KEY } from '@/lib/pluginConfig';
import { apexDomain } from '@/lib/clanContext';

export type LeaderboardWindow = '7d' | '30d' | 'all';

export interface ClanStanding {
  clanId: number;
  slug: string;
  name: string;
  host: string;
  /** Members who gained anything in the window — a clan's activity, not its size. */
  actives: number;
  /** Roster size, for context: 20 of 30 playing reads very differently from 20 of 300. */
  members: number;
  xpGained: number;
  ehpGained: number;
  ehbGained: number;
}

function sinceFor(window: LeaderboardWindow): string | null {
  if (window === 'all') return null;
  const days = window === '7d' ? 7 : 30;
  // The day column is a 'YYYY-MM-DD' string, so the cutoff is one too — comparing it as text is
  // correct for that format and avoids a cast on an indexed column.
  return new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
}

/**
 * The table.
 *
 * One query, aggregated in SQL. The per-clan-in-a-loop version of this shape measured 509ms for a
 * handful of clans elsewhere in this codebase, and a leaderboard is precisely the page that grows
 * with the platform.
 */
export async function clanStandings(window: LeaderboardWindow = '7d', limit = 50): Promise<ClanStanding[]> {
  const since = sinceFor(window);

  // clan-scope: global -- comparing clans to each other is the entire purpose; there is no single
  // clan to scope this to.
  const rows = await db
    .select({
      clanId: clans.id,
      slug: clans.slug,
      name: clans.name,
      customDomain: clans.customDomain,
      actives: sql<number>`count(distinct ${memberDailyStats.accountId})`,
      xpGained: sql<number>`coalesce(sum(${memberDailyStats.xpGained}), 0)`,
      ehpMilli: sql<number>`coalesce(sum(${memberDailyStats.ehpMilliGained}), 0)`,
      ehbMilli: sql<number>`coalesce(sum(${memberDailyStats.ehbMilliGained}), 0)`,
    })
    .from(clans)
    // MEMBER seats only, and live ones. A guest's gains are their own clan's.
    .innerJoin(
      clanMemberships,
      and(
        eq(clanMemberships.clanId, clans.id),
        eq(clanMemberships.kind, 'member'),
        isNull(clanMemberships.leftAt),
      ),
    )
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .leftJoin(
      memberDailyStats,
      since
        ? and(eq(memberDailyStats.accountId, accounts.id), gte(memberDailyStats.day, since))
        : eq(memberDailyStats.accountId, accounts.id),
    )
    // Opted out of being listed? Then not here either — the same switch, rather than a second one
    // that would have to agree with it. Absent row means listed, so `is distinct from 'off'`.
    .leftJoin(
      settings,
      and(eq(settings.clanId, clans.id), eq(settings.key, PUBLIC_SHOWCASE_KEY)),
    )
    .where(
      and(
        eq(clans.status, 'active'),
        // Verified only. An unverified clan can claim any name it likes, and a leaderboard is
        // exactly where a claimed name would do damage.
        sql`${clans.ingameNameVerifiedAt} is not null`,
        sql`${settings.value} is distinct from 'off'`,
      ),
    )
    .groupBy(clans.id, clans.slug, clans.name, clans.customDomain)
    .orderBy(desc(sql`coalesce(sum(${memberDailyStats.xpGained}), 0)`))
    .limit(limit);

  // Roster size separately: folding it into the aggregate above would multiply it by the number of
  // daily rows joined per member, which is the classic way to get a plausible wrong number.
  const sizes = await db
    .select({ clanId: clanMemberships.clanId, n: sql<number>`count(*)` })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)))
    .groupBy(clanMemberships.clanId);
  const sizeByClan = new Map(sizes.map((s) => [s.clanId, Number(s.n)]));

  return rows.map((r) => ({
    clanId: r.clanId,
    slug: r.slug,
    name: r.name,
    host: r.customDomain || `${r.slug}.${apexDomain()}`,
    actives: Number(r.actives ?? 0),
    members: sizeByClan.get(r.clanId) ?? 0,
    xpGained: Number(r.xpGained ?? 0),
    // Stored in thousandths to keep the sum in integers; presented as hours.
    ehpGained: Number(r.ehpMilli ?? 0) / 1000,
    ehbGained: Number(r.ehbMilli ?? 0) / 1000,
  }));
}

export interface LeaderboardPlayer {
  rsn: string;
  clanName: string | null;
  clanSlug: string | null;
  xpGained: number;
}

/**
 * The players behind the clans.
 *
 * Only SHARED accounts appear by name. The apex holds no seats, so lib/accountVisibility's rule
 * reduces to sharing here, and a cross-clan table is not a way around a privacy setting: someone who
 * has published nothing contributes to their clan's total without being listed themselves.
 */
export async function topPlayers(window: LeaderboardWindow = '7d', limit = 25): Promise<LeaderboardPlayer[]> {
  const since = sinceFor(window);

  // clan-scope: global -- a cross-clan player table spans clans by definition.
  const rows = await db
    .select({
      rsn: accounts.rsn,
      clanName: clans.name,
      clanSlug: clans.slug,
      xpGained: sql<number>`coalesce(sum(${memberDailyStats.xpGained}), 0)`,
    })
    .from(memberDailyStats)
    .innerJoin(accounts, eq(accounts.id, memberDailyStats.accountId))
    .leftJoin(
      clanMemberships,
      and(
        eq(clanMemberships.accountId, accounts.id),
        eq(clanMemberships.kind, 'member'),
        isNull(clanMemberships.leftAt),
      ),
    )
    .leftJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(
      and(
        eq(accounts.shared, true),
        since ? gte(memberDailyStats.day, since) : sql`true`,
      ),
    )
    .groupBy(accounts.id, accounts.rsn, clans.name, clans.slug)
    .orderBy(desc(sql`coalesce(sum(${memberDailyStats.xpGained}), 0)`))
    .limit(limit);

  return rows.map((r) => ({
    rsn: r.rsn,
    clanName: r.clanName,
    clanSlug: r.clanSlug,
    xpGained: Number(r.xpGained ?? 0),
  }));
}

// ── Where one person stands ──────────────────────────────────────────────────────────────────────

export interface PlayerStanding {
  /** 1-based, among every ranked character on the platform. */
  rank: number;
  /** How many characters are ranked at all — "3rd" means nothing without it. */
  field: number;
  /** The character doing the standing, and what it gained. */
  rsn: string;
  xpGained: number;
  /** XP to the place above, or null at the top. The number that makes a rank a target. */
  gapAhead: number | null;
}

/**
 * This person's best placing on the platform table.
 *
 * A RANK IS ONLY MOTIVATING WITH ITS GAP. "14th" is a fact; "14th, 40K off 13th" is something to go
 * and do, and the second costs one more aggregate than the first.
 *
 * Their BEST character, not a sum: the table ranks characters, so adding a main and an alt together
 * would place a person somewhere no row exists. Somebody who wants their alt counted separately
 * already has it counted separately.
 *
 * Only shared characters rank, which is the same filter `topPlayers` applies — the table has to be
 * readable by whoever is on it. Since drizzle/0080 that is the default rather than the exception,
 * and before it this whole surface was empty: every account on the first real database was unshared,
 * so the platform's own leaderboard had nothing in it at all.
 */
export async function standingFor(
  accountIds: number[],
  window: LeaderboardWindow = '7d',
): Promise<PlayerStanding | null> {
  if (accountIds.length === 0) return null;
  const since = sinceFor(window);

  // clan-scope: global -- the platform table spans clans by definition; that is what makes it the
  // platform's table rather than a clan's.
  const mine = await db
    .select({
      rsn: accounts.rsn,
      gained: sql<number>`coalesce(sum(${memberDailyStats.xpGained}), 0)`,
    })
    .from(memberDailyStats)
    .innerJoin(accounts, eq(accounts.id, memberDailyStats.accountId))
    .where(
      and(
        eq(accounts.shared, true),
        inArray(accounts.id, accountIds),
        since ? gte(memberDailyStats.day, since) : sql`true`,
      ),
    )
    .groupBy(accounts.id, accounts.rsn)
    .orderBy(desc(sql`coalesce(sum(${memberDailyStats.xpGained}), 0)`))
    .limit(1)
    .then((r) => r[0]);

  if (!mine || Number(mine.gained) <= 0) return null;
  const gained = Number(mine.gained);

  // One pass for the three numbers that describe the placing: how many are ahead, how many are
  // ranked at all, and where the next one up sits. Done in SQL because doing it in JS would mean
  // reading every ranked character to answer a question about one.
  const sinceClause = since ? sql`and d.day >= ${since}` : sql``;
  const rows = await db.execute<{ ahead: number; field: number; next_up: number | null }>(sql`
    with totals as (
      select d.account_id, coalesce(sum(d.xp_gained), 0) as gained
        from member_daily_stats d
        join accounts a on a.id = d.account_id
       where a.shared = true ${sinceClause}
       group by d.account_id
    )
    select
      (select count(*) from totals where gained > ${gained})::int as ahead,
      (select count(*) from totals where gained > 0)::int          as field,
      (select min(gained) from totals where gained > ${gained})    as next_up
  `);

  const row = (rows as unknown as { rows?: Record<string, unknown>[] }).rows?.[0] ?? (rows as unknown as Record<string, unknown>[])[0];
  const ahead = Number(row?.ahead ?? 0);
  const field = Number(row?.field ?? 1);
  const nextUp = row?.next_up == null ? null : Number(row.next_up);

  return {
    rank: ahead + 1,
    field,
    rsn: mine.rsn,
    xpGained: gained,
    gapAhead: nextUp == null ? null : Math.max(0, nextUp - gained),
  };
}

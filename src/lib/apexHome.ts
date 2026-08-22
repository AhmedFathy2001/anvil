import { and, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, events, memberDailyStats, weeklyCompetitions } from '@/db/schema';
import { clansOfPerson, type MyClan } from '@/lib/myClans';

export interface ClanCard extends MyClan {
  /** What is running there now — the only thing a person opening this page wants first. */
  live: { kind: 'event' | 'weekly'; id: number; name: string }[];
}

export interface ApexHomeView {
  clans: ClanCard[];
  /** Across every character they play, over seven days. */
  xpThisWeek: number;
  characters: number;
}

/**
 * You, across your clans — the apex home for somebody signed in.
 *
 * A different page from the signed-out landing, on purpose. Signed in, "the platform" is not a pitch
 * and not a directory: it is the three clans you are actually in and which of them wants something
 * from you. Nothing here is about a clan you do not belong to, because that was the thing nobody had
 * a reason to read.
 *
 * Two queries for the live sets rather than one per clan: a person in eight clans should not cost
 * eight round trips, and the shape is the same one lib/apexDirectory learned the hard way.
 */
export async function apexHomeView(
  playerId: number | null | undefined,
  userId: number | null | undefined,
): Promise<ApexHomeView> {
  const clans = await clansOfPerson(playerId, userId);
  if (clans.length === 0) {
    return { clans: [], xpThisWeek: 0, characters: 0 };
  }

  const ids = clans.map((c) => c.id);
  const nowIso = new Date().toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const [liveEvents, liveWeeklies, xpRow, charRows] = await Promise.all([
    db
      .select({ clanId: events.clanId, id: events.id, name: events.name })
      .from(events)
      .where(
        and(
          inArray(events.clanId, ids),
          isNull(events.forceEndedAt),
          sql`${events.startDate} is not null and ${events.startDate} <= ${nowIso}`,
          or(isNull(events.endDate), gt(events.endDate, nowIso)),
        ),
      ),
    db
      .select({ clanId: weeklyCompetitions.clanId, id: weeklyCompetitions.id, name: weeklyCompetitions.title })
      .from(weeklyCompetitions)
      .where(
        and(
          inArray(weeklyCompetitions.clanId, ids),
          eq(weeklyCompetitions.status, 'active'),
        ),
      ),
    playerId == null
      ? Promise.resolve([{ n: 0 }])
      : db
          .select({ n: sql<number>`coalesce(sum(${memberDailyStats.xpGained}), 0)` })
          .from(memberDailyStats)
          .innerJoin(accounts, eq(accounts.id, memberDailyStats.accountId))
          .where(and(eq(accounts.playerId, playerId), sql`${memberDailyStats.day} >= ${weekAgo}`)),
    playerId == null
      ? Promise.resolve([])
      : db.select({ id: accounts.id }).from(accounts).where(eq(accounts.playerId, playerId)),
  ]);

  const byClan = new Map<number, ClanCard['live']>();
  for (const e of liveEvents) {
    const list = byClan.get(e.clanId) ?? [];
    list.push({ kind: 'event', id: e.id, name: e.name });
    byClan.set(e.clanId, list);
  }
  for (const w of liveWeeklies) {
    const list = byClan.get(w.clanId) ?? [];
    list.push({ kind: 'weekly', id: w.id, name: w.name });
    byClan.set(w.clanId, list);
  }

  return {
    clans: clans.map((c) => ({ ...c, live: byClan.get(c.id) ?? [] })),
    xpThisWeek: Number(xpRow[0]?.n ?? 0),
    characters: charRows.length,
  };
}

/** Live seats a clan has, for the "x of y playing" line. Cheap enough to ask per view. */
export async function rosterSize(clanId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.clanId, clanId), isNull(clanMemberships.leftAt), eq(clanMemberships.kind, 'member')));
  return Number(row?.n ?? 0);
}

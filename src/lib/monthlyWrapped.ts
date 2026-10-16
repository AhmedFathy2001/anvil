// Monthly Wrapped: one character's calendar month. The rules are in lib/monthlyWrappedRules; this
// loads their inputs, all keyed by the ACCOUNT, so a player with no clan gets the same card.
//
// Callers settle visibility first (apexCharacter: shared, or the viewer's own).

import { and, desc, eq, gte, inArray, isNotNull, like, lt, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanMemberships, memberClogItems, memberDailyStats, memberMilestones, memberPersonalBests, moments } from '@/db/schema';
import { clogItemNames, clogPageIndex } from '@/lib/clogDataset';
import { clogItemRarity } from '@/lib/clogRarity';
import { monthKeyOf, nextMonthKey, shapeMonthlyWrapped, type MonthlyWrapped } from '@/lib/monthlyWrappedRules';

/**
 * A past month never changes, and a running one changes slowly; a pasted link fetches the card
 * several times over. Ten minutes is plenty fresh for "so far".
 */
const CACHE_MS = 10 * 60_000;
const cache = new Map<string, { at: number; value: Promise<MonthlyWrapped> }>();

export function getMonthlyWrapped(accountId: number, rsn: string, monthKey: string): Promise<MonthlyWrapped> {
  const key = `${accountId}:${monthKey}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = computeMonthlyWrapped(accountId, rsn, monthKey).catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return value;
}

async function computeMonthlyWrapped(accountId: number, rsn: string, monthKey: string): Promise<MonthlyWrapped> {
  // Timestamps here are text in two shapes ('YYYY-MM-DD HH:MM:SS' and ISO), both UTC and both
  // starting 'YYYY-MM', so a prefix match is the month in either.
  const inMonth = `${monthKey}%`;
  const seats = await db
    .select({ id: clanMemberships.id })
    .from(clanMemberships)
    // clan-scope: global -- the subject is one CHARACTER, whose seats span clans; its drops are its own.
    .where(eq(clanMemberships.accountId, accountId));

  const [days, milestones, clog, pbs, momentRows] = await Promise.all([
    db
      .select({
        xpGained: memberDailyStats.xpGained,
        ehpMilliGained: memberDailyStats.ehpMilliGained,
        ehbMilliGained: memberDailyStats.ehbMilliGained,
        deltas: memberDailyStats.deltas,
      })
      .from(memberDailyStats)
      .where(
        and(
          eq(memberDailyStats.accountId, accountId),
          gte(memberDailyStats.day, `${monthKey}-01`),
          lt(memberDailyStats.day, `${nextMonthKey(monthKey)}-01`),
        ),
      ),
    db
      .select({ kind: memberMilestones.kind, metric: memberMilestones.metric, threshold: memberMilestones.threshold })
      .from(memberMilestones)
      .where(and(eq(memberMilestones.accountId, accountId), like(memberMilestones.noticedAt, inMonth))),
    // first_seen_at is when WE first saw the slot. Slots already there at a first sync have none, so a
    // first sync can't pass off a decade of log as one month's work.
    db
      .select({ itemId: memberClogItems.itemId, pageName: memberClogItems.pageName })
      .from(memberClogItems)
      .where(and(eq(memberClogItems.accountId, accountId), isNotNull(memberClogItems.firstSeenAt), like(memberClogItems.firstSeenAt, inMonth))),
    db
      .select({ activity: memberPersonalBests.activity, teamSize: memberPersonalBests.teamSize, centis: memberPersonalBests.centis })
      .from(memberPersonalBests)
      .where(and(eq(memberPersonalBests.accountId, accountId), like(memberPersonalBests.achievedAt, inMonth))),
    seats.length
      ? db
          .select({ kind: moments.kind, itemId: moments.itemId, itemName: moments.itemName, valueGp: moments.valueGp, source: moments.source })
          .from(moments)
          .where(
            and(
              inArray(moments.clanMemberId, seats.map((s) => s.id)),
              inArray(moments.kind, ['pet', 'unique', 'loot']),
              like(moments.occurredAt, inMonth),
            ),
          )
      : Promise.resolve([]),
  ]);

  const names = clogItemNames();
  return shapeMonthlyWrapped({
    rsn,
    monthKey,
    now: new Date(),
    days,
    milestones,
    clog: clog.map((c) => ({ ...c, itemName: names.get(c.itemId) ?? `Item ${c.itemId}` })),
    pbs,
    moments: momentRows,
    rarity: clogItemRarity(),
    petIds: clogPageIndex().get('All Pets') ?? new Set<number>(),
  });
}

/** Months this character has any tracked day in, newest first — the page's month switcher. */
export async function monthsWithData(accountId: number): Promise<string[]> {
  const rows = await db
    .select({ month: sql<string>`substr(${memberDailyStats.day}, 1, 7)`.as('month') })
    .from(memberDailyStats)
    .where(eq(memberDailyStats.accountId, accountId))
    .groupBy(sql`substr(${memberDailyStats.day}, 1, 7)`)
    .orderBy(desc(sql`substr(${memberDailyStats.day}, 1, 7)`));
  return rows.map((r) => r.month).filter((m) => m <= monthKeyOf(new Date()));
}

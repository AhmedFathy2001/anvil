import { and, count, eq, gt, isNull, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans, events, memberDailyStats } from '@/db/schema';

export interface PlatformStats {
  clans: number;
  members: number;
  characters: number;
  eventsRun: number;
  /** Experience earned by tracked accounts in the last 7 days, across every clan. */
  xpThisWeek: number;
  liveEvents: number;
}

/**
 * The platform, in numbers, for the front page.
 *
 * Real counts rather than round marketing figures, because the honest ones are already the argument:
 * a landing page that says "3 clans, 409 members, 90 million experience this week" is more
 * persuasive than one claiming to be the biggest anything, and it stays true without anybody
 * maintaining it.
 *
 * Every figure is a single aggregate over rows that already exist — no new tracking, and nothing
 * here is per-clan, which is the point: these numbers only exist BECAUSE the clans share a platform.
 * Before the port there was nothing an apex could have counted.
 */
export async function platformStats(): Promise<PlatformStats> {
  const nowIso = new Date().toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  // clan-scope: global -- counting the whole platform is the entire purpose of this file.
  const [[clanRow], [memberRow], [charRow], [eventRow], [xpRow], [liveRow]] = await Promise.all([
    db.select({ n: count() }).from(clans).where(eq(clans.status, 'active')),
    db
      .select({ n: count() })
      .from(clanMemberships)
      .where(and(isNull(clanMemberships.leftAt), eq(clanMemberships.kind, 'member'))),
    db.select({ n: count() }).from(accounts),
    db.select({ n: count() }).from(events),
    db
      .select({ n: sql<number>`coalesce(sum(${memberDailyStats.xpGained}), 0)` })
      .from(memberDailyStats)
      .where(sql`${memberDailyStats.day} >= ${weekAgo}`),
    db
      .select({ n: count() })
      .from(events)
      .where(
        and(
          isNull(events.forceEndedAt),
          sql`${events.startDate} is not null and ${events.startDate} <= ${nowIso}`,
          or(isNull(events.endDate), gt(events.endDate, nowIso)),
        ),
      ),
  ]);

  return {
    clans: Number(clanRow?.n ?? 0),
    members: Number(memberRow?.n ?? 0),
    characters: Number(charRow?.n ?? 0),
    eventsRun: Number(eventRow?.n ?? 0),
    xpThisWeek: Number(xpRow?.n ?? 0),
    liveEvents: Number(liveRow?.n ?? 0),
  };
}

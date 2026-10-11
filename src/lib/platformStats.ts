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
export function platformStats(): Promise<PlatformStats> {
  const now = Date.now();
  if (cached && now - cached.at < STATS_TTL_MS) return cached.value;
  const value = loadPlatformStats();
  cached = { at: now, value };
  // A failed load must not be served for the next minute; drop it so the next visitor retries.
  value.catch(() => {
    if (cached?.value === value) cached = null;
  });
  return value;
}

/**
 * How long one set of counts serves every signed-out visitor.
 *
 * The signed-out apex is the page crawlers and link unfurlers hit, and they arrive in bursts: on
 * 2026-10-11 about thirty-five landed in the same second, each wanting six aggregates, and the ten
 * connections in the pool were gone for the ten seconds it takes `pg` to give up waiting. These are
 * platform-wide totals that move by a handful a minute, so sharing one answer (and one in-flight
 * query, which is what stops the burst) costs nothing a reader could notice.
 */
const STATS_TTL_MS = 60_000;
let cached: { at: number; value: Promise<PlatformStats> } | null = null;

async function loadPlatformStats(): Promise<PlatformStats> {
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

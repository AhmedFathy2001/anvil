// Runs lib/dailyHoursRebuild over the days recorded under the old hours model. Once per process,
// from the lifecycle tick; safe to run again (the same inputs give the same numbers).

import { and, desc, eq, gte, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { accountStatSnapshots, memberDailyStats } from '@/db/schema';
import { rebuildDays, type DayMovement } from '@/lib/dailyHoursRebuild';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import { log } from '@/lib/logger';
import type { StatDeltas } from '@/lib/statDeltas';

/** The old model's days that still show anywhere (the 7d column, the week, the 14-day sparkline's edge). */
export const REBUILD_FROM_DAY = '2026-11-03';
/** The day the new model shipped: days after it were recorded right. */
export const REBUILD_TO_DAY = '2026-11-17';
/** After this the old days have aged out of every window, and the job is a no-op. */
const STOP_AFTER_MS = Date.parse('2026-12-20T00:00:00Z');

let ranThisProcess = false;

/** Rewrite the old days' hours. Returns rows changed. */
export async function rebuildOldDailyHours(opts: { force?: boolean; nowMs?: number } = {}): Promise<number> {
  if (ranThisProcess && !opts.force) return 0;
  ranThisProcess = true;
  if ((opts.nowMs ?? Date.now()) > STOP_AFTER_MS) return 0;
  // clan-scope: global -- a one-off repair of every account's own daily rows; nothing here is a clan's.
  const rows = await db
    .select({ id: memberDailyStats.id, accountId: memberDailyStats.accountId, day: memberDailyStats.day, deltas: memberDailyStats.deltas, ehp: memberDailyStats.ehpMilliGained, ehb: memberDailyStats.ehbMilliGained })
    .from(memberDailyStats)
    .where(gte(memberDailyStats.day, REBUILD_FROM_DAY))
    .orderBy(memberDailyStats.accountId, desc(memberDailyStats.day));
  if (!rows.length) return 0;
  const byAccount = new Map<number, typeof rows>();
  for (const r of rows) (byAccount.get(r.accountId) ?? byAccount.set(r.accountId, []).get(r.accountId)!).push(r);

  let changed = 0;
  const ids = [...byAccount.keys()];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    // clan-scope: global -- snapshots by the account ids read above.
    const snaps = await db.select().from(accountStatSnapshots).where(inArray(accountStatSnapshots.accountId, chunk));
    for (const s of snaps) {
      let current: HiscoresSnapshot | null = null;
      try {
        current = s.snapshot ? (JSON.parse(s.snapshot) as HiscoresSnapshot) : null;
      } catch {
        current = null;
      }
      if (!current?.skills) continue;
      const mine = byAccount.get(s.accountId) ?? [];
      const days: DayMovement[] = [];
      for (const r of mine) {
        let deltas: StatDeltas | null = null;
        try {
          deltas = r.deltas ? (JSON.parse(r.deltas) as StatDeltas) : null;
        } catch {
          deltas = null;
        }
        // A day whose movement was not kept cannot be redone, nor can any day before it.
        if (!deltas && (r.ehp > 0 || r.ehb > 0)) break;
        days.push({ day: r.day, deltas });
      }
      const rebuilt = rebuildDays(current, days);
      for (const r of mine) {
        if (r.day > REBUILD_TO_DAY) continue;
        const next = rebuilt.get(r.day);
        if (!next || (next.ehpMilliGained === r.ehp && next.ehbMilliGained === r.ehb)) continue;
        await db.update(memberDailyStats).set(next).where(and(eq(memberDailyStats.id, r.id), eq(memberDailyStats.accountId, s.accountId)));
        changed++;
      }
    }
  }
  if (changed > 0) log.info('daily-hours.rebuilt', { accounts: ids.length, rows: changed });
  return changed;
}

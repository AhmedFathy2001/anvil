// Moving a RUNNING efficiency competition onto today's hours model.
//
// An efficiency competition ranks by hours gained: the current value minus a baseline, both stored
// as numbers (weekly_participants.baseline_value / current_value, in milli-hours). When the model
// changes (lib/efficiency: Slayer's combat XP counted once, skilling bosses out of hours bossed) the
// current value is rewritten by the next sweep under the new model while the baseline still holds
// the old model's bigger number, so every gain would read zero until the player out-played the
// difference. The frozen baseline snapshot is kept (player_snapshots, kind 'baseline'), so the
// baseline can simply be recomputed from it.
//
// Only a baseline that still holds exactly what the OLD model said for that snapshot is touched: one
// an admin corrected by hand, or one already moved, is left alone. That makes this safe to run any
// number of times; the lifecycle tick runs it once per process.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clanMemberships, playerSnapshots, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { rebasedBaseline } from '@/lib/efficiency';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import { log } from '@/lib/logger';

let ranThisProcess = false;

/** Recompute the baselines of every efficiency competition that hasn't finished. Returns rows moved. */
export async function rebaseEfficiencyCompetitions(opts: { force?: boolean } = {}): Promise<number> {
  if (ranThisProcess && !opts.force) return 0;
  ranThisProcess = true;
  // clan-scope: global -- a one-off repair over every clan's running efficiency competitions.
  const comps = await db
    .select({ id: weeklyCompetitions.id, metric: weeklyCompetitions.metric })
    .from(weeklyCompetitions)
    .where(and(eq(weeklyCompetitions.type, 'efficiency'), inArray(weeklyCompetitions.status, ['upcoming', 'active'])));
  let moved = 0;
  for (const comp of comps) {
    const rows = await db
      .select({ id: weeklyParticipants.id, baseline: weeklyParticipants.baselineValue, payload: playerSnapshots.payload })
      .from(weeklyParticipants)
      .innerJoin(clanMemberships, eq(clanMemberships.id, weeklyParticipants.clanMemberId))
      .innerJoin(
        playerSnapshots,
        and(eq(playerSnapshots.accountId, clanMemberships.accountId), eq(playerSnapshots.weeklyCompetitionId, comp.id), eq(playerSnapshots.kind, 'baseline')),
      )
      .where(eq(weeklyParticipants.competitionId, comp.id));
    for (const r of rows) {
      let snapshot: HiscoresSnapshot | null = null;
      try {
        snapshot = JSON.parse(r.payload) as HiscoresSnapshot;
      } catch {
        continue;
      }
      const next = rebasedBaseline(r.baseline, snapshot, comp.metric);
      if (next == null) continue;
      await db.update(weeklyParticipants).set({ baselineValue: next }).where(eq(weeklyParticipants.id, r.id));
      moved++;
    }
  }
  if (moved > 0) log.info('efficiency.rebased', { competitions: comps.length, baselines: moved });
  return moved;
}

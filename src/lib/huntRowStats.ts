// An item hunt's per-row progress stats (v2 "Closest to it"), stored on the entrant's
// weekly_participants row (hunt_baseline / hunt_current).
//
// Filled by the same reads that fill the hunt's one stat: the hiscores sweep (lib/statsSweep), a
// mode's table (lib/weeklyModeScores) and the starting line taken at the start (lib/startingStats).
// Each of those holds a whole snapshot already, so this is one more look at it, never a new fetch.

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { weeklyParticipants } from '@/db/schema';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import { huntRowStatKeys, parseHunt } from '@/lib/itemHunt';
import { huntRowParts, mergeHuntRowStats } from '@/lib/weeklyMetric';

/** Record one read for one entrant of a hunt. Does nothing on anything but a v2 hunt with row stats. */
export async function recordHuntRowStats(
  participantId: number,
  comp: { type: string; hunt?: string | null },
  snapshot: HiscoresSnapshot,
  liveMap: Record<string, number> = {},
): Promise<void> {
  if (comp.type !== 'hunt') return;
  const keys = huntRowStatKeys(parseHunt(comp.hunt));
  if (keys.length === 0) return;
  const read = huntRowParts(snapshot, keys, liveMap);
  if (Object.keys(read).length === 0) return;
  // clan-scope: global -- one participant row by id, of a competition the caller is already reading for.
  const [row] = await db
    .select({ baseline: weeklyParticipants.huntBaseline, current: weeklyParticipants.huntCurrent, stoppedAt: weeklyParticipants.stoppedAt })
    .from(weeklyParticipants)
    .where(eq(weeklyParticipants.id, participantId));
  // A character that left its save mid-hunt keeps what it had (lib/competitionGame).
  if (!row || row.stoppedAt) return;
  const next = mergeHuntRowStats(row.baseline, row.current, read);
  if (!next.changed) return;
  await db.update(weeklyParticipants).set({ huntBaseline: next.baseline, huntCurrent: next.current }).where(eq(weeklyParticipants.id, participantId));
}

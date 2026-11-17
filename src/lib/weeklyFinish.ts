// Finishing a competition: the one place its results are posted and its prizes settled.
//
// A competition can now end three ways: the lifecycle tick finds its end date has passed, an item
// hunt reaches its "after N drops" ending, or staff press "End now and post results". All three
// come through finishCompetition, which CLAIMS the finish in the database first (a conditional
// update of the status), so whichever arrives first posts and settles and every other one does
// nothing. A double click, two overlapping ticks, or the Nth drop racing the button: one post.

import { and, eq, ne } from 'drizzle-orm';

import { db } from '@/db';
import { weeklyCompetitions } from '@/db/schema';
import { announceCompetitionResults } from '@/lib/competitionTeamsPosts';
import { competitionBoard } from '@/lib/itemHuntDb';
import { log } from '@/lib/logger';
import { getEffectiveParticipants } from '@/lib/weekly';
import { settleWeeklyPrizes } from '@/lib/weeklyPrizeSettle';

type Comp = typeof weeklyCompetitions.$inferSelect;

/** Final, deduped standings for a competition (gains floored at 0), for the results announcement. */
export async function finalStandings(comp: Comp): Promise<{ rsn: string; gained: number }[]> {
  // THE SAME "who still counts" EVERY OTHER SURFACE USES: somebody who left the clan mid-competition
  // is off the site standings, the plugin leaderboard and /sotw, so they are off the results too.
  const participants = await getEffectiveParticipants(comp.id);
  // Dedupe by normalized RSN (rename/re-enroll can leave two rows), keeping the most progress.
  const byRsn = new Map<string, (typeof participants)[number]>();
  for (const p of participants) {
    const key = (p.rsn ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    const existing = byRsn.get(key);
    if (!existing || (p.currentValue ?? 0) > (existing.currentValue ?? 0)) byRsn.set(key, p);
  }
  // An item hunt places by its drops, and `gained` is then the count (lib/itemHuntDb competitionBoard).
  return (await competitionBoard(comp, [...byRsn.values()])).map((e) => ({ rsn: e.rsn, gained: Math.max(0, e.gained) }));
}

/**
 * Take the finish. True for exactly one caller per competition: the conditional update only matches
 * while the row is not yet 'completed', and the database serialises the writers.
 */
export async function claimFinish(competitionId: number): Promise<Comp | null> {
  // clan-scope: global -- one competition by id; every caller has already settled whose it is.
  const [claimed] = await db
    .update(weeklyCompetitions)
    .set({ status: 'completed' })
    .where(and(eq(weeklyCompetitions.id, competitionId), ne(weeklyCompetitions.status, 'completed')))
    .returning();
  return claimed ?? null;
}

/**
 * Finish a competition: claim it, post the results, settle the prizes. Returns whether THIS call
 * was the one that finished it. Posting is best-effort (a webhook failure never undoes a finish);
 * prizes settle after the post, and the settle pass is idempotent by its own stamp.
 */
export async function finishCompetition(competitionId: number): Promise<boolean> {
  const comp = await claimFinish(competitionId);
  if (!comp) return false;
  try {
    await announceCompetitionResults(comp, await finalStandings(comp));
  } catch (err) {
    log.warn('weekly.notify-results-fail', { competitionId }, err);
  }
  // After the results post, so the reserved prize is a consequence of a standing everybody has
  // already been shown rather than a number that appears first and is explained later.
  await settleWeeklyPrizes(competitionId);
  return true;
}

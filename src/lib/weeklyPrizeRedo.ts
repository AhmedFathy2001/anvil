// Redoing a finished competition's prizes from its standings as they are now.
//
// Prizes are reserved off the standings at the end, and staff can correct those standings after
// (a forced track, a fixed baseline). Until this existed the only way to move a prize to the right
// person was the coffer ledger by hand, and the Discord results still named the old order.
//
// ONLY WHILE NOTHING IS PAID. A prize a treasurer has marked paid has left the clan in game; moving
// it on the ledger would leave Anvil and the coffer disagreeing. Then it stays the ledger's job.
//
// The old prize rows are cancelled, not deleted, so the ledger keeps the history, and their place is
// cleared so the (competition, place) unique index lets the redo write the new ones. An item hunt's
// bounty awards are redone the same way: their item place is cleared for the
// (competition, item, item place) index.

import { and, eq, inArray, isNotNull, or } from 'drizzle-orm';

import { db } from '@/db';
import { cofferEntries, weeklyCompetitions } from '@/db/schema';
import { announceCompetitionResults } from '@/lib/competitionTeamsPosts';
import { log } from '@/lib/logger';
import { finalStandings } from '@/lib/weeklyFinish';
import { settleWeeklyPrizes, type SettleResult } from '@/lib/weeklyPrizeSettle';

export type RedoResult =
  | { ok: true; settle: SettleResult; reposted: boolean }
  | { ok: false; reason: 'not-finished' | 'paid'; paid?: string[] };

/** The prize rows a redo replaces: this competition's awards that still hold a place, or a bounty's place. */
async function placedAwards(competitionId: number) {
  // clan-scope: global -- one competition by id; the caller has already scoped it to its clan.
  return db
    .select({ id: cofferEntries.id, status: cofferEntries.status, rsn: cofferEntries.rsn, note: cofferEntries.note })
    .from(cofferEntries)
    .where(and(eq(cofferEntries.weeklyCompetitionId, competitionId), eq(cofferEntries.kind, 'award'), or(isNotNull(cofferEntries.place), isNotNull(cofferEntries.itemPlace))));
}

/** Can this competition's prizes be redone right now? Shown on the Results page before the button. */
export async function prizeRedoState(competitionId: number): Promise<{ possible: boolean; paid: string[] }> {
  const awards = await placedAwards(competitionId);
  const paid = awards.filter((a) => a.status === 'paid').map((a) => a.rsn ?? '?');
  return { possible: paid.length === 0, paid };
}

export async function redoWeeklyPrizes(
  competitionId: number,
  userId: number | null,
  opts: { repost: boolean },
): Promise<RedoResult> {
  // clan-scope: global -- one competition by id; the caller has already scoped it to its clan.
  const comp = await db.query.weeklyCompetitions.findFirst({ where: eq(weeklyCompetitions.id, competitionId) });
  if (!comp || comp.status !== 'completed') return { ok: false, reason: 'not-finished' };

  const awards = await placedAwards(competitionId);
  const paid = awards.filter((a) => a.status === 'paid');
  if (paid.length > 0) return { ok: false, reason: 'paid', paid: paid.map((a) => a.rsn ?? '?') };

  const nowIso = new Date().toISOString();
  const ids = awards.map((a) => a.id);
  if (ids.length > 0) {
    // Only rows still unpaid: a treasurer marking one paid in the meantime keeps it, and the
    // settle below then finds that place taken instead of paying it twice.
    // clan-scope: global -- ids read off this competition just above.
    await db
      .update(cofferEntries)
      // Both slots cleared, so the redo can write a place prize or a bounty (lib/itemHunt) afresh.
      .set({ status: 'cancelled', place: null, itemPlace: null, settledByUserId: userId, settledAt: nowIso })
      .where(and(inArray(cofferEntries.id, ids), inArray(cofferEntries.status, ['planned', 'reserved', 'unfunded'])));
  }
  // clan-scope: global -- the competition read above.
  await db.update(weeklyCompetitions).set({ prizesSettledAt: null }).where(eq(weeklyCompetitions.id, competitionId));

  const settle = await settleWeeklyPrizes(competitionId);
  log.info('weekly.prizes-redone', { competitionId, userId, replaced: ids.length, ...settle });

  let reposted = false;
  if (opts.repost) {
    try {
      // The same results post as the end, marked so nobody reads it as a second competition.
      await announceCompetitionResults({ ...comp, title: `${comp.title} (corrected results)`, pingOnEnd: false }, await finalStandings(comp));
      reposted = true;
    } catch (err) {
      log.warn('weekly.prizes-redo-repost-fail', { competitionId }, err);
    }
  }
  return { ok: true, settle, reposted };
}

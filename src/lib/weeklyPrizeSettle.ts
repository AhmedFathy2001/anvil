import { parsePrizeCurrency } from '@/lib/competitionGame';
import { weeklyFeePotGp } from '@/lib/weeklySignups';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { releaseWeeklyPool, reserveWeeklyAward } from '@/lib/coffer';
import { countsTowardLeaderboard } from '@/lib/weekly';
import { competitionBoard, huntPrizeBoard } from '@/lib/itemHuntDb';
import { parseWeeklyPrizes, winnersFor, feePlaces } from '@/lib/weeklyPrizes';
import { ordinal } from '@/lib/utils';

// Paying out a Skill or Boss of the Week.
//
// Runs when a competition has FINISHED, not while it is running: a prize decided from a live board
// would change hands every time somebody logged in. So this is a settle pass, once, off the final
// standings — the same ones the results post and the page show.
//
// IDEMPOTENT TWICE OVER. `prizes_settled_at` stops the second pass doing any work at all, and the
// unique index on (competition, place) stops it paying twice even if two ticks overlap. Belt and
// braces because the failure mode is real money leaving twice.

export interface SettleResult {
  settled: boolean;
  reserved: number;
  unfunded: number;
}

/**
 * Reserve the prizes for one finished competition.
 *
 * Places are paid in board order and nothing is promoted: a three-place ladder with two entrants
 * pays two places, because third was not won and sliding somebody up into it would be inventing a
 * result. A place the coffer cannot cover is recorded as unfunded rather than skipped, so the clan
 * can see it promised something it could not pay instead of the row simply never existing.
 *
 * When the ladder splits ties, one finishing position can produce several payments — see winnersFor.
 * Each still takes its own ledger slot, which is what the (competition, place) unique index needs.
 */
export async function settleWeeklyPrizes(competitionId: number): Promise<SettleResult> {
  // clan-scope: global -- keyed by a competition id, and a competition belongs to exactly one clan;
  // the clan is read back off this row and every write below is scoped to it.
  const comp = await db.query.weeklyCompetitions.findFirst({
    where: eq(weeklyCompetitions.id, competitionId),
  });
  if (!comp || comp.status !== 'completed' || comp.prizesSettledAt) {
    return { settled: false, reserved: 0, unfunded: 0 };
  }
  // Entry fees that went into the coffer are paid out on top of the ladder (lib/weeklyPrizes feePlaces).
  const ladder = parseWeeklyPrizes(comp.prizes);
  const prizes = { ...ladder, places: feePlaces(ladder.places, comp.feesToPrizes ? await weeklyFeePotGp(competitionId) : 0) };
  if (prizes.places.length === 0) {
    // Nothing to pay. Release anything a ladder held before it was emptied, then stamp it so the
    // pass stops looking at this one every tick forever.
    await releaseWeeklyPool(competitionId);
    await db
      .update(weeklyCompetitions)
      .set({ prizesSettledAt: new Date().toISOString() })
      .where(and(eq(weeklyCompetitions.id, competitionId), isNull(weeklyCompetitions.prizesSettledAt)));
    return { settled: true, reserved: 0, unfunded: 0 };
  }

  // The same rows the board is built from, so the payout cannot disagree with what people watched.
  // clan-scope: this clan -- narrowed to this competition's participants, which are its clan's.
  const rows = await db
    .select({
      rsn: weeklyParticipants.rsn,
      clanMemberId: weeklyParticipants.clanMemberId,
      baselineValue: weeklyParticipants.baselineValue,
      currentValue: weeklyParticipants.currentValue,
      seatKind: clanRoster.kind,
      feeStatus: weeklyParticipants.feeStatus,
    })
    .from(weeklyParticipants)
    .leftJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
    // Leavers are not on this board — the same rule the standings everywhere else already apply.
    // Without it the coffer could pay a placing to somebody who left the clan before it ended,
    // while the leaderboard that decided the placings had already dropped them: the prize would go
    // to a name nobody could see on the board it was awarded from.
    .where(and(eq(weeklyParticipants.competitionId, competitionId), countsTowardLeaderboard()));

  // Guests rank on the board when the clan allows it, but the coffer is the clan's money — paying a
  // visitor out of it is a decision a host makes deliberately, not one a default should make.
  // An event player's seat is never the clan's: no coffer prize for it.
  const eligible = rows.filter((r) => r.seatKind !== 'event' && (comp.includeGuests === 1 || r.seatKind !== 'guest'));
  const byRsn = new Map(eligible.map((r) => [r.rsn, r]));
  // competitionBoard: an item hunt places by its drops (lib/itemHuntDb), everything else by the gain.
  // AN ITEM HUNT PAYS ONLY ON DROPS STAFF HAVE CONFIRMED, and the question is asked of the rows
  // that are about to be paid: the hunt is ranked over `eligible` (the list the coffer pays, not
  // the public board), and the hold looks at the paying places of that same ranking. While any drop
  // behind one of them is unconfirmed nothing is reserved and nothing is stamped: the pass comes
  // back every tick and settles once staff have confirmed (or turned down) those drops. The
  // ladder's hold on the coffer stays in place meanwhile. A clan that chose "count plugin drops
  // automatically" has no holds (lib/itemHunt unconfirmedPrizeDrops).
  const hunt = comp.type === 'hunt' ? await huntPrizeBoard(comp, eligible, prizes.places.length) : null;
  if (hunt && hunt.holds.length > 0) return { settled: false, reserved: 0, unfunded: 0 };
  const board = hunt
    ? hunt.rows.map((r) => ({ rsn: r.rsn, gained: r.count }))
    : (await competitionBoard(comp, eligible)).map((e) => ({ rsn: e.rsn, gained: e.gained }));
  const standings = board.map((e, i) => ({
    rsn: e.rsn,
    // A hunt's order is its rule's (first drop, or count then time), which the count alone cannot
    // say: two finishers of a "first to get it" hunt both hold one drop and are not tied. So each
    // placed hunter gets a strictly descending figure and "split ties" finds no tie to split.
    gained: hunt ? (e.gained > 0 ? board.length - i : 0) : e.gained,
    clanMemberId: byRsn.get(e.rsn)?.clanMemberId ?? null,
  }));

  // A WINNER WHO STILL OWES THEIR ENTRY FEE holds the prizes (the competition's own switch, on by
  // default): nothing is reserved and nothing is stamped, so the pass comes back every tick and pays
  // once staff have marked that fee paid, waived it, or taken the person out. Collecting is staff's
  // job; this only stops the coffer paying someone before they have done it. The ladder's hold on
  // the coffer stays in place meanwhile.
  if (comp.feeGatesPrize && winnersFor(prizes, standings).some((w) => byRsn.get(w.rsn)?.feeStatus === 'pending')) {
    return { settled: false, reserved: 0, unfunded: 0 };
  }

  // LET THE HOLD GO FIRST. While it ran, this ladder's gp sat reserved against the coffer so nothing
  // else could promise it away. The awards below are that same money finding its owners, and they
  // fund against `available` — so leaving the hold in place would have the competition competing
  // with itself and calling its own winners unfunded.
  //
  // Whatever nobody won is simply never re-reserved: a place with no entrant, or a ladder on a week
  // where nobody gained anything, releases back into the pot by not being claimed. That is the
  // release, and it happens without a decision.
  await releaseWeeklyPool(competitionId);

  let reserved = 0;
  let unfunded = 0;
  for (const winner of winnersFor(prizes, standings)) {
    // The RANK, not the slot. A three-way split for first writes slots 1, 2 and 3 — the numbers that
    // keep the unique index honest — but all three of those people finished first, and a ledger line
    // telling one of them they came third would be wrong in the only place a winner will read it.
    const note =
      winner.sharedWith > 1
        ? `${comp.title} — ${ordinal(winner.rank)}, split ${winner.sharedWith} ways`
        : `${comp.title} — ${ordinal(winner.rank)}`;
    const row = await reserveWeeklyAward({
      clanId: comp.clanId,
      amount: winner.gp,
      weeklyCompetitionId: competitionId,
      place: winner.place,
      clanMemberId: winner.clanMemberId,
      rsn: winner.rsn,
      note,
      currency: parsePrizeCurrency(comp.prizeCurrency),
    });
    // A null row means the place was already taken by a concurrent pass — not a failure to pay.
    if (!row) continue;
    if (row.status === 'unfunded') unfunded++;
    else reserved++;
  }

  await db
    .update(weeklyCompetitions)
    .set({ prizesSettledAt: new Date().toISOString() })
    .where(and(eq(weeklyCompetitions.id, competitionId), isNull(weeklyCompetitions.prizesSettledAt)));
  return { settled: true, reserved, unfunded };
}


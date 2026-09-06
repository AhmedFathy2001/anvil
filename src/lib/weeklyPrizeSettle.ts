import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { reserveWeeklyAward } from '@/lib/coffer';
import { computeLeaderboard } from '@/lib/weekly';
import { parseWeeklyPrizes, winnersFor } from '@/lib/weeklyPrizes';

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
 */
export async function settleWeeklyPrizes(competitionId: number): Promise<SettleResult> {
  const comp = await db.query.weeklyCompetitions.findFirst({
    where: eq(weeklyCompetitions.id, competitionId),
  });
  if (!comp || comp.status !== 'completed' || comp.prizesSettledAt) {
    return { settled: false, reserved: 0, unfunded: 0 };
  }
  const prizes = parseWeeklyPrizes(comp.prizes);
  if (prizes.places.length === 0) {
    // Nothing to pay, but stamp it so the pass stops looking at this one every tick forever.
    await db
      .update(weeklyCompetitions)
      .set({ prizesSettledAt: new Date().toISOString() })
      .where(and(eq(weeklyCompetitions.id, competitionId), isNull(weeklyCompetitions.prizesSettledAt)));
    return { settled: true, reserved: 0, unfunded: 0 };
  }

  // The same rows the board is built from, so the payout cannot disagree with what people watched.
  const rows = await db
    .select({
      rsn: weeklyParticipants.rsn,
      clanMemberId: weeklyParticipants.clanMemberId,
      baselineValue: weeklyParticipants.baselineValue,
      currentValue: weeklyParticipants.currentValue,
      seatKind: clanRoster.kind,
    })
    .from(weeklyParticipants)
    .leftJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
    .where(eq(weeklyParticipants.competitionId, competitionId));

  // Guests rank on the board when the clan allows it, but the coffer is the clan's money — paying a
  // visitor out of it is a decision a host makes deliberately, not one a default should make.
  const eligible = rows.filter((r) => comp.includeGuests === 1 || r.seatKind !== 'guest');
  const byRsn = new Map(eligible.map((r) => [r.rsn, r]));
  const standings = computeLeaderboard(eligible).map((e) => ({
    rsn: e.rsn,
    gained: e.gained,
    clanMemberId: byRsn.get(e.rsn)?.clanMemberId ?? null,
  }));

  let reserved = 0;
  let unfunded = 0;
  for (const winner of winnersFor(prizes, standings)) {
    const note = `${comp.title} — ${ordinal(winner.place)}`;
    const row = await reserveWeeklyAward({
      clanId: comp.clanId,
      amount: winner.gp,
      weeklyCompetitionId: competitionId,
      place: winner.place,
      clanMemberId: winner.clanMemberId,
      rsn: winner.rsn,
      note,
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

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

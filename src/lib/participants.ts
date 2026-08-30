// Who is on a board, and the one rule that says they are on it once.
//
// `event_participants.clan_member_id` is a SEAT — (clan, account) — and for as long as one
// deployment served one clan it was a faithful stand-in for the person: an account had exactly one
// seat, so "this seat" and "this player" were the same fact wearing two names. Putting clans on one
// platform pulls them apart. An account keeps a member seat in its own clan and picks up a guest
// seat in whichever clan is hosting, so the two doors onto a co-hosted board — a player entering it
// themselves, and a co-host's staff rostering their own members — hand out two DIFFERENT seat ids
// for one human.
//
// Nine call sites insert into that table, and every one of them de-duplicated on the seat. So the
// same person could come through both doors and be seated twice: their stat gains counted for their
// team twice, two rows on the roster, two fees owed. Nothing errored, because nothing was wrong from
// where any single call site was standing.
//
// THE ACCOUNT IS THE UNIT. This module is the only place that needs to know that, so a tenth call
// site added later cannot get it wrong by not knowing. The partial unique index on
// (event_id, account_id) backs it in the database, which is what makes `enrolParticipant` safe to
// call concurrently: the conflict clause turns a race into the same answer both callers wanted.

import { and, eq, inArray, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, eventParticipants } from '@/db/schema';

export type Participant = typeof eventParticipants.$inferSelect;

/** The account behind one roster seat, or null when the seat has gone. */
export async function accountOfSeat(seatId: number | null | undefined): Promise<number | null> {
  if (seatId == null) return null;
  const [row] = await db
    .select({ accountId: clanRoster.accountId })
    .from(clanRoster)
    .where(eq(clanRoster.id, seatId))
    .limit(1);
  return row?.accountId ?? null;
}

/** Seat → account for many seats at once, for the paths that enrol in bulk. */
export async function accountsOfSeats(seatIds: (number | null | undefined)[]): Promise<Map<number, number>> {
  const ids = [...new Set(seatIds.filter((s): s is number => s != null))];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: clanRoster.id, accountId: clanRoster.accountId })
    .from(clanRoster)
    .where(inArray(clanRoster.id, ids));
  return new Map(rows.map((r) => [r.id, r.accountId]));
}

/**
 * The row this board already holds for the human behind `seatId`, if any.
 *
 * Asks by ACCOUNT, which is the whole point: a co-host's own seat and a guest seat in the host clan
 * are two seats and one player, and this finds the row whichever of them the caller is holding. The
 * seat lookup is kept as a fallback purely for rows whose account could not be resolved — a seat
 * deleted after the participant was made — so a caller never silently creates a second row for
 * somebody the board already knows.
 */
export async function participantForSeat(eventId: number, seatId: number | null | undefined): Promise<Participant | undefined> {
  const accountId = await accountOfSeat(seatId);
  if (accountId != null) {
    const byAccount = await db.query.eventParticipants.findFirst({
      where: and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.accountId, accountId)),
    });
    if (byAccount) return byAccount;
  }
  if (seatId == null) return undefined;
  return db.query.eventParticipants.findFirst({
    where: and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.clanMemberId, seatId)),
  });
}

/** Every account already on this board — for bulk enrolment deciding what is new. */
export async function accountsOnBoard(eventId: number): Promise<Map<number, Participant>> {
  const rows = await db
    .select()
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), isNotNull(eventParticipants.accountId)));
  const out = new Map<number, Participant>();
  for (const r of rows) if (r.accountId != null) out.set(r.accountId, r);
  return out;
}

export type NewParticipant = Omit<typeof eventParticipants.$inferInsert, 'accountId'> & {
  /** Optional: resolved from `clanMemberId` when the caller does not already hold it. */
  accountId?: number | null;
};

/**
 * Put somebody on a board, once.
 *
 * Returns the row that ended up there and whether this call is what created it, so a caller can tell
 * "enrolled" from "was already here" without asking again. `created: false` with no insert of your
 * own is the normal outcome of two admins pressing the same button, and of a player entering through
 * one door after their clan's staff already brought them through the other.
 */
export async function enrolParticipant(values: NewParticipant): Promise<{ row: Participant; created: boolean }> {
  const accountId = values.accountId ?? (await accountOfSeat(values.clanMemberId));

  // No account to key on — a participant with no seat behind it. Nothing can be de-duplicated, so
  // this is a plain insert, exactly as it was before.
  if (accountId == null) {
    const [row] = await db.insert(eventParticipants).values({ ...values, accountId: null }).returning();
    return { row, created: true };
  }

  const [row] = await db
    .insert(eventParticipants)
    .values({ ...values, accountId })
    .onConflictDoNothing({ target: [eventParticipants.eventId, eventParticipants.accountId] })
    .returning();
  if (row) return { row, created: true };

  // The index refused it: this account is already on this board. Hand back the row that won, so the
  // caller carries on with the player who is actually there.
  const existing = await db.query.eventParticipants.findFirst({
    where: and(eq(eventParticipants.eventId, values.eventId), eq(eventParticipants.accountId, accountId)),
  });
  if (!existing) throw new Error('event_participants conflict with no conflicting row');
  return { row: existing, created: false };
}

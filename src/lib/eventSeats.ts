// Which of a person's roster seats may sign up for an event.
//
// A sign-up names a seat (`event_signups.clan_member_id`). For a clan's own event that is a seat in
// that clan. For a CO-HOSTED event it may also be a seat in any clan that accepted a co-host seat on
// it: the host said yes to that whole clan, and its members play from their own roster rather than
// becoming guests of a clan they share nothing with. That is the same rule the co-host team roster
// already follows (api/team/[teamId]/roster adds a co-host's own seats to its team), and the board
// side was built for it — participants are matched by ACCOUNT (lib/participants), never by seat.

import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, eventCohosts } from '@/db/schema';

/** The host, then every clan that accepted a co-host seat on this event. */
export async function signupClanIds(event: { id: number; clanId: number }): Promise<number[]> {
  const rows = await db
    .select({ clanId: eventCohosts.clanId })
    .from(eventCohosts)
    .where(and(eq(eventCohosts.eventId, event.id), eq(eventCohosts.status, 'accepted')));
  return [event.clanId, ...rows.map((r) => r.clanId).filter((c) => c !== event.clanId)];
}

/**
 * This person's live seats that may enter this event — ONE per account.
 *
 * Someone can sit in both clans with the same character (a member of the co-host, and a guest of the
 * host from before co-hosting existed). Listing both would offer "Playing as Zezima, Zezima" and let
 * them enter one character twice. The HOST's seat wins, so an earlier sign-up made on it still
 * matches the seat offered now.
 */
export async function signupSeatsFor(event: { id: number; clanId: number }, playerId: number) {
  const clanIds = await signupClanIds(event);
  const seats = await db
    .select()
    .from(clanRoster)
    .where(and(inArray(clanRoster.clanId, clanIds), eq(clanRoster.playerId, playerId), isNull(clanRoster.leftAt)))
    .orderBy(desc(clanRoster.isPrimary), desc(clanRoster.verifiedAt));

  const byAccount = new Map<number, (typeof seats)[number]>();
  for (const seat of seats) {
    const held = byAccount.get(seat.accountId);
    if (!held || (held.clanId !== event.clanId && seat.clanId === event.clanId)) byAccount.set(seat.accountId, seat);
  }
  // Keep the query's order (primary first, then most recently verified).
  return seats.filter((s) => byAccount.get(s.accountId) === s);
}

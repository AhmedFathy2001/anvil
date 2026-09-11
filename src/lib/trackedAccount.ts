// Changing which character a board follows.
//
// An RSN gets banned, or somebody carries on the event on their alt: the player row is re-pointed
// at another of their characters and the board polls that one from then on.
//
// ONE IMPLEMENTATION, TWO CALLERS. It was inline in the admin PATCH, and a second caller — a clan
// running its own team on a clan-vs-clan board — would have meant a second copy. The last time this
// logic existed in one place and a related rule in another, the two disagreed about whether
// `account_id` moves with the seat, and the answer was duplicate participants on live boards. So
// the rules live here and the routes decide only WHO may ask.
//
// What a caller still owes: the authority check, and the set of clans whose seats it will accept.
// Those are the two things that genuinely differ between an admin and a team's own staff.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, eventParticipants } from '@/db/schema';
import { findRosterSeat, updateAccountOfSeat } from '@/lib/roster';

export type SwapResult =
  | { ok: true; changed: boolean; rsn: string }
  | { ok: false; status: number; error: string };

/**
 * Point a player row at a different character.
 *
 * `allowedClanIds` is the caller's answer to "whose seats may this row be moved onto" — the host
 * plus its accepted co-hosts for an admin, one clan's own seats for that clan's staff. It is never
 * defaulted: an unscoped version of this once re-pointed player rows at any clan's member.
 *
 * `samePersonOnly` additionally refuses a seat belonging to a different human. An admin correcting
 * a mislinked row legitimately needs to cross that line; a team manager tidying their own roster
 * does not, and letting them would be a way to put somebody else's character on their team.
 */
export async function swapTrackedAccount(opts: {
  player: typeof eventParticipants.$inferSelect;
  eventId: number;
  toSeatId: number;
  allowedClanIds: number[];
  samePersonOnly?: boolean;
}): Promise<SwapResult & { updates?: Record<string, unknown> }> {
  const { player, eventId, toSeatId, allowedClanIds, samePersonOnly = false } = opts;

  if (!Number.isFinite(toSeatId)) {
    return { ok: false, status: 400, error: 'Invalid clanMemberId' };
  }
  if (toSeatId === player.clanMemberId) {
    return { ok: true, changed: false, rsn: player.name };
  }

  // Scoped by the caller's list. The seat id arrives from a request body, and unscoped this moved a
  // player row onto ANY clan's member.
  const member = await findRosterSeat(
    and(eq(clanRoster.id, toSeatId), inArray(clanRoster.clanId, allowedClanIds)),
  );
  if (!member) return { ok: false, status: 404, error: 'Account not found' };

  const current = player.clanMemberId != null
    // clan-scope: global -- the id came from a row the caller has already established.
    ? await findRosterSeat(eq(clanRoster.id, player.clanMemberId))
    : null;

  if (samePersonOnly) {
    // Both sides must be a known person, and the same one. An unlinked seat has no owner to compare,
    // so it is refused rather than assumed — "probably theirs" is not a basis for moving a roster.
    if (current?.playerId == null || member.playerId == null || current.playerId !== member.playerId) {
      return {
        ok: false,
        status: 403,
        error: `${member.rsn} is not another character of that player. Ask the host to move somebody onto a different account.`,
      };
    }
  }

  // ANOTHER ROW MAY ALREADY BE THAT ACCOUNT. `event_participants` carries a partial unique index on
  // (event_id, account_id), so writing the new account onto this row when somebody else on the board
  // already holds it is a 23505 — a raw 500 in somebody's face. Ask first and say who.
  if (member.accountId != null) {
    const clash = await db.query.eventParticipants.findFirst({
      where: and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.accountId, member.accountId)),
      columns: { id: true, name: true },
    });
    if (clash && clash.id !== player.id) {
      return {
        ok: false,
        status: 409,
        error: `${member.rsn} is already on this board as ${clash.name}. Remove that entry first.`,
      };
    }
  }

  // The plugin resolves a player row through the Discord user's OWN linked accounts, so a swapped-in
  // account must belong to the same owner or the overlay will not find it. An unlinked ghost is
  // linked to this player's owner; one that already belongs to somebody ELSE is left alone rather
  // than stolen.
  const owner = current?.claimedAt ? current.playerId : null;
  if (owner != null && member.claimedAt == null) {
    await updateAccountOfSeat(toSeatId, { playerId: owner, claimedAt: current!.claimedAt });
  }

  return {
    ok: true,
    changed: true,
    rsn: member.rsn,
    updates: {
      clanMemberId: toSeatId,
      // THE ACCOUNT MOVES WITH THE SEAT. Leaving it behind is what made a row claim to be the
      // account it was swapped away from while tracking the new one — and account_id is the
      // de-duplication key, so the next ordinary enrolment of that character inserted a SECOND row
      // for the same human. Two stat gains, two roster rows, two fees.
      accountId: member.accountId ?? null,
      name: member.rsn,
      // The baseline belongs to the OLD character. Kept, gains would read as
      // (new account's current XP/KC) − (old account's baseline), which is nonsense. Nulled, the
      // next hiscores tick re-anchors to the character actually being played.
      statsSnapshot: null,
      snapshotAt: null,
      cachedStats: null,
      lastStatsFetch: null,
    },
  };
}

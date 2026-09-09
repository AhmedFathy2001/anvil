// Turning the seats a person holds into the characters an admin can choose between.
//
// A SEAT IS NOT A CHARACTER. `clan_roster` is (account × clan), so somebody who plays two accounts
// and belongs to three clans holds up to six seats — and the "tracked account" dropdown, which
// listed seats, showed their main three times and their alt twice, one of each pair marked
// "current" and nothing on screen to explain why there were several. The screenshot that found this
// read: Drenvox mdps, Denoverse, Denoverse, Drenvox mdps, Drenvox mdps, GIM Drenvox.
//
// The count per name was simply the number of clans that character is in. Which is a fact about
// clan membership and has nothing whatever to say about which character a board should follow.
//
// Pure and dependency-free (no `@/` imports) so tests/account-choices.test.ts can type-strip it,
// the same way lib/participants' own rules are pinned by tests/participant-identity.

export interface Seat {
  /** clan_roster.id — a seat, and what the swap endpoint takes. */
  id: number;
  clanId: number;
  /** Null for a seat whose account row has gone; such a seat cannot be folded with any other. */
  accountId: number | null;
  rsn: string;
  status: string;
}

export interface AccountChoice {
  /** The seat that represents this character. Still a seat id, because that is what the swap takes. */
  clanMemberId: number;
  rsn: string;
  status: string;
  isCurrent: boolean;
}

/**
 * One row per character, from however many seats it is held on.
 *
 * WHICH SEAT REPRESENTS A CHARACTER, in order: the seat already in use, then one in the event's own
 * clan, then whichever came first. That ordering is not cosmetic — the returned id is what the swap
 * writes to `clan_member_id`, so picking a different clan's seat for the character somebody is
 * ALREADY tracked as would quietly re-seat the participant into another clan while appearing to
 * change nothing.
 *
 * A seat with no account cannot be folded (nothing to fold on) and is kept as its own row, since
 * dropping it would leave a ghost participant with no option at all.
 */
export function accountChoices(
  seats: Seat[],
  opts: { currentSeatId: number | null; eventClanId: number },
): AccountChoice[] {
  const byAccount = new Map<number, Seat>();
  const unaccounted: Seat[] = [];

  for (const seat of seats) {
    if (seat.accountId == null) {
      unaccounted.push(seat);
      continue;
    }
    const held = byAccount.get(seat.accountId);
    if (!held) {
      byAccount.set(seat.accountId, seat);
      continue;
    }
    if (preferred(seat, held, opts)) byAccount.set(seat.accountId, seat);
  }

  return [...byAccount.values(), ...unaccounted]
    .map((m) => ({
      clanMemberId: m.id,
      rsn: m.rsn,
      status: m.status,
      isCurrent: m.id === opts.currentSeatId,
    }))
    // The current character first — it is the one being changed FROM — then the rest by name.
    .sort((a, b) => (a.isCurrent ? -1 : b.isCurrent ? 1 : a.rsn.localeCompare(b.rsn)));
}

/** Should `candidate` represent this character instead of `held`? */
function preferred(candidate: Seat, held: Seat, opts: { currentSeatId: number | null; eventClanId: number }): boolean {
  if (candidate.id === opts.currentSeatId) return true;
  if (held.id === opts.currentSeatId) return false;
  return candidate.clanId === opts.eventClanId && held.clanId !== opts.eventClanId;
}

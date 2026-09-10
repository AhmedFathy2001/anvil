// Matching a sign-up to the player row it became.
//
// They are two records of two different things and they can legitimately disagree. A sign-up is
// made on a SEAT and never moves — it is the record of who applied and what they said. The player
// row is what the board actually follows, and an admin can re-point it at another of that person's
// characters (Teams → a player → Edit → Tracked account) when an RSN gets banned or they carry on
// on an alt.
//
// Keyed on the seat alone, the two then stop being able to find each other: a drafted player's
// sign-up matched nothing, lost its team chip, and fell back to the dashed "wants …" as though they
// were still in the pool. Nothing was wrong with the draft — the halves had come apart.
//
// THE PERSON IS WHAT SURVIVES A SWAP, because swapping a character does not change who is playing.
// The seat is still tried first, so an ordinary board — where the two agree — resolves exactly as
// it always did, and it takes a shared person id, not a coincidence, to match anything.
//
// Pure and dependency-free (no `@/` imports) so tests/signup-player.test.ts can type-strip it.

export interface PlayerRow<T> {
  /** event_participants.clan_member_id — the seat the board is following. */
  seatId: number | null;
  /** The human behind that seat. Null when the seat has gone, or was never linked to an account. */
  personId: number | null;
  /** Whatever the caller wants back — a team, a whole row. */
  value: T;
}

export interface Resolver<T> {
  /** The player row for a sign-up, or null when they are not on the board. */
  forSignup: (signup: { seatId: number; personId: number | null }) => T | null;
}

/**
 * Build the lookup once, then ask it per sign-up.
 *
 * A person holding several player rows on one board should not happen — lib/participants and the
 * partial unique index on (event_id, account_id) exist to prevent exactly that — but if it does,
 * the FIRST is kept rather than the last, so a duplicate cannot silently change which team a
 * sign-up appears to be on from one page load to the next.
 */
export function resolvePlayers<T>(players: PlayerRow<T>[]): Resolver<T> {
  const bySeat = new Map<number, T>();
  const byPerson = new Map<number, T>();

  for (const p of players) {
    if (p.seatId != null && !bySeat.has(p.seatId)) bySeat.set(p.seatId, p.value);
    if (p.personId != null && !byPerson.has(p.personId)) byPerson.set(p.personId, p.value);
  }

  return {
    forSignup: ({ seatId, personId }) => {
      const bySeatHit = bySeat.get(seatId);
      if (bySeatHit !== undefined) return bySeatHit;
      if (personId == null) return null;
      return byPerson.get(personId) ?? null;
    },
  };
}

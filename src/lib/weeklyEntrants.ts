// Who is actually in a weekly competition, once you stop counting seats and start counting people.
//
// THE FANOUT COUNTS SEATS. lib/weekly's enrollAllPlayers walks `clan_roster` — which is (account ×
// clan), one row per character — and inserts a participant per row, gated by a single boolean on
// the competition: includeGuests, on or off, for everybody. Two things follow from that, and
// neither was visible anywhere:
//
//   1. A PERSON WITH TWO CHARACTERS ENTERS TWICE. A main on the roster as a member and an alt
//      pinged in as a guest are two seats, so with guests included they are two entrants racing
//      each other on the same leaderboard. That is fine for "most XP gained by an account" and
//      wrong for "who won Skill of the Week" — and prizes now come out of the clan coffer, so it
//      is the difference between one human taking first and the same human taking first AND third.
//      Turn guests off instead and the alt vanishes silently, which is the same problem wearing the
//      opposite coat.
//
//   2. THE SWITCH IS ALL OR NOTHING. There is no way to enter three of the twelve guests who
//      actually turn up, and — until the DELETE this file exists to support — no way to remove
//      anybody at all once enrolled.
//
// The bingo side settled this long ago: events carry maxAccountsPerPerson and accountSlotMode, and
// all of a person's accounts land on ONE team. Weeklies never grew the vocabulary. This does not
// change the scoring — that is a decision about what a competition MEANS and it belongs to whoever
// runs the clan — it makes the situation legible so an admin can see it and act on it.
//
// Pure and dependency-free (no `@/` imports) so tests/weekly-entrants.test.ts can type-strip it,
// the same way lib/adminAttention and lib/clanBilling do.

export interface EntrantSeat {
  /** weekly_participants.id — what a removal is addressed to. */
  participantId: number;
  rsn: string;
  /**
   * The person behind the character, from clan_roster.player_id.
   *
   * Null is ordinary and must not be treated as "nobody": a seat created by name (an admin typing
   * an RSN into the add box) has no linked account until that character is played with the plugin.
   * Two null seats are two different unknowns, never the same person.
   */
  playerId: number | null;
  /** 'member' | 'guest' — the seat's standing in THIS clan, not the person's. */
  kind: string | null;
  /** They are no longer on the roster; `keepIfLeft` is what decides whether they still score. */
  left: boolean;
}

export interface DoubleEntry {
  playerId: number;
  /** Their seats in this competition, member-first so the one to keep is named first. */
  seats: EntrantSeat[];
}

/** Seats ordered so a member outranks a guest, then by name for a stable read. */
function seatRank(s: EntrantSeat): number {
  return s.kind === 'member' ? 0 : 1;
}

/**
 * People holding more than one seat in this competition.
 *
 * Keyed on playerId, so it is silent about seats that have never been linked to an account — the
 * honest answer, since two unlinked characters may or may not be one human and nothing here knows.
 */
export function doubleEntries(seats: EntrantSeat[]): DoubleEntry[] {
  const byPerson = new Map<number, EntrantSeat[]>();
  for (const s of seats) {
    if (s.playerId == null) continue;
    byPerson.set(s.playerId, [...(byPerson.get(s.playerId) ?? []), s]);
  }
  return [...byPerson.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([playerId, group]) => ({
      playerId,
      seats: [...group].sort((a, b) => seatRank(a) - seatRank(b) || a.rsn.localeCompare(b.rsn)),
    }))
    .sort((a, b) => a.seats[0].rsn.localeCompare(b.seats[0].rsn));
}

/**
 * Which participant ids to drop to leave one seat per person.
 *
 * Keeps the member seat where there is one, otherwise the first by name — never the highest
 * scoring. Dropping whichever character happens to be losing would quietly rewrite the standings,
 * and "one entry per person" is a rule about entry, not a way to pick a winner.
 *
 * Returns ids only. Nothing here removes anything; the caller decides, and the admin confirms.
 */
export function surplusSeats(seats: EntrantSeat[]): number[] {
  return doubleEntries(seats).flatMap((d) => d.seats.slice(1).map((s) => s.participantId));
}

/** How the guests in a competition break down, for a control that offers to add or drop them. */
export interface GuestSplit {
  /** Guest seats currently entered. */
  entered: EntrantSeat[];
  /** Guest seats on the roster that are not entered — the ones an "add" would take in. */
  available: { rsn: string }[];
}

export function guestSplit(
  seats: EntrantSeat[],
  rosterGuests: { rsn: string }[],
  normalize: (rsn: string) => string,
): GuestSplit {
  const enteredNorm = new Set(seats.map((s) => normalize(s.rsn)));
  return {
    entered: seats.filter((s) => s.kind === 'guest' && !s.left),
    available: rosterGuests.filter((g) => !enteredNorm.has(normalize(g.rsn))),
  };
}

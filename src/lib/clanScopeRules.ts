// "This clan's own" — the cross-clan boundary, as rules that can be tested without a database.
//
// A clan page is one clan's view of a character. Three places built that view from every clan's
// data and narrowed it by NAME afterwards, so another clan's events — a members-only clan's among
// them — showed up on this clan's member page and fed this clan's staff ratings. These predicates
// are the narrowing each of them now applies.
//
// PURE — tests/member-privacy.test.ts.

/**
 * Does this event row belong in a seat's competition history on its clan's member page?
 *
 * By SEAT, in any event: the seat itself played (a co-hosted board another clan hosts included).
 * By NAME, only in this clan's own events: a rename leaves old rows carrying the old RSN, and that
 * alias is only trustworthy inside the clan whose roster recorded it. A name match in somebody
 * else's event is a different clan's business — or a different person with the same name.
 */
export function historyRowIsThisSeats(
  row: { seatId: number | null; nameMatchesAlias: boolean; eventClanId: number },
  seat: { id: number; clanId: number | null },
): boolean {
  if (row.seatId != null && row.seatId === seat.id) return true;
  return row.nameMatchesAlias && seat.clanId != null && row.eventClanId === seat.clanId;
}

/**
 * May an event be named on a page someone outside the clan can read? Not an invited-only one: its
 * existence is for the people invited. Insiders see their clan's whole history.
 */
export function historyEventShown(eventVisibility: string | null | undefined, viewerIsInsider: boolean): boolean {
  return viewerIsInsider || eventVisibility !== 'invited';
}

/**
 * A member's Discord nickname in one clan is built from the characters seated IN THAT CLAN. The
 * person's characters elsewhere are not this clan's to print in its member list.
 */
export function nicknameNamesFor<T extends { rsn: string; clanId: number }>(characters: T[], clanId: number): string[] {
  return characters.filter((c) => c.clanId === clanId).map((c) => c.rsn);
}

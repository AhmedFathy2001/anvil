// The three kinds of seat, and what each one opens. Pure: no database import (tests/pure-module-imports).
//
//                 member              guest                   event (an "event player")
//   who           the clan's roster   regulars it lets in     a viewer who joined ONE streamed event
//   shown in      the roster          the guest list          that event's players + "Past viewers"
//   can enter     every clan event    events open to guests   only the event it names (eventId)
//   member cap    counts              —                       never (counts toward that event's
//                                                              player cap instead, lib/creatorPlans)
//   event ends    —                   stays a guest           the seat closes; the row stays
//
// One row per account per clan for members and guests; one per account per EVENT for event seats
// (the unique indexes in drizzle/0205), so a viewer in two of a streamer's events holds two seats and
// neither opens the other. Everything that asks "does this person belong to this clan?" — rosters,
// guest lists, counts, Discord roles, feeds, weeklies, access to the clan itself — asks it of
// member and guest seats only (`isClanSeat`). Everything that asks "may this seat play THIS event?"
// asks `seatOpensEvent`.

export type SeatKind = 'member' | 'guest' | 'event';

export const EVENT_SEAT = 'event' as const;

/** Unknown values read as guest, the narrower of the two clan kinds. */
export function seatKindOf(v: string | null | undefined): SeatKind {
  return v === 'member' ? 'member' : v === 'event' ? 'event' : 'guest';
}

export function isEventSeat(seat: { kind?: string | null } | null | undefined): boolean {
  return seat?.kind === EVENT_SEAT;
}

/** A seat that makes somebody part of the clan (member or guest) — never an event player's. */
export function isClanSeat(seat: { kind?: string | null } | null | undefined): boolean {
  return !!seat && seat.kind !== EVENT_SEAT;
}

/** May this seat play this event? Member and guest seats: any of the clan's. Event seats: their one. */
export function seatOpensEvent(seat: { kind?: string | null; eventId?: number | null }, eventId: number): boolean {
  if (seat.kind !== EVENT_SEAT) return true;
  return seat.eventId != null && seat.eventId === eventId;
}

/**
 * The word for a seat, as a person reads it. A creator space has no members, so its outsiders are
 * "players"; a clan's event players are "viewers".
 */
export function seatWord(kind: string | null | undefined, clanKind?: string | null): 'member' | 'guest' | 'viewer' | 'player' {
  const k = seatKindOf(kind);
  if (k === 'member') return 'member';
  if (clanKind === 'creator') return 'player';
  return k === 'event' ? 'viewer' : 'guest';
}

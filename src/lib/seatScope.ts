// The seat-kind filters as SQL (the rules: lib/seatKinds). No database client — only the schema —
// so any module may use them.
//
// `clanSeat` / `rosterClanSeat`: member and guest seats, never an event player's. The filter for
// every question about belonging to a clan — rosters, guest lists, counts, Discord roles, feeds,
// weeklies, the clan's own pages, "the" seat an account holds in a clan.
//
// `seatOpensEventSql` / `rosterSeatOpensEventSql`: the seats that may play ONE event — a clan seat,
// or an event seat naming that event.

import { eq, ne, or, type SQL } from 'drizzle-orm';

import { clanMemberships, clanRoster } from '@/db/schema';

/** clan_memberships: member and guest seats only. */
export function clanSeat(): SQL {
  return ne(clanMemberships.kind, 'event');
}

/** clan_roster (the view): member and guest seats only. */
export function rosterClanSeat(): SQL {
  return ne(clanRoster.kind, 'event');
}

/** clan_memberships: seats that may play this event. */
export function seatOpensEventSql(eventId: number): SQL {
  return or(ne(clanMemberships.kind, 'event'), eq(clanMemberships.eventId, eventId))!;
}

/** clan_roster (the view): seats that may play this event. */
export function rosterSeatOpensEventSql(eventId: number): SQL {
  return or(ne(clanRoster.kind, 'event'), eq(clanRoster.eventId, eventId))!;
}

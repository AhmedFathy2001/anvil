import { sql, type SQL } from 'drizzle-orm';

// Which guests a weekly sweeps in: weekly_competitions.include_guests.
//   0 'off'  — members only;
//   1 'all'  — every guest seat too;
//   2 'alts' — only a guest who is SOMEBODY'S ALT: the same person holds a member seat in that clan.
// Stored in the integer the on/off switch always used, so nothing needs migrating: every check that
// asked "=== 1" for "guests are in" now asks guestsIn(), and 2 reads as "in" wherever a guest that
// was swept in is being judged (it was only swept in because it is an alt).

export type GuestMode = 'off' | 'all' | 'alts';
export const GUEST_MODE_VALUE: Record<GuestMode, number> = { off: 0, all: 1, alts: 2 };

export function guestMode(v: number | null | undefined): GuestMode {
  return v === 1 ? 'all' : v === 2 ? 'alts' : 'off';
}
/** Any guests at all race (all, or alts only). */
export const guestsIn = (v: number | null | undefined) => guestMode(v) !== 'off';

/**
 * A guest seat whose person also has a member seat, still in, in the same clan. Correlated on the
 * OUTER clan_roster row by its qualified name (a `${clanRoster.col}` would render bare and match the
 * subquery's own row — see the drizzle correlated-subquery note).
 */
export const isMemberAltSql = (): SQL =>
  sql`(${sql.raw('"clan_roster"."kind"')} = 'guest' and ${sql.raw('"clan_roster"."player_id"')} is not null and exists (
    select 1 from clan_roster m
    where m.clan_id = ${sql.raw('"clan_roster"."clan_id"')}
      and m.player_id = ${sql.raw('"clan_roster"."player_id"')}
      and m.kind = 'member'
      and m.left_at is null))`;

/** The roster seats a sweep may enter under this setting (member seats always). */
export function sweepSeatsSql(includeGuests: number | null | undefined): SQL | undefined {
  const mode = guestMode(includeGuests);
  if (mode === 'all') return undefined;
  if (mode === 'alts') return sql`(${sql.raw('"clan_roster"."kind"')} = 'member' or ${isMemberAltSql()})`;
  return sql`${sql.raw('"clan_roster"."kind"')} = 'member'`;
}

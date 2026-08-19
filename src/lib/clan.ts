import { db } from '@/db';
import { accounts, clanMemberships, clanRoster } from '@/db/schema';
import { findOrCreateAccount, findOrCreateSeat, findRosterSeat } from '@/lib/roster';
import { isBannedFromClan } from '@/lib/clanBans';
import { and, eq } from 'drizzle-orm';
import { normalizeRsn, sanitizeRsn } from '@/lib/auth';

/**
 * Seat an RSN on a clan's roster, creating the account behind it if it is new. Returns the seat id.
 *
 * Used by enrollment flows (bingo player creation, weekly participant enrollment) so the roster
 * stays in sync with per-event rosters even before the plugin has done a proper clan-sync.
 *
 * Seats as a GUEST unless told otherwise: entering an event is not joining a clan. Only the in-game
 * roster sync, or an admin saying so, makes someone a member.
 */
export async function findOrCreateClanMember(
  clanId: number,
  rsn: string,
  options: { discordId?: string | null; asGuest?: boolean } = {},
): Promise<number> {
  const trimmed = sanitizeRsn(rsn);
  if (!trimmed) throw new Error('rsn is required');

  const normalized = normalizeRsn(trimmed);
  // Scoped to the clan: the same RSN is legitimately on several clans' rosters, so a global lookup
  // would hand one clan another clan's member row.
  const existing = await findRosterSeat(and(eq(clanRoster.clanId, clanId), eq(clanRoster.rsnNormalized, normalized)));

  if (existing) {
    // The Discord id is a fact about the account; whether they have left is a fact about the seat.
    if (options.discordId && !existing.discordId) {
      await db.update(accounts).set({ discordId: options.discordId }).where(eq(accounts.id, existing.accountId));
    }
    // A live clan ban keeps the seat departed. Without this the ban is decorative: the next thing
    // that touches this row puts them straight back on the roster.
    if (existing.leftAt && !(await isBannedFromClan(clanId, existing.playerId))) {
      await db.update(clanMemberships).set({ leftAt: null }).where(eq(clanMemberships.id, existing.id));
    }
    return existing.id;
  }

  const account = await findOrCreateAccount({ rsn: trimmed, rsnNormalized: normalized });
  if (options.discordId) {
    await db.update(accounts).set({ discordId: options.discordId }).where(eq(accounts.id, account.id));
  }
  return findOrCreateSeat(clanId, account.id, {
    kind: options.asGuest === false ? 'member' : 'guest',
    source: 'admin',
  });
}

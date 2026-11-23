// A character left behind by "Delete me" (lib/erasePerson) has no public page.
//
// Its clans keep the name on their roster and in their history, but the person asked to be gone, so
// nothing public opens it: /p/<rsn>, its cards, player search and the platform leaderboard answer as
// for a name Anvil has never seen. `accounts.erased_at` marks it; a later claim of the same RSN
// (claimed_at set again) is a new owner, so the mark only counts while the character is unclaimed.
// Ordinary unclaimed roster placeholders never carry the mark and stay public.

import { sql } from 'drizzle-orm';

/** The pure form, for a row already read. */
export function isErasedStandIn(row: { erasedAt: string | null; claimedAt: string | null }): boolean {
  return row.erasedAt != null && row.claimedAt == null;
}

/**
 * True for a row of `accounts` that is NOT an erased stand-in. Written against the table's own name,
 * like lib/bannedPeople ownerNotBanned, so it belongs only in queries that read `accounts` unaliased.
 */
export const notErasedStandIn = sql`not ("accounts"."erased_at" is not null and "accounts"."claimed_at" is null)`;

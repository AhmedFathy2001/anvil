// Whose character is the plugin logged into? The read behind the sidebar's account row and the
// three actions on it (POST /api/plugin/account).
//
// The token names a LOGIN; X-RSN / X-Account-Hash name the CHARACTER. Everything here asks about the
// pair without claiming, linking or verifying anything — that stays with resolvePluginMember on a
// normal request — so the "Not my account" button can never itself link the account it is refusing.

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, detectedAccounts } from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { personOf } from '@/lib/roster';

/**
 * - `yours`: claimed by this login's person.
 * - `other`: claimed by somebody else — the plugin says so instead of tracking nothing in silence.
 * - `ignored`: this login let go of it (Not my account / Remove); nothing is sent for it.
 * - `unclaimed`: nobody's yet; the next normal request links it.
 */
export type AccountStanding = 'yours' | 'other' | 'ignored' | 'unclaimed';

export type PlayedCharacter = {
  rsn: string;
  rsnNormalized: string;
  accountHash: string | null;
};

/** The character named by this request's headers, or null with no X-RSN (the hint never counts). */
export function playedCharacter(request: Request): PlayedCharacter | null {
  const rsn = request.headers.get('X-RSN')?.trim();
  if (!rsn) return null;
  const rsnNormalized = normalizeRsn(rsn);
  if (!rsnNormalized) return null;
  return { rsn, rsnNormalized, accountHash: request.headers.get('X-Account-Hash')?.trim() || null };
}

/** The account row for this character: by hash first (rename-proof), then by name. */
export async function accountForCharacter(c: PlayedCharacter) {
  if (c.accountHash) {
    const byHash = await db.query.accounts.findFirst({ where: eq(accounts.accountHash, c.accountHash) });
    if (byHash) return byHash;
  }
  return (await db.query.accounts.findFirst({ where: eq(accounts.rsnNormalized, c.rsnNormalized) })) ?? null;
}

export async function accountStanding(userId: number, c: PlayedCharacter): Promise<AccountStanding> {
  const [account, me, ignored] = await Promise.all([
    accountForCharacter(c),
    personOf(userId),
    db.query.detectedAccounts.findFirst({
      where: and(
        eq(detectedAccounts.userId, userId),
        eq(detectedAccounts.rsnNormalized, c.rsnNormalized),
        eq(detectedAccounts.status, 'dismissed'),
      ),
      columns: { id: true },
    }),
  ]);
  if (account?.claimedAt != null) {
    return me != null && account.playerId === me ? 'yours' : 'other';
  }
  return ignored ? 'ignored' : 'unclaimed';
}

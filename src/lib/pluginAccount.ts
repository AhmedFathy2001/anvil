// Whose character is the plugin logged into? The read behind the sidebar's account row and the
// three actions on it (POST /api/plugin/account).
//
// The token names a LOGIN; X-RSN / X-Account-Hash name the CHARACTER. Everything here asks about the
// pair without claiming, linking or verifying anything — that stays with resolvePluginMember on a
// normal request — so the "Not my account" button can never itself link the account it is refusing.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, detectedAccounts } from '@/db/schema';
import { isPlausibleRsn, normalizeRsn, resolvePluginMember, sanitizeRsn, verifyPluginTokenUser } from '@/lib/auth';
import { personOf } from '@/lib/roster';
import { IGNORED_STATUSES } from '@/lib/accountRelease';

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
  // A mid-login placeholder ("#Player2014") is not a character (see resolvePluginMember).
  if (!rsn || !isPlausibleRsn(sanitizeRsn(rsn))) return null;
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
        inArray(detectedAccounts.status, [...IGNORED_STATUSES]),
      ),
      columns: { id: true },
    }),
  ]);
  if (account?.claimedAt != null) {
    return me != null && account.playerId === me ? 'yours' : 'other';
  }
  return ignored ? 'ignored' : 'unclaimed';
}

/**
 * Who a profile-data push (collection log, personal bests) is about: the clan seat when there is one,
 * else a character this token owns outright. Those tables are keyed by the CHARACTER, not the seat,
 * and the site keeps a person's log and records with no clan anywhere — so requiring a seat here
 * meant a solo player's log never reached their profile (and their luck tab stayed empty). Same rule
 * the stats push already falls back to: the character must be `yours`, never merely unclaimed.
 */
export async function resolvePluginCharacter(request: Request): Promise<{ userId: number; accountId: number } | null> {
  const member = await resolvePluginMember(request);
  if (member) return { userId: member.userId, accountId: member.accountId };
  const viewer = await verifyPluginTokenUser(request);
  const character = playedCharacter(request);
  if (!viewer || !character) return null;
  if ((await accountStanding(viewer.userId, character)) !== 'yours') return null;
  const account = await accountForCharacter(character);
  return account ? { userId: viewer.userId, accountId: account.id } : null;
}

import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanRoster, clans, detectedAccounts } from '@/db/schema';
import { rosterClanSeat } from '@/lib/seatScope';

/**
 * Reads for /settings — the one page where a person changes things about themselves and their
 * characters. Everything here is keyed by the PERSON (session.playerId) and never by a clan: the
 * page is not inside one, and the settings it gathers were split across clans precisely because
 * each page only knew about the clan it was in.
 */

export interface SettingsCharacter {
  accountId: number;
  rsn: string;
  rsnNormalized: string;
  accountHash: string | null;
  isPrimary: boolean;
  shared: boolean;
  accountType: string | null;
  verified: boolean;
  verificationMethod: string | null;
  provisional: boolean;
}

/** The person's characters, main first, then by name. */
export async function settingsCharacters(playerId: number): Promise<SettingsCharacter[]> {
  const rows = await db
    .select({
      accountId: accounts.id,
      rsn: accounts.rsn,
      rsnNormalized: accounts.rsnNormalized,
      accountHash: accounts.accountHash,
      isPrimary: accounts.isPrimary,
      shared: accounts.shared,
      accountType: accounts.accountType,
      verifiedAt: accounts.verifiedAt,
      verificationMethod: accounts.verificationMethod,
      provisional: accounts.provisional,
    })
    .from(accounts)
    .where(eq(accounts.playerId, playerId))
    .orderBy(desc(accounts.isPrimary), asc(accounts.rsnNormalized));
  return rows.map((r) => ({
    accountId: r.accountId,
    rsn: r.rsn,
    rsnNormalized: r.rsnNormalized,
    accountHash: r.accountHash,
    isPrimary: r.isPrimary === 1,
    shared: !!r.shared,
    accountType: r.accountType,
    verified: r.verifiedAt != null,
    verificationMethod: r.verificationMethod,
    provisional: r.provisional === 1,
  }));
}

export interface CharacterSeat {
  seatId: number;
  clanId: number;
  clanName: string;
  clanSlug: string;
  clanKind: string;
  kind: 'member' | 'guest';
  joinedAt: string | null;
  /**
   * A member seat the in-game roster holds open. Leaving it from the site would not stick — the
   * next roster sync puts it back — so the page says so instead of offering a button that lies.
   */
  heldByRoster: boolean;
}

/** One character's live seats, member first. */
export async function characterSeats(accountId: number): Promise<CharacterSeat[]> {
  // clan-scope: global -- the subject is one of the caller's own characters, whose seats span clans by design.
  const rows = await db
    .select({
      seatId: clanRoster.id,
      clanId: clanRoster.clanId,
      kind: clanRoster.kind,
      source: clanRoster.source,
      joinedAt: clanRoster.joinedAt,
      clanName: clans.name,
      clanSlug: clans.slug,
      clanKind: clans.kind,
    })
    .from(clanRoster)
    .innerJoin(clans, eq(clans.id, clanRoster.clanId))
    // Member and guest seats: an event player's seat is not a seat in the clan (and would read as "guest").
    .where(and(eq(clanRoster.accountId, accountId), isNull(clanRoster.leftAt), rosterClanSeat()));
  return rows
    .map((r) => ({
      seatId: r.seatId,
      clanId: r.clanId,
      clanName: r.clanName,
      clanSlug: r.clanSlug,
      clanKind: r.clanKind ?? 'clan',
      kind: (r.kind === 'member' ? 'member' : 'guest') as 'member' | 'guest',
      joinedAt: r.joinedAt ?? null,
      heldByRoster: r.kind === 'member' && r.source === 'roster',
    }))
    .sort((a, b) => (a.kind === b.kind ? a.clanName.localeCompare(b.clanName) : a.kind === 'member' ? -1 : 1));
}

export interface DetectedRow {
  id: number;
  rsn: string;
  lastSeenAt: string;
}

/**
 * Characters the plugin saw this login play that aren't theirs yet — pending (the inbox) and
 * dismissed/released (the ignore list) — minus anything they already own.
 */
export async function detectedFor(userId: number, owned: SettingsCharacter[]): Promise<{ pending: DetectedRow[]; ignored: DetectedRow[] }> {
  const rows = await db.query.detectedAccounts.findMany({
    where: eq(detectedAccounts.userId, userId),
    orderBy: (d, { desc: d2 }) => [d2(d.lastSeenAt)],
  });
  const rsns = new Set(owned.map((a) => a.rsnNormalized));
  const hashes = new Set(owned.map((a) => a.accountHash).filter(Boolean) as string[]);
  const notOwned = rows.filter((d) => !rsns.has(d.rsnNormalized) && !(d.accountHash && hashes.has(d.accountHash)));
  const view = (d: (typeof rows)[number]) => ({ id: d.id, rsn: d.rsn, lastSeenAt: d.lastSeenAt });
  return {
    pending: notOwned.filter((d) => d.status === 'pending').map(view),
    ignored: notOwned.filter((d) => d.status === 'dismissed' || d.status === 'released').map(view),
  };
}

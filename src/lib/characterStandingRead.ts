// Loads what lib/characterStanding words: a person's live seats, and when each clan's in-game
// member list last reached Anvil (the `last_clan_sync` setting the plugin's clan-sync stamps on
// every push, changed or not).

import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanMemberships, clans } from '@/db/schema';
import { getSetting } from '@/lib/settings';
import { clanSeat } from '@/lib/seatScope';
import { standingLine, type StandingSeat } from '@/lib/characterStanding';

/** accountId's live seats as the clan choices "Wrong clan? Tell Anvil" offers — member first. */
export function clanOptionsFor(seats: StandingSeat[], accountId: number): { clanId: number; name: string; kind: 'member' | 'guest' }[] {
  return seats
    .filter((s) => s.accountId === accountId)
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'member' ? -1 : 1))
    .map((s) => ({ clanId: s.clanId, name: s.clanName, kind: s.kind }));
}

export interface CharacterStandings {
  /** Every live seat on these characters, newest clan name order. */
  seats: StandingSeat[];
  /** accountId → the one-line standing. Every requested account has an entry. */
  lineByAccount: Map<number, string>;
}

export async function characterStandings(accountIds: number[], nowMs: number): Promise<CharacterStandings> {
  const lineByAccount = new Map<number, string>();
  if (accountIds.length === 0) return { seats: [], lineByAccount };

  // clan-scope: global -- the subject is the person's own characters, whose seats span clans by design.
  const rows = await db
    .select({
      seatId: clanMemberships.id,
      accountId: clanMemberships.accountId,
      kind: clanMemberships.kind,
      clanId: clanMemberships.clanId,
      clanName: clans.name,
      clanSlug: clans.slug,
      clanKind: clans.kind,
    })
    .from(clanMemberships)
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    // Member and guest seats only: an event player's seat is no standing in the clan (and would read as "guest").
    .where(and(inArray(clanMemberships.accountId, accountIds), isNull(clanMemberships.leftAt), clanSeat()))
    .orderBy(clans.name);
  const seats: StandingSeat[] = rows.map(({ clanKind, ...r }) => ({
    ...r,
    kind: r.kind === 'member' ? 'member' : 'guest',
    creator: clanKind === 'creator',
  }));

  const memberClanIds = [...new Set(seats.filter((s) => s.kind === 'member').map((s) => s.clanId))];
  const lastSyncByClan = new Map<number, string | null>();
  await Promise.all(
    memberClanIds.map(async (clanId) => {
      const raw = await getSetting(clanId, 'last_clan_sync').catch(() => null);
      let at: string | null = null;
      try {
        at = raw ? ((JSON.parse(raw) as { at?: string }).at ?? null) : null;
      } catch {
        at = null;
      }
      lastSyncByClan.set(clanId, at);
    }),
  );

  for (const id of accountIds) {
    lineByAccount.set(id, standingLine(seats.filter((s) => s.accountId === id), lastSyncByClan, nowMs));
  }
  return { seats, lineByAccount };
}

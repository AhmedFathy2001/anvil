import { and, eq, gte } from 'drizzle-orm';

import { db } from '@/db';
import { accountGameClans, clanMemberships, clans, gameClans } from '@/db/schema';
import { GAME_CLAN_STALE_DAYS, gameClanKey } from '@/lib/gameClanReport';

// WHOSE COFFER DID THIS PLUGIN JUST READ?
//
// The in-game Clan Coffer interface shows the coffer of the clan the CHARACTER is in. The plugin reads
// it and sends the balance; the site used to file that under whichever clan the character holds a
// seat in. A guest holds a seat too, and a guest's own clan is somewhere else: AndyIsAFK, a guest of
// The AFK Spot whose in-game clan is not on Anvil at all, opened his own clan's coffer and its 20m
// balance and a 5m deposit landed in The AFK Spot's coffer queue.
//
// So a reading counts for a clan only when the character is in THAT clan in game:
//   - the plugin's own report of the character's in-game clan (lib/gameClans, sent at login) names
//     it. A report that names another clan refuses the reading, whatever seat they hold.
//   - with no fresh report (an older plugin), only a member seat counts. A guest never reads the
//     coffer of the clan they are a guest of.

export type CofferReaderVerdict = { ok: true } | { ok: false; why: 'guest' | 'other-clan' };

/** Pure. `clanInGameName` is the clan's own in-game name; `reportedKey` the character's reported one (null: none fresh). */
export function mayReadCofferFor(seatKind: string | null, clanInGameName: string | null, reportedKey: string | null): CofferReaderVerdict {
  if (reportedKey != null) {
    // A clan with no in-game name on record cannot be matched: fall back to the seat.
    if (clanInGameName && gameClanKey(clanInGameName) !== reportedKey) return { ok: false, why: 'other-clan' };
    if (clanInGameName) return { ok: true };
  }
  return seatKind === 'member' ? { ok: true } : { ok: false, why: 'guest' };
}

export async function cofferReaderVerdict(member: { clanId: number; clanMemberId: number; accountId: number }, now: number = Date.now()): Promise<CofferReaderVerdict> {
  // The same window a reported in-game clan stands for everywhere else (lib/gameClans).
  const since = new Date(now - GAME_CLAN_STALE_DAYS * 86_400_000).toISOString();
  // clan-scope: global -- the caller's own seat and character, by the ids resolvePluginMember proved are theirs.
  const [[seat], [clan], [report]] = await Promise.all([
    db.select({ kind: clanMemberships.kind }).from(clanMemberships).where(and(eq(clanMemberships.id, member.clanMemberId), eq(clanMemberships.clanId, member.clanId))).limit(1),
    db.select({ inGameName: clans.inGameName }).from(clans).where(eq(clans.id, member.clanId)).limit(1),
    db
      .select({ key: gameClans.nameKey })
      .from(accountGameClans)
      .innerJoin(gameClans, eq(gameClans.id, accountGameClans.gameClanId))
      .where(and(eq(accountGameClans.accountId, member.accountId), gte(accountGameClans.observedAt, since)))
      .limit(1),
  ]);
  return mayReadCofferFor(seat?.kind ?? null, clan?.inGameName ?? null, report?.key ?? null);
}

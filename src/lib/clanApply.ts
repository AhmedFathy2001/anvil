import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships } from '@/db/schema';

export interface ApplyChoices {
  /** Every character this person has already holds a seat here — there is nothing to ask for. */
  alreadyIn: boolean;
  /** Their verified characters with no seat here: what they could apply with. */
  options: { id: number; rsn: string }[];
}

/**
 * What a signed-in person could apply to a clan with.
 *
 * "Already in" is about THEIR characters, and only theirs. It used to be "no options, and the clan
 * has anybody seated at all" — which is true of every real clan, so a newcomer with no verified
 * character was told, by silence, that they were already a member: the guest panel on the clan home
 * rendered no button. Someone with no characters is not in; they have something to fix first.
 */
export async function applyChoices(clanId: number, playerId: number): Promise<ApplyChoices> {
  const mine = await db
    .select({ id: accounts.id, rsn: accounts.rsn, verifiedAt: accounts.verifiedAt })
    .from(accounts)
    .where(eq(accounts.playerId, playerId));
  if (mine.length === 0) return { alreadyIn: false, options: [] };

  const seated = await db
    .select({ accountId: clanMemberships.accountId })
    .from(clanMemberships)
    .where(
      and(
        eq(clanMemberships.clanId, clanId),
        isNull(clanMemberships.leftAt),
        inArray(clanMemberships.accountId, mine.map((a) => a.id)),
      ),
    );
  const seatedIds = new Set(seated.map((r) => r.accountId));

  return {
    alreadyIn: mine.every((a) => seatedIds.has(a.id)),
    options: mine
      .filter((a) => a.verifiedAt != null && !seatedIds.has(a.id))
      .map((a) => ({ id: a.id, rsn: a.rsn })),
  };
}

// /portal's reads: everything one person pays for on Anvil (rules: lib/billingPortalCards).
//
//   - the clans they OWN (a `clan_staff` owner row — billing is the owner's alone),
//   - the creator spaces they own, in creator terms,
//   - their own Anvil Supporter membership (lib/supporter), which belongs to the login.

import { and, count, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanMemberships, clanStaff, clans } from '@/db/schema';
import { clanCardModel, creatorCardModel, type BillingCardModel, type OwnedBillingRow } from '@/lib/billingPortalCards';
import { biggestCreatorEvent } from '@/lib/creatorPlansDb';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { supporterForUser, supporterSubscriptionIdForUser, type SupporterState } from '@/lib/supporter';

export interface BillingPortal {
  clans: BillingCardModel[];
  spaces: BillingCardModel[];
  supporter: SupporterState | null;
  /** The Gumroad membership behind the Supporter tier, when there is one to manage. */
  supporterSubscriptionId: string | null;
}

export async function billingPortalForUser(userId: number, now = Date.now()): Promise<BillingPortal> {
  // clan-scope: global -- the clans this person owns, whichever they are; ownership is the filter.
  const owned: OwnedBillingRow[] = await db
    .select({
      id: clans.id,
      slug: clans.slug,
      name: clans.name,
      kind: clans.kind,
      plan: clans.plan,
      trialEndsAt: clans.trialEndsAt,
      currentPeriodEnd: clans.currentPeriodEnd,
      cancelAtPeriodEnd: clans.cancelAtPeriodEnd,
      subscriptionId: clans.gumroadSubscriptionId,
      gumroadRef: clans.gumroadRef,
    })
    .from(clanStaff)
    .innerJoin(clans, eq(clans.id, clanStaff.clanId))
    .where(and(eq(clanStaff.userId, userId), eq(clanStaff.role, 'owner')))
    .orderBy(clans.name);

  const ownedClans = owned.filter((c) => !isCreatorSpace(c));
  const ownedSpaces = owned.filter((c) => isCreatorSpace(c));

  // Active member seats per owned clan, in one grouped pass.
  const counts = new Map<number, number>();
  if (ownedClans.length > 0) {
    // clan-scope: global -- member counts of the clans listed above, by their ids.
    const rows = await db
      .select({ clanId: clanMemberships.clanId, n: count() })
      .from(clanMemberships)
      .where(and(inArray(clanMemberships.clanId, ownedClans.map((c) => c.id)), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)))
      .groupBy(clanMemberships.clanId);
    for (const r of rows) counts.set(r.clanId, Number(r.n));
  }

  const [spaces, supporter, supporterSubscriptionId] = await Promise.all([
    Promise.all(ownedSpaces.map(async (c) => creatorCardModel(c, await biggestCreatorEvent(c.id, now), now))),
    supporterForUser(userId),
    supporterSubscriptionIdForUser(userId, now),
  ]);

  return {
    clans: ownedClans.map((c) => clanCardModel(c, counts.get(c.id) ?? 0, now)),
    spaces,
    supporter,
    supporterSubscriptionId,
  };
}

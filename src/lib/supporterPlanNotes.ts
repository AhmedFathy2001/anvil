// What a person's own plan page says beyond their tier (components/SupporterPlanNotes): a trial from
// Anvil, gifts from Anvil, a membership waiting for its first charge, and two memberships at once.

import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { ownerTrials, supporterSubscriptions } from '@/db/schema';
import { supporterBuy } from '@/lib/buyOffer';
import { daysLeft, trialPhase, type BuyButtons, type TrialPhase } from '@/lib/planTrialRules';
import { supporterTrialUsed } from '@/lib/supporterBilling';
import { membershipsToCancel, type MembershipToCancel } from '@/lib/supporterDuplicates';
import { giftLinesForUser } from '@/lib/supporterGifts';
import { HELD_STATUS, SUPPORTER_TIERS, rowInForce, type SupporterTierId } from '@/lib/supporterTiers';

export interface SupporterPlanNotes {
  /** Their trial from Anvil, while it runs and for the grace days after. */
  trial: { tierName: string; tier: SupporterTierId; endsAt: number; phase: Exclude<TrialPhase, 'none'>; daysLeft: number; remindRequested: boolean; monthlyUsd: number } | null;
  /** "A gift from Anvil: Champion until 14 Mar 2027." / "3 months of Champion added by Anvil, starting when your membership ends." */
  giftLines: string[];
  /** A membership Gumroad started with a free trial after they had already had one. */
  held: { tierName: string; startsAt: string | null; subscriptionId: string | null } | null;
  toCancel: MembershipToCancel[];
  /** They pay for a membership that is set to renew (an upgrade would be a second one). */
  paying: boolean;
  trialUsed: boolean;
  buttons: BuyButtons;
}

export async function supporterPlanNotes(userId: number, now = Date.now()): Promise<SupporterPlanNotes> {
  const [rows, trialRows, giftLines, trialUsed] = await Promise.all([
    db.select().from(supporterSubscriptions).where(eq(supporterSubscriptions.userId, userId)),
    db
      .select()
      .from(ownerTrials)
      .where(and(eq(ownerTrials.kind, 'supporter'), eq(ownerTrials.userId, userId), isNull(ownerTrials.revokedAt)))
      .orderBy(desc(ownerTrials.endsAt))
      .limit(1),
    giftLinesForUser(userId, now),
    supporterTrialUsed(userId),
  ]);
  const paidRows = rows.filter((r) => !!r.gumroadSubscriptionId && (r.status === 'active' || r.status === 'cancelling') && rowInForce(r, now));
  const paidRank = Math.max(0, ...paidRows.map((r) => SUPPORTER_TIERS[r.tier as SupporterTierId]?.rank ?? 0));

  const t = trialRows[0];
  let trial: SupporterPlanNotes['trial'] = null;
  if (t && t.tier in SUPPORTER_TIERS) {
    const tier = SUPPORTER_TIERS[t.tier as SupporterTierId];
    const phase = trialPhase({ endsAt: t.endsAt.getTime(), revoked: false }, paidRank >= tier.rank, now);
    if (phase !== 'none') {
      trial = { tierName: tier.name, tier: tier.id, endsAt: t.endsAt.getTime(), phase, daysLeft: daysLeft(t.endsAt.getTime(), now), remindRequested: t.remindRequestedAt != null, monthlyUsd: tier.monthlyUsd };
    }
  }
  const heldRow = rows.find((r) => r.status === HELD_STATUS && r.tier in SUPPORTER_TIERS);
  return {
    trial,
    // A running trial is said by its own card, not again as a gift.
    giftLines: trial && trial.phase !== 'just-ended' ? giftLines.filter((l) => !l.startsWith(`A gift from Anvil: ${trial.tierName} `)) : giftLines,
    held: heldRow ? { tierName: SUPPORTER_TIERS[heldRow.tier as SupporterTierId].name, startsAt: heldRow.currentPeriodEnd, subscriptionId: heldRow.gumroadSubscriptionId } : null,
    toCancel: membershipsToCancel(rows),
    paying: paidRows.some((r) => r.status === 'active'),
    trialUsed,
    buttons: supporterBuy(trialUsed),
  };
}

/** "Remind me when the trial ends", on the person's own running Supporter trial. */
export async function requestSupporterTrialReminder(userId: number, now = Date.now()): Promise<boolean> {
  const [t] = await db
    .select({ id: ownerTrials.id, endsAt: ownerTrials.endsAt })
    .from(ownerTrials)
    .where(and(eq(ownerTrials.kind, 'supporter'), eq(ownerTrials.userId, userId), isNull(ownerTrials.revokedAt)))
    .orderBy(desc(ownerTrials.endsAt))
    .limit(1);
  if (!t || t.endsAt.getTime() <= now) return false;
  await db.update(ownerTrials).set({ remindRequestedAt: new Date(now) }).where(eq(ownerTrials.id, t.id));
  return true;
}

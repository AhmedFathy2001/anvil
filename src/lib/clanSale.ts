// What a new Gumroad SALE does to the clan or creator space it was matched to.
//
// Lifted out of the webhook (api/webhooks/gumroad) unchanged, so that staff attaching an unmatched
// purchase by hand (lib/unmatchedPurchases) applies exactly what the webhook would have for a sale that
// had matched — the same plan read, the same trial rules, the same ids written — rather than a second
// copy that drifts. The webhook still decides WHETHER a sale applies (match, catalogue, replay latch,
// Gumroad's own word on the sale); this is only what applying it means.

import { refundUnusedTrial } from '@/lib/trialRefund';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { track } from '@/lib/analytics';
import { clanAuditLog, clans } from '@/db/schema';
import { nextChargeDue, trialEndWithGumroad, TRIAL_DAYS, type GumroadEvent } from '@/lib/gumroad';
import { logBilling } from '@/lib/billingLapse';
import { runOnPaid } from '@/lib/clanTenure';
import { billingTierOf, catalogOfKind, entryTierFor, gumroadPurchase, isNowPlanProduct, type BillingTier } from '@/lib/billingCatalog';
import { extraForClanSubscription, noteToCancel, noteWaiting, resolveExtraBySubscription } from '@/lib/extraMemberships';
import { hadMembership, hadPlanTrial } from '@/lib/planTrials';
import { tierRankOf, usedTrialHold } from '@/lib/planTrialRules';

type Clan = typeof clans.$inferSelect;

/**
 * Was this clan's suspension billing's doing? The latest status-bearing entry in its log decides: a
 * refund or dispute suspension may be lifted by paying, anything staff did may not.
 */
async function suspendedByBilling(clanId: number): Promise<boolean> {
  const [last] = await db
    .select({ eventType: clanAuditLog.eventType })
    .from(clanAuditLog)
    .where(
      and(
        eq(clanAuditLog.clanId, clanId),
        inArray(clanAuditLog.eventType, ['billing_refund', 'billing_dispute', 'platform_clan_updated']),
      ),
    )
    .orderBy(desc(clanAuditLog.id))
    .limit(1);
  return last?.eventType === 'billing_refund' || last?.eventType === 'billing_dispute';
}

/**
 * When a charge happened, by Gumroad's own stamp; now if it sent none or one we can't read. Never
 * later than now: the stamp is body text, and one dated ahead would push the due date out of reach of
 * the daily lapse check (lib/billingLapse). Earlier only makes a clan due sooner, which is safe.
 */
export function chargedAt(stamp: string | null): number {
  const ms = stamp ? Date.parse(stamp) : NaN;
  return Number.isFinite(ms) ? Math.min(ms, Date.now()) : Date.now();
}

/**
 * The trial end shown when Gumroad could not be asked and the notification named none: the products'
 * configured trial (TRIAL_DAYS), and with that at 0 (Gumroad's trial is off) NO trial. Display only:
 * a guessed trial never holds a plan back (see `trialKnown` below).
 */
export function guessedTrialEnd(now = Date.now(), days = TRIAL_DAYS): string | null {
  return days > 0 ? new Date(now + days * 86400_000).toISOString() : null;
}

/**
 * The tier a HELD sale bought (held until its first charge, above), for the membership that is now
 * the clan's own: read back from the entry that recorded the hold, so the first charge applies what
 * was bought and not a tier re-derived from the charge notification (which may name none). Null when
 * this membership was never held.
 */
export async function heldTierFor(clanId: number, kind: string, subscriptionId: string | null): Promise<BillingTier | null> {
  if (!subscriptionId) return null;
  const rows = await db
    .select({ newValue: clanAuditLog.newValue })
    .from(clanAuditLog)
    .where(and(eq(clanAuditLog.clanId, clanId), eq(clanAuditLog.eventType, 'billing_subscribed')))
    .orderBy(desc(clanAuditLog.id))
    .limit(20);
  for (const r of rows) {
    try {
      const v = JSON.parse(r.newValue ?? '{}') as { plan?: string; subscription?: string; held?: string };
      if (v.subscription !== subscriptionId) continue;
      if (!v.held || !v.plan) return null;
      const tier = billingTierOf(kind, v.plan);
      return tier.free ? null : tier;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * The tier actually bought, from the row's own catalogue: the product / tier name Gumroad sent
 * (lib/billingCatalog gumroadPurchase), else the fallback. Only ever called once the catalogue check
 * has cleared the notification, so a purchase from the other catalogue never reaches here.
 */
export function purchasedPlan(ev: GumroadEvent, kind: string, fallback: BillingTier): BillingTier {
  const bought = gumroadPurchase(ev);
  return bought && bought.catalog === catalogOfKind(kind) ? bought.tier : fallback;
}

/**
 * Apply a new sale to the clan it was matched to. Returns the webhook's JSON answer: `plan` when the
 * plan was applied, `note` when it was held or recorded only.
 *
 * `notes` goes on the billing audit entries — the webhook's own by default; a staff attach says so.
 */
export async function applyClanSale(
  clan: Clan,
  ev: GumroadEvent,
  notes = 'gumroad webhook',
  /** Staff attaching an unmatched purchase who CONFIRMED replacing the space's live membership: rule (b) below does not second-guess them. */
  opts: { replaceConfirmed?: boolean } = {},
): Promise<{ received: true; plan?: string; note?: string }> {
  const current = billingTierOf(clan.kind, clan.plan);
  const plan = purchasedPlan(ev, clan.kind, current.free ? entryTierFor(clan.kind) : current);
  const ownMembership = !!clan.gumroadSubscriptionId && clan.gumroadSubscriptionId === ev.subscriptionId;

  // THE LATEST SALE DOES NOT ALWAYS WIN.
  // (a) A sale for a membership this clan already holds as the extra one to cancel (the older one
  //     after an upgrade): a redelivered notification. Applying it put the clan back on the old tier
  //     and marked the tier it had just bought as the one to cancel. Recorded and ignored.
  const known = ownMembership ? null : await extraForClanSubscription(clan.id, ev.subscriptionId);
  if (known?.state === 'to_cancel') {
    await logBilling(clan.id, 'billing_duplicate_replay', { plan: plan.id, subscription: ev.subscriptionId, sale: ev.saleId, kept: clan.gumroadSubscriptionId }, notes);
    return { received: true, note: 'older membership, not applied' };
  }
  // (b) A LOWER (or the same) tier bought while a higher membership is live: the higher one stays the
  //     clan's plan, and the new one is the extra membership to cancel. Two tiers in one cart end on
  //     the higher whichever notification arrives first. Not while the live one is already cancelled:
  //     then the purchase is its replacement and applies (see the report on that case).
  const liveOther = !current.free && !!clan.gumroadSubscriptionId && !ownMembership;
  if (liveOther && !opts.replaceConfirmed && !clan.cancelAtPeriodEnd && tierRankOf(clan.kind, plan.id) <= tierRankOf(clan.kind, current.id)) {
    if (ev.subscriptionId) {
      await noteToCancel(clan.id, ev.subscriptionId, plan.id, { reason: 'lower_tier', periodEndsAt: nextChargeDue(ev.recurrence, chargedAt(ev.saleTimestamp)) });
    }
    await logBilling(clan.id, 'billing_duplicate', { plan: plan.id, subscription: ev.subscriptionId, kept: clan.gumroadSubscriptionId, keptPlan: clan.plan, reason: plan.id === current.id ? 'same tier' : 'lower tier' }, notes);
    return { received: true, note: 'kept the higher plan' };
  }

  // Gumroad's own record says whether this started a trial; the notification often doesn't.
  const asked = await trialEndWithGumroad(ev.subscriptionId);
  const said = ev.freeTrialEndsAt && !Number.isNaN(Date.parse(ev.freeTrialEndsAt)) ? new Date(ev.freeTrialEndsAt).toISOString() : null;
  // ONE TRIAL. A sale that carries Gumroad's free trial, on a row that has already had a trial (the
  // site's own, lib/planTrials) or a membership: recorded, not granted. The paid tier starts with the
  // first real charge, which is Gumroad's at trial end. The buttons never send such a row to the
  // trial product (lib/planTrialRules buyButtons), but its Gumroad address is public.
  // lib/planTrialRules usedTrialHold is the whole decision: Gumroad's answer when it could be asked,
  // else the notification's trial end, else (nothing known) held only when a trial is still possible
  // and the notification shows no money (a price above zero is a real charge and is never held).
  const why = (await hadMembership(clan.id)) ? 'membership' : (await hadPlanTrial(clan.id)) ? 'site trial' : null;
  const hold = usedTrialHold({ trialUsed: !!why, asked, said, nowProduct: isNowPlanProduct(ev), configuredTrialDays: TRIAL_DAYS, priceCents: ev.priceCents });
  // What the clan is shown as its Gumroad trial when it is NOT held: Gumroad's word, the
  // notification's, and failing both the products' configured trial (none when TRIAL_DAYS is 0).
  const trialEnd = hold.hold ? hold.until : asked !== undefined ? asked : (said ?? guessedTrialEnd());
  const trialRunning = !!trialEnd && Date.parse(trialEnd) > Date.now();
  // The first charge falls due when the trial runs out, else a term after this one — and if it
  // never comes, that date going by is what the daily lapse check asks Gumroad about.
  const periodEnd = trialRunning ? trialEnd : nextChargeDue(ev.recurrence, chargedAt(ev.saleTimestamp));
  const ids = {
    gumroadSaleId: ev.saleId,
    gumroadSubscriptionId: ev.subscriptionId,
    gumroadProductId: ev.productId,
    gumroadProductPermalink: ev.productPermalink,
  };

  if (hold.hold) {
    if (!current.free) {
      // Still paying for another membership: that one stays the clan's for now. This one waits for
      // its first charge and then takes over (lib/extraMemberships), when the other becomes the one
      // to cancel. Without a subscription id nothing later could find it, so it is only flagged.
      if (ev.subscriptionId) await noteWaiting(clan.id, ev.subscriptionId, plan.id, hold.until);
      await logBilling(clan.id, 'billing_duplicate', { plan: plan.id, subscription: ev.subscriptionId, kept: clan.gumroadSubscriptionId, held: 'trial already used', startsAt: hold.until, trialKnown: hold.known }, notes);
      return { received: true, note: ev.subscriptionId ? 'waits for first charge' : 'duplicate membership' };
    }
    await db
      .update(clans)
      .set({ ...ids, trialEndsAt: hold.until, currentPeriodEnd: hold.until, cancelAtPeriodEnd: false })
      .where(eq(clans.id, clan.id));
    // `plan` here is the TIER BOUGHT: the first charge reads it back (heldTierFor) rather than
    // working the tier out again from the charge notification.
    await logBilling(clan.id, 'billing_subscribed', { plan: plan.id, subscription: ev.subscriptionId, held: 'trial already used', had: why, trialKnown: hold.known }, notes);
    return { received: true, note: 'held until first charge' };
  }

  // A new membership on a clan that is still paying for another: the new one becomes the clan's at
  // once, and the old one keeps charging on Gumroad until someone cancels it ("Move to Gold" is a new
  // purchase, not an upgrade of the Silver one). Recorded as the one to cancel: the owner is told on
  // their plan page and staff see it as an open item until Gumroad reports it ENDED. One already
  // cancelled is recorded too, marked so: nobody is asked to cancel it, but it still has paid term.
  if (liveOther && clan.gumroadSubscriptionId) {
    await logBilling(clan.id, 'billing_duplicate', { plan: plan.id, subscription: ev.subscriptionId, replaced: clan.gumroadSubscriptionId, replacedPlan: clan.plan }, notes);
    await noteToCancel(clan.id, clan.gumroadSubscriptionId, clan.plan, { reason: 'superseded', cancelled: clan.cancelAtPeriodEnd, periodEndsAt: clan.currentPeriodEnd });
  }
  await resolveExtraBySubscription(ev.subscriptionId, 'applied');
  await db
    .update(clans)
    .set({
      plan: plan.id,
      memberCap: plan.memberCap,
      ...ids,
      // The owner's own address wins: people often pay from a different email than the one they
      // gave Anvil, and the one they gave us is where they expect to hear from us.
      contactEmail: clan.contactEmail ?? ev.email,
      trialEndsAt: trialRunning ? trialEnd : null,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      // Clan tenure: a new run, or the one it had when it comes back within the grace.
      ...runOnPaid(clan),
      // Paying again lifts a suspension only when BILLING put it there (a refund or dispute).
      // A suspension staff applied is a judgement about the clan, and money does not overturn it.
      status: clan.status === 'suspended' && (await suspendedByBilling(clan.id)) ? 'active' : clan.status,
    })
    .where(eq(clans.id, clan.id));
  await logBilling(clan.id, 'billing_subscribed', { plan: plan.id, subscription: ev.subscriptionId }, notes);
  // Subscribed before its Anvil trial ran out: the unused days come back as a partial refund of this
  // sale (lib/trialRefund; off unless ANVIL_TRIAL_REFUND=on, when it only records what it would give).
  // Only for Gumroad's own notification: a purchase staff attach by hand is never refunded automatically.
  if (notes === 'gumroad webhook') await refundUnusedTrial(clan.id, ev, chargedAt(ev.saleTimestamp), notes);
  // Credited to the clan's creator's first-touch source at read time (lib/analyticsAttribution).
  track('clan.purchased', { clanId: clan.id, userId: null, props: { plan: plan.id } });
  return { received: true, plan: plan.id };
}

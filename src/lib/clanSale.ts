// What a new Gumroad SALE does to the clan or creator space it was matched to.
//
// Lifted out of the webhook (api/webhooks/gumroad) unchanged, so that staff attaching an unmatched
// purchase by hand (lib/unmatchedPurchases) applies exactly what the webhook would have for a sale that
// had matched — the same plan read, the same trial rules, the same ids written — rather than a second
// copy that drifts. The webhook still decides WHETHER a sale applies (match, catalogue, replay latch,
// Gumroad's own word on the sale); this is only what applying it means.

import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { track } from '@/lib/analytics';
import { clanAuditLog, clans } from '@/db/schema';
import { nextChargeDue, trialEndWithGumroad, TRIAL_DAYS, type GumroadEvent } from '@/lib/gumroad';
import { logBilling } from '@/lib/billingLapse';
import { billingTierOf, catalogOfKind, entryTierFor, gumroadPurchase, type BillingTier } from '@/lib/billingCatalog';

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

function trialEndsAtIso(): string {
  return new Date(Date.now() + TRIAL_DAYS * 86400_000).toISOString();
}

/**
 * Has this clan had a paid membership before? Gumroad's free trial is once per BUYER, and a buyer is
 * an email — so a clan that let its membership lapse could subscribe again from a new address and get
 * another free month (lfl did, the day its Silver ended). The trial is once per CLAN here.
 */
async function hadMembership(clanId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: clanAuditLog.id })
    .from(clanAuditLog)
    .where(
      and(
        eq(clanAuditLog.clanId, clanId),
        inArray(clanAuditLog.eventType, ['billing_subscribed', 'billing_renewed', 'billing_ended', 'billing_restarted']),
      ),
    )
    .limit(1);
  return !!row;
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
): Promise<{ received: true; plan?: string; note?: string }> {
  const current = billingTierOf(clan.kind, clan.plan);
  const plan = purchasedPlan(ev, clan.kind, current.free ? entryTierFor(clan.kind) : current);
  // Gumroad's own record says whether this started a trial; the notification often doesn't.
  // Without a token to ask, the notification's word, and failing that the products' trial.
  const asked = await trialEndWithGumroad(ev.subscriptionId);
  const said = ev.freeTrialEndsAt && !Number.isNaN(Date.parse(ev.freeTrialEndsAt)) ? new Date(ev.freeTrialEndsAt).toISOString() : null;
  const trialEnd = asked !== undefined ? asked : (said ?? trialEndsAtIso());
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

  // A second free trial for a clan that has had a membership: recorded, not granted. The plan
  // starts with the first real charge (the renewal case), which is Gumroad's at trial end.
  // Only a trial we KNOW of holds anything: the guessed one (no token, nothing in the notification)
  // must never keep a paying clan off its plan.
  const trialKnown = asked !== undefined ? !!asked : !!said;
  if (trialRunning && trialKnown && (await hadMembership(clan.id))) {
    if (!current.free) {
      // Already on a paid plan from another membership: that one stays the clan's. This one is a
      // duplicate purchase (two tiers in one cart) for staff to cancel on Gumroad.
      await logBilling(clan.id, 'billing_duplicate', { plan: plan.id, subscription: ev.subscriptionId, kept: clan.gumroadSubscriptionId }, notes);
      return { received: true, note: 'duplicate membership' };
    }
    await db
      .update(clans)
      .set({ ...ids, trialEndsAt: trialEnd, currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false })
      .where(eq(clans.id, clan.id));
    await logBilling(clan.id, 'billing_subscribed', { plan: plan.id, subscription: ev.subscriptionId, held: 'trial already used' }, notes);
    return { received: true, note: 'held until first charge' };
  }

  // A new membership on a clan that is still paying for another: the new one becomes the clan's,
  // and the old one keeps charging on Gumroad until someone cancels it ("Move to Gold" is a new
  // purchase, not an upgrade of the Silver one). Logged so staff see it.
  if (!current.free && clan.gumroadSubscriptionId && clan.gumroadSubscriptionId !== ev.subscriptionId) {
    await logBilling(clan.id, 'billing_duplicate', { plan: plan.id, subscription: ev.subscriptionId, replaced: clan.gumroadSubscriptionId, replacedPlan: clan.plan }, notes);
  }
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
      // Paying again lifts a suspension only when BILLING put it there (a refund or dispute).
      // A suspension staff applied is a judgement about the clan, and money does not overturn it.
      status: clan.status === 'suspended' && (await suspendedByBilling(clan.id)) ? 'active' : clan.status,
    })
    .where(eq(clans.id, clan.id));
  await logBilling(clan.id, 'billing_subscribed', { plan: plan.id, subscription: ev.subscriptionId }, notes);
  // Credited to the clan's creator's first-touch source at read time (lib/analyticsAttribution).
  track('clan.purchased', { clanId: clan.id, userId: null, props: { plan: plan.id } });
  return { received: true, plan: plan.id };
}

// Anvil Supporter: what a Gumroad notification about the Supporter product does.
//
// The clan webhook (api/webhooks/gumroad) authenticates the request and parses it, then hands any
// event for the Supporter product here. The rules mirror the clan side where they apply:
//   - a SALE finds its buyer by the `ref` on their checkout link, never by email;
//   - everything after (renewal, cancel, end, refund) finds the membership by its subscription id;
//   - anything that grants names a sale Gumroad still stands behind, applied once (replay latch);
//   - cancelling keeps the tier until the term ends; refunds and disputes end it at once.
// Unlike a clan, nobody is suspended: a refunded Supporter just stops being one.

import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { track } from '@/lib/analytics';

import { db } from '@/db';
import { ownerTrials, supporterSubscriptions, users } from '@/db/schema';
import { afterSupporterChange } from '@/lib/anvilDiscord';
import { recordSupporterReferral, revokeReferrals } from '@/lib/referrals';
import { checkSaleWithGumroad, checkSubscriptionWithGumroad, nextChargeDue, type GumroadEvent } from '@/lib/gumroad';
import { HELD_STATUS, parseStamp, runStartOnReturn, supporterTierForGumroad, type SupporterTierId } from '@/lib/supporterTiers';
import { noteUnmatchedFollowUp, recordUnmatchedPurchase } from '@/lib/unmatchedPurchases';

/**
 * Is this notification about the Supporter product (rather than a clan plan)? Two products are
 * Supporter: the original (with Gumroad's free trial when the owner has one on there) and its
 * pay-now copy with no trial (GUMROAD_PRODUCT_SUPPORTER_NOW / permalink "supporter-now"). Same
 * tiers, same handling; the trial rules below read what Gumroad reports, not which product it was.
 */
export function isSupporterEvent(ev: Pick<GumroadEvent, 'productId' | 'productPermalink'>): boolean {
  const ids = [process.env.GUMROAD_PRODUCT_SUPPORTER, process.env.GUMROAD_PRODUCT_SUPPORTER_NOW].filter(Boolean);
  if (ev.productId && ids.includes(ev.productId)) return true;
  const permalinks = [process.env.GUMROAD_PERMALINK_SUPPORTER || 'supporter', process.env.GUMROAD_PERMALINK_SUPPORTER_NOW || 'supporter-now'];
  return !!ev.productPermalink && permalinks.includes(ev.productPermalink);
}

/**
 * Has this person used their one Supporter trial? Any login of theirs that has had a Gumroad
 * membership (paid or its trial), or a trial Anvil gave them (owner_trials). Decides which checkout
 * their buttons open, and whether a sale carrying a Gumroad trial is held to its first charge.
 * `exceptSubscriptionId` leaves out the membership being applied right now.
 */
export async function supporterTrialUsed(userId: number, exceptSubscriptionId?: string | null): Promise<boolean> {
  const me = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, playerId: true } });
  if (!me) return false;
  const logins = me.playerId != null ? (await db.select({ id: users.id }).from(users).where(eq(users.playerId, me.playerId))).map((u) => u.id) : [me.id];
  const [paid, lent] = await Promise.all([
    db
      .select({ sub: supporterSubscriptions.gumroadSubscriptionId })
      .from(supporterSubscriptions)
      .where(and(inArray(supporterSubscriptions.userId, logins), isNotNull(supporterSubscriptions.gumroadSubscriptionId))),
    db.select({ id: ownerTrials.id }).from(ownerTrials).where(and(eq(ownerTrials.kind, 'supporter'), inArray(ownerTrials.userId, logins))).limit(1),
  ]);
  return lent.length > 0 || paid.some((r) => r.sub !== exceptSubscriptionId);
}

function nowIso(): string {
  return new Date().toISOString();
}

/** When the charge happened, never later than now (see the clan webhook's chargedAt). */
function chargedAt(stamp: string | null): number {
  const ms = stamp ? Date.parse(stamp) : NaN;
  return Number.isFinite(ms) ? Math.min(ms, Date.now()) : Date.now();
}

type Result = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown> = {}): Result => ({ status: 200, body: { received: true, ...body } });

/** When a sale's first period ends (a free trial's end, else a term after the charge), and whether it is a trial. */
function saleTerms(ev: GumroadEvent): { trialEnd: number; periodEnd: string; isTrial: boolean } {
  // A free trial's first charge is due when the trial runs out, not a whole term from now.
  const trialEnd = parseStamp(ev.freeTrialEndsAt);
  const periodEnd = Number.isFinite(trialEnd) ? new Date(trialEnd).toISOString() : nextChargeDue(ev.recurrence, chargedAt(ev.saleTimestamp));
  // The Anvil Discord announces a membership once it is paid for: a trial waits for its first charge.
  const isTrial = Number.isFinite(trialEnd) && trialEnd > Date.now();
  return { trialEnd, periodEnd, isTrial };
}

/**
 * A new Supporter membership for this login, from its sale — what the webhook does for a sale whose
 * checkout ref found the buyer, and what staff attaching an unmatched sale (lib/unmatchedPurchaseActions)
 * does for the person they picked. The caller has already checked the sale, its subscription and tier.
 */
export async function startSupporterMembership(userId: number, ev: GumroadEvent, tier: SupporterTierId): Promise<number | null> {
  const { trialEnd, periodEnd, isTrial } = saleTerms(ev);
  // ONE TRIAL. Gumroad started this with its free trial for someone who has already had one (Anvil's
  // or Gumroad's): recorded, and the tier starts with the first real charge (recurring_charge makes
  // it 'active'). The buttons never send them to the trial product, but its address is public.
  const held = isTrial && (await supporterTrialUsed(userId, ev.subscriptionId));
  const [created] = await db.insert(supporterSubscriptions).values({
    userId,
    tier,
    status: held ? HELD_STATUS : 'active',
    recurrence: ev.recurrence,
    gumroadSubscriptionId: ev.subscriptionId,
    gumroadSaleId: ev.saleId,
    currentPeriodEnd: periodEnd,
    startedAt: nowIso(),
    tenureStartedAt: nowIso(),
  }).returning({ id: supporterSubscriptions.id });
  if (created) track('supporter.purchased', { userId, clanId: null, props: { tier, ...(held ? { held: true } : {}) } });
  if (created && !held) afterSupporterChange(userId, { announceRowId: isTrial ? null : created.id });
  // Bought through somebody's invite link: their reward is held until the money has settled.
  if (created && ev.urlParams.via) {
    await recordSupporterReferral({
      code: ev.urlParams.via,
      buyerUserId: userId,
      subscriptionId: ev.subscriptionId,
      saleId: ev.saleId,
      recurrence: ev.recurrence,
      trialEndsAt: Number.isFinite(trialEnd) ? trialEnd : null,
    });
  }
  return created?.id ?? null;
}

/** A notification about a membership nobody holds: it may be one waiting in the unmatched inbox. */
async function unknownMembership(ev: GumroadEvent): Promise<Result> {
  await noteUnmatchedFollowUp(ev);
  return ok({ note: 'unknown membership' });
}

/** Apply one Supporter notification. Returns what the route should answer. */
export async function handleSupporterEvent(ev: GumroadEvent): Promise<Result> {
  // By subscription, else by the sale itself: a refund or replay must always find what it grants.
  const row = ev.subscriptionId
    ? await db.query.supporterSubscriptions.findFirst({ where: eq(supporterSubscriptions.gumroadSubscriptionId, ev.subscriptionId) })
    : ev.saleId
      ? await db.query.supporterSubscriptions.findFirst({ where: eq(supporterSubscriptions.gumroadSaleId, ev.saleId) })
      : undefined;

  // Anything that grants must name a sale Gumroad stands behind, and one not already applied.
  if (ev.kind === 'sale' || ev.kind === 'recurring_charge') {
    if (row && ev.saleId && row.gumroadSaleId === ev.saleId) return ok({ note: 'already applied' });
    const check = await checkSaleWithGumroad(ev.saleId, ev.productId);
    if (check === 'error') return { status: 503, body: { error: 'Could not confirm the sale with Gumroad' } };
    if (check === 'rejected') return ok({ note: 'sale not confirmed by Gumroad' });
  }

  switch (ev.kind) {
    case 'sale': {
      // Supporter is only sold as a subscription. A sale without one could never be ended or
      // revoked by a later notification, so it grants nothing.
      if (!ev.subscriptionId) {
        console.warn('[supporter] sale without a subscription', ev.saleId);
        return ok({ note: 'not a subscription' });
      }
      const tier = supporterTierForGumroad(ev.tier);
      if (!tier) {
        console.warn('[supporter] sale with unknown tier', ev.tier, ev.subscriptionId);
        return ok({ note: 'unknown tier' });
      }
      const { periodEnd, isTrial } = saleTerms(ev);
      if (row) {
        await db
          .update(supporterSubscriptions)
          // A held membership (trial already used) stays held until a real charge, whatever is replayed.
          .set({ tier, status: row.status === HELD_STATUS && isTrial ? HELD_STATUS : 'active', recurrence: ev.recurrence, gumroadSaleId: ev.saleId, currentPeriodEnd: periodEnd, endedAt: null, ...runStartOnReturn(row) })
          .where(eq(supporterSubscriptions.id, row.id));
        afterSupporterChange(row.userId, { announceRowId: isTrial ? null : row.id });
        return ok({ tier });
      }
      // A new membership: the buyer is whoever's checkout ref came back. Never the email.
      const ref = ev.urlParams.ref;
      const buyer = ref ? await db.query.users.findFirst({ where: eq(users.supporterRef, ref), columns: { id: true } }) : undefined;
      if (!buyer) {
        // Kept for staff to attach by hand (the unmatched inbox, /staff/subscriptions). Best-effort.
        console.warn('[supporter] no buyer for sale', ev.saleId, ev.subscriptionId);
        await recordUnmatchedPurchase(ev, { kind: 'supporter', reason: 'no-buyer' });
        return ok({ note: 'no matching user' });
      }
      await startSupporterMembership(buyer.id, ev, tier);
      return ok({ tier });
    }

    case 'recurring_charge': {
      if (!row) return unknownMembership(ev);
      // A renewal carries the tier it charged for, so an upgrade or downgrade made on Gumroad lands here.
      const tier = supporterTierForGumroad(ev.tier) ?? row.tier;
      await db
        .update(supporterSubscriptions)
        .set({
          tier,
          status: 'active',
          gumroadSaleId: ev.saleId ?? row.gumroadSaleId,
          recurrence: ev.recurrence ?? row.recurrence,
          currentPeriodEnd: nextChargeDue(ev.recurrence ?? row.recurrence, chargedAt(ev.saleTimestamp)),
          endedAt: null,
        })
        .where(eq(supporterSubscriptions.id, row.id));
      // A trial's first real charge is when it is announced (a no-op for anything already announced).
      afterSupporterChange(row.userId, { announceRowId: row.id });
      return ok({ tier });
    }

    case 'cancellation': {
      if (!row) return unknownMembership(ev);
      // They paid for this term; it runs to its end.
      if (row.status === 'active') {
        await db.update(supporterSubscriptions).set({ status: 'cancelling' }).where(eq(supporterSubscriptions.id, row.id));
      }
      return ok();
    }

    case 'subscription_ended': {
      if (!row) return unknownMembership(ev);
      if (row.status !== 'refunded') {
        await db.update(supporterSubscriptions).set({ status: 'ended', endedAt: nowIso() }).where(eq(supporterSubscriptions.id, row.id));
      }
      // A trial that never paid, or a membership gone before its referral settled, earns nothing.
      const lost = ev.subscriptionId ? await revokeReferrals(ev.subscriptionId, { heldOnly: true }) : [];
      afterSupporterChange([row.userId, ...lost]);
      return ok();
    }

    case 'restarted': {
      if (!row) return unknownMembership(ev);
      if (row.status === 'refunded') return ok({ note: 'refunded' });
      // Waiting for its first charge: a restart carries no money, so it starts nothing.
      if (row.status === HELD_STATUS) return ok({ note: 'held until first charge' });
      const check = await checkSubscriptionWithGumroad(ev.subscriptionId);
      if (check === 'error') return { status: 503, body: { error: 'Could not confirm the subscription with Gumroad' } };
      if (check === 'dead') return ok({ note: 'subscription not running' });
      await db
        .update(supporterSubscriptions)
        .set({
          status: 'active',
          endedAt: null,
          ...runStartOnReturn(row),
          currentPeriodEnd: row.status === 'ended' ? nextChargeDue(ev.recurrence ?? row.recurrence, Date.now()) : row.currentPeriodEnd,
        })
        .where(eq(supporterSubscriptions.id, row.id));
      afterSupporterChange(row.userId);
      return ok();
    }

    case 'refund':
    case 'dispute': {
      if (!row) return unknownMembership(ev);
      await db.update(supporterSubscriptions).set({ status: 'refunded', endedAt: nowIso() }).where(eq(supporterSubscriptions.id, row.id));
      // Money taken back takes the referrer's reward with it, granted or not.
      const lost = row.gumroadSubscriptionId ? await revokeReferrals(row.gumroadSubscriptionId, { heldOnly: false }) : [];
      afterSupporterChange([row.userId, ...lost]);
      return ok();
    }

    default:
      return ok({ note: 'unhandled kind' });
  }
}

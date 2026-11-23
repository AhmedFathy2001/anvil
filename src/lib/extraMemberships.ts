// A clan's (or creator space's) OTHER Gumroad memberships: ones bought through its checkout that are
// not the one on its clans row (table clan_extra_memberships, drizzle/0267).
//
// Moving from one paid tier to another is a NEW Gumroad purchase here; the site has no way to cancel
// the old one, so it keeps charging until the owner cancels it on Gumroad.
//   'to_cancel'  that older membership. Shown to the owner ("You now have two memberships. Cancel the
//                older one so you are not charged twice") and to staff as an open item, until Gumroad
//                reports it cancelled or ended.
//   'waiting'    a new membership Gumroad started with a free trial on a row that has already had its
//                trial and is paying for another: nothing is granted during Gumroad's free period, and
//                it takes over at its first real charge.
// The webhook looks here by subscription id when no clans row holds the id. Nothing in this file
// calls Gumroad except to confirm a charge or a running membership before granting off it.

import { MEMBERSHIP_OWNS_PLAN } from '@/lib/clanFundRules';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanExtraMemberships, clans } from '@/db/schema';
import { billingTierOf, type BillingTier } from '@/lib/billingCatalog';
import { logBilling } from '@/lib/billingLapse';
import { runOnPaid } from '@/lib/clanTenure';
import { checkSaleWithGumroad, checkSubscriptionWithGumroad, nextChargeDue, type GumroadEvent } from '@/lib/gumroad';
import { tierRankOf } from '@/lib/planTrialRules';

export type ExtraMembership = typeof clanExtraMemberships.$inferSelect;
type Clan = typeof clans.$inferSelect;

export { manageUrl } from '@/lib/gumroadLinks';

/** Why a membership is extra: the older one after an upgrade, or a lower / equal tier bought while a higher one is live. */
export type ExtraReason = 'superseded' | 'lower_tier';

interface NoteFields {
  trialEndsAt?: Date | null;
  reason?: ExtraReason | null;
  /** Already cancelled on Gumroad (it will not charge again) when it was noted. */
  cancelled?: boolean;
  periodEndsAt?: Date | null;
}

const dateOf = (stamp: string | null | undefined): Date | null => {
  if (!stamp) return null;
  const ms = Date.parse(stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`);
  return Number.isFinite(ms) ? new Date(ms) : null;
};

/**
 * Record an extra membership. One row per subscription, ever: an OPEN row is brought up to date, and
 * a RESOLVED row is never reopened (a replayed notification for a membership that already ended or
 * was applied must not put its notice back). Returns false when nothing was written.
 */
async function note(clanId: number, subscriptionId: string, plan: string, state: 'to_cancel' | 'waiting', f: NoteFields = {}): Promise<boolean> {
  const existing = await db.query.clanExtraMemberships.findFirst({ where: eq(clanExtraMemberships.gumroadSubscriptionId, subscriptionId) });
  if (existing?.resolvedAt) return false;
  const values = {
    clanId,
    plan,
    state,
    trialEndsAt: f.trialEndsAt ?? null,
    reason: f.reason ?? null,
    cancelledAt: f.cancelled ? new Date() : null,
    periodEndsAt: f.periodEndsAt ?? null,
  };
  if (existing) {
    await db.update(clanExtraMemberships).set(values).where(and(eq(clanExtraMemberships.id, existing.id), isNull(clanExtraMemberships.resolvedAt)));
    return true;
  }
  const made = await db.insert(clanExtraMemberships).values({ gumroadSubscriptionId: subscriptionId, ...values }).onConflictDoNothing().returning({ id: clanExtraMemberships.id });
  return made.length > 0;
}

/**
 * A membership that is not the row's own and keeps charging on Gumroad: the OLDER one after an upgrade
 * ('superseded'), or a LOWER / equal tier bought while a higher one is live ('lower_tier'). Open until
 * Gumroad says it ENDED. `cancelled`: it was already cancelled when noted, so nobody is asked to cancel
 * it, but it stays open (it still has paid term, and the fall-back can still find it).
 */
export function noteToCancel(clanId: number, subscriptionId: string, plan: string, opts: { reason?: ExtraReason; cancelled?: boolean; periodEndsAt?: string | null } = {}) {
  return note(clanId, subscriptionId, plan, 'to_cancel', { reason: opts.reason ?? 'superseded', cancelled: opts.cancelled, periodEndsAt: dateOf(opts.periodEndsAt) });
}

/** A new membership held to its first real charge (Gumroad's free trial on a row that has had one). */
export function noteWaiting(clanId: number, subscriptionId: string, plan: string, trialEndsAt: string | null) {
  return note(clanId, subscriptionId, plan, 'waiting', { trialEndsAt: dateOf(trialEndsAt) });
}

/** Any row for this subscription on this clan, open or resolved: what a redelivered sale is checked against. */
export async function extraForClanSubscription(clanId: number, subscriptionId: string | null): Promise<ExtraMembership | null> {
  if (!subscriptionId) return null;
  const row = await db.query.clanExtraMemberships.findFirst({
    where: and(eq(clanExtraMemberships.clanId, clanId), eq(clanExtraMemberships.gumroadSubscriptionId, subscriptionId)),
  });
  return row ?? null;
}

export async function resolveExtra(id: number, resolution: string) {
  await db.update(clanExtraMemberships).set({ resolvedAt: new Date(), resolution }).where(and(eq(clanExtraMemberships.id, id), isNull(clanExtraMemberships.resolvedAt)));
}

/** A membership that became the row's own is no longer an extra one. */
export async function resolveExtraBySubscription(subscriptionId: string | null, resolution: string) {
  if (!subscriptionId) return;
  await db
    .update(clanExtraMemberships)
    .set({ resolvedAt: new Date(), resolution })
    .where(and(eq(clanExtraMemberships.gumroadSubscriptionId, subscriptionId), isNull(clanExtraMemberships.resolvedAt)));
}

export async function openExtraBySubscription(subscriptionId: string | null): Promise<ExtraMembership | null> {
  if (!subscriptionId) return null;
  const row = await db.query.clanExtraMemberships.findFirst({
    where: and(eq(clanExtraMemberships.gumroadSubscriptionId, subscriptionId), isNull(clanExtraMemberships.resolvedAt)),
  });
  return row ?? null;
}

/** The open extra memberships of these clans / spaces, oldest first. */
export async function openExtrasForClans(clanIds: number[]): Promise<ExtraMembership[]> {
  if (clanIds.length === 0) return [];
  return db
    .select()
    .from(clanExtraMemberships)
    .where(and(inArray(clanExtraMemberships.clanId, clanIds), isNull(clanExtraMemberships.resolvedAt)))
    .orderBy(clanExtraMemberships.id);
}

/** Every open one, with its clan, for staff (/staff/subscriptions). */
export async function listOpenExtras() {
  // clan-scope: global -- billing is the platform's; staff see every open item.
  return db
    .select({
      id: clanExtraMemberships.id,
      clanId: clanExtraMemberships.clanId,
      clanName: clans.name,
      clanSlug: clans.slug,
      kind: clans.kind,
      currentPlan: clans.plan,
      subscriptionId: clanExtraMemberships.gumroadSubscriptionId,
      plan: clanExtraMemberships.plan,
      state: clanExtraMemberships.state,
      reason: clanExtraMemberships.reason,
      cancelledAt: clanExtraMemberships.cancelledAt,
      periodEndsAt: clanExtraMemberships.periodEndsAt,
      trialEndsAt: clanExtraMemberships.trialEndsAt,
      lastChargedAt: clanExtraMemberships.lastChargedAt,
      notedAt: clanExtraMemberships.notedAt,
    })
    .from(clanExtraMemberships)
    .innerJoin(clans, eq(clans.id, clanExtraMemberships.clanId))
    .where(isNull(clanExtraMemberships.resolvedAt))
    .orderBy(clanExtraMemberships.id);
}

/**
 * The row's membership just ended. If an older one it was told to cancel is STILL running on Gumroad
 * (they cancelled the new one by mistake, or it failed), the row goes back to that one rather than to
 * free while it is being charged. Only on Gumroad's own word that it is alive: with no token to ask,
 * nothing is granted and the item stays open for staff. Returns the tier it fell back to, or null.
 */
export async function fallBackToOlderMembership(
  clan: { id: number; kind: string; plan: string },
  notes = 'gumroad webhook',
  why = 'the newer membership ended',
): Promise<BillingTier | null> {
  const open = (await openExtrasForClans([clan.id])).filter((e) => e.state === 'to_cancel').reverse();
  for (const extra of open) {
    const check = await checkSubscriptionWithGumroad(extra.gumroadSubscriptionId);
    if (check === 'dead') {
      await resolveExtra(extra.id, 'ended');
      continue;
    }
    if (check !== 'alive') continue;
    const tier = billingTierOf(clan.kind, extra.plan);
    if (tier.free) continue;
    await db
      .update(clans)
      .set({
        plan: tier.id,
        memberCap: tier.memberCap,
        gumroadSubscriptionId: extra.gumroadSubscriptionId,
        ...MEMBERSHIP_OWNS_PLAN,
        // Its own term end when we know it; else the next charge sets it, and the daily check asks
        // Gumroad about a row with no date.
        currentPeriodEnd: extra.periodEndsAt?.toISOString() ?? null,
        // Cancelled on Gumroad but still inside its paid term: it comes back as leaving, not renewing.
        cancelAtPeriodEnd: extra.cancelledAt != null,
        trialEndsAt: null,
        paidEndedAt: null,
      })
      .where(eq(clans.id, clan.id));
    await resolveExtra(extra.id, 'restored');
    await logBilling(clan.id, 'billing_fell_back', { plan: tier.id, subscription: extra.gumroadSubscriptionId, reason: `${why} and this one is still running` }, notes);
    return tier;
  }
  return null;
}

/**
 * A notification for a membership no clans row holds, but that is an open extra one. Returns the
 * webhook's answer, or null when this is not one (the caller carries on to the unmatched inbox).
 */
export async function handleExtraMembershipEvent(ev: GumroadEvent): Promise<{ status: number; body: Record<string, unknown> | string } | null> {
  const extra = await openExtraBySubscription(ev.subscriptionId);
  if (!extra) return null;
  const ok = (noteText: string) => ({ status: 200, body: { received: true, note: noteText } });
  const detail = { subscription: extra.gumroadSubscriptionId, plan: extra.plan };

  if (extra.state === 'to_cancel') {
    switch (ev.kind) {
      case 'cancellation': {
        // Cancelled, but it still has the term that was paid for: the row STAYS OPEN (the fall-back
        // can still go back to it) and the owner is no longer asked to cancel it.
        await db.update(clanExtraMemberships).set({ cancelledAt: new Date() }).where(eq(clanExtraMemberships.id, extra.id));
        await logBilling(extra.clanId, 'billing_duplicate_cancelled', { ...detail, endsAt: extra.periodEndsAt?.toISOString() ?? null });
        return ok('older membership cancelled, runs to its term end');
      }
      case 'subscription_ended': {
        await resolveExtra(extra.id, 'ended');
        await logBilling(extra.clanId, 'billing_duplicate_cleared', { ...detail, how: 'ended' });
        return ok('older membership closed');
      }
      case 'recurring_charge': {
        // Charged again while superseded: exactly what the notice warns about. Kept open, and said to staff.
        const stamp = ev.saleTimestamp ? Date.parse(ev.saleTimestamp) : NaN;
        const due = new Date(nextChargeDue(ev.recurrence, Number.isFinite(stamp) ? Math.min(stamp, Date.now()) : Date.now()));
        await db.update(clanExtraMemberships).set({ lastChargedAt: new Date(), periodEndsAt: due, cancelledAt: null }).where(eq(clanExtraMemberships.id, extra.id));
        await logBilling(extra.clanId, 'billing_duplicate_charged', { ...detail, sale: ev.saleId });
        return ok('older membership charged again');
      }
      case 'restarted': {
        // Taken up again on Gumroad: it will charge, so the owner is asked to cancel it again.
        await db.update(clanExtraMemberships).set({ cancelledAt: null }).where(eq(clanExtraMemberships.id, extra.id));
        await logBilling(extra.clanId, 'billing_duplicate_event', { ...detail, kind: ev.kind });
        return ok('older membership restarted');
      }
      default:
        // A refund or dispute of the older one changes nothing about the plan in force and never
        // suspends: the row's own membership is a different one. Logged for staff.
        await logBilling(extra.clanId, 'billing_duplicate_event', { ...detail, kind: ev.kind, sale: ev.saleId });
        return ok('older membership, no change');
    }
  }

  // waiting
  switch (ev.kind) {
    case 'recurring_charge': {
      const check = await checkSaleWithGumroad(ev.saleId, ev.productId);
      if (check === 'error') return { status: 503, body: 'Could not confirm the sale with Gumroad' };
      if (check === 'rejected') {
        await logBilling(extra.clanId, 'billing_rejected', { kind: ev.kind, sale: ev.saleId });
        return ok('sale not confirmed by Gumroad');
      }
      const clan = await db.query.clans.findFirst({ where: eq(clans.id, extra.clanId) });
      if (!clan) return ok('no matching clan');
      const plan = await takeOver(clan, extra, ev);
      return { status: 200, body: { received: true, plan: plan.id } };
    }
    case 'cancellation':
    case 'subscription_ended':
    case 'refund':
    case 'dispute': {
      // It never charged, so it never started. Nothing to take back.
      await resolveExtra(extra.id, ev.kind === 'cancellation' ? 'cancelled' : ev.kind === 'subscription_ended' ? 'ended' : 'refunded');
      await logBilling(extra.clanId, 'billing_waiting_closed', { ...detail, how: ev.kind });
      return ok('waiting membership closed');
    }
    default:
      return ok('waiting membership, no change');
  }
}

/** A waiting membership's first real charge: it becomes the row's, and the one it replaces is to cancel. */
async function takeOver(clan: Clan, extra: ExtraMembership, ev: GumroadEvent): Promise<BillingTier> {
  const plan = billingTierOf(clan.kind, extra.plan);
  const current = billingTierOf(clan.kind, clan.plan);
  const older = clan.gumroadSubscriptionId;
  const stamp = ev.saleTimestamp ? Date.parse(ev.saleTimestamp) : NaN;
  const due = nextChargeDue(ev.recurrence, Number.isFinite(stamp) ? Math.min(stamp, Date.now()) : Date.now());
  const stillPaying = !current.free && !!older && older !== extra.gumroadSubscriptionId;
  // The clan moved to a higher tier while this one waited: the higher one stays, and this one, now
  // charging, is the extra membership to cancel.
  if (stillPaying && !clan.cancelAtPeriodEnd && tierRankOf(clan.kind, plan.id) <= tierRankOf(clan.kind, current.id)) {
    await db
      .update(clanExtraMemberships)
      .set({ state: 'to_cancel', reason: 'lower_tier', lastChargedAt: new Date(), periodEndsAt: new Date(due), trialEndsAt: null })
      .where(eq(clanExtraMemberships.id, extra.id));
    await logBilling(clan.id, 'billing_duplicate', { plan: plan.id, subscription: extra.gumroadSubscriptionId, kept: older, keptPlan: clan.plan, reason: 'lower tier' });
    return current;
  }
  if (stillPaying) {
    await logBilling(clan.id, 'billing_duplicate', { plan: plan.id, subscription: extra.gumroadSubscriptionId, replaced: older, replacedPlan: clan.plan });
  }
  await db
    .update(clans)
    .set({
      plan: plan.id,
      memberCap: plan.memberCap,
      gumroadSubscriptionId: extra.gumroadSubscriptionId,
      ...MEMBERSHIP_OWNS_PLAN,
      gumroadSaleId: ev.saleId ?? clan.gumroadSaleId,
      gumroadProductId: ev.productId ?? clan.gumroadProductId,
      gumroadProductPermalink: ev.productPermalink ?? clan.gumroadProductPermalink,
      currentPeriodEnd: due,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      ...runOnPaid(clan),
    })
    .where(eq(clans.id, clan.id));
  await resolveExtra(extra.id, 'applied');
  if (stillPaying && older) await noteToCancel(clan.id, older, clan.plan, { cancelled: clan.cancelAtPeriodEnd, periodEndsAt: clan.currentPeriodEnd });
  await logBilling(clan.id, 'billing_subscribed', { plan: plan.id, subscription: extra.gumroadSubscriptionId, after: 'first charge' });
  return plan;
}

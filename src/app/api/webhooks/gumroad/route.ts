import { NextRequest } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans } from '@/db/schema';
import { checkSaleWithGumroad, checkSubscriptionWithGumroad, nextChargeDue, parseWebhook, verifySeller, verifyWebhookSecret, TRIAL_DAYS } from '@/lib/gumroad';
import { endMembership, logBilling } from '@/lib/billingLapse';
import { PLANS, planForGumroadProduct, planForGumroadTier, planOf, type Plan } from '@/lib/plans';

// Form-encoded body, and crypto — Node runtime.
export const runtime = 'nodejs';

/**
 * Gumroad's billing webhook, now that the clan is a row here rather than a container elsewhere.
 *
 * WHAT THIS NO LONGER DOES, and why the handler is a third of its former size: it does not
 * provision, deprovision, register anything in a federation directory, or move a clan through
 * awaiting_payment → provisioning → active. Those steps existed because a clan did not EXIST until
 * it was paid for and built. Under freemium the clan is already here on the free tier, so a payment
 * changes what it is ENTITLED to — one column — and an ending subscription drops it back to free
 * rather than taking its site away.
 *
 * That last point is the real behavioural change and it is deliberate: a clan whose card expires
 * keeps its events, its roster and its history, and loses only the paid limits. Deleting a
 * community's data over a failed payment is not a retention strategy.
 *
 * Refunds and disputes still suspend, because those are the abuse cases rather than the lapse ones.
 *
 * Always 200 on an authentic event we understood, so Gumroad marks it delivered; only a bad secret
 * 401s and only genuine failures 500 (which Gumroad retries).
 */

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
 * The plan a clan had before its subscription ended, from the billing_ended entry that dropped it —
 * so taking the membership up again gives back what was paid for, not a guess. Only when nothing
 * has happened since: a refund, dispute or staff change after the end makes the old plan stale.
 */
async function planBeforeEnd(clanId: number): Promise<Plan | null> {
  const [last] = await db
    .select({ eventType: clanAuditLog.eventType, newValue: clanAuditLog.newValue })
    .from(clanAuditLog)
    .where(
      and(
        eq(clanAuditLog.clanId, clanId),
        inArray(clanAuditLog.eventType, ['billing_ended', 'billing_restarted', 'billing_subscribed', 'billing_refund', 'billing_dispute', 'platform_clan_updated']),
      ),
    )
    .orderBy(desc(clanAuditLog.id))
    .limit(1);
  if (last?.eventType !== 'billing_ended') return null;
  try {
    const from = (JSON.parse(last.newValue ?? '{}') as { from?: string }).from;
    const plan = planOf(from);
    return plan === PLANS.free ? null : plan;
  } catch {
    return null;
  }
}

/**
 * When a charge happened, by Gumroad's own stamp; now if it sent none or one we can't read. Never
 * later than now: the stamp is body text, and one dated ahead would push the due date out of reach of
 * the daily lapse check (lib/billingLapse). Earlier only makes a clan due sooner, which is safe.
 */
function chargedAt(stamp: string | null): number {
  const ms = stamp ? Date.parse(stamp) : NaN;
  return Number.isFinite(ms) ? Math.min(ms, Date.now()) : Date.now();
}

function trialEndsAtIso(): string {
  return new Date(Date.now() + TRIAL_DAYS * 86400_000).toISOString();
}

/** The tier actually bought: membership tier name first, then per-tier product id. */
function purchasedPlan(ev: ReturnType<typeof parseWebhook>, fallback: Plan): Plan {
  return planForGumroadTier(ev.tier) ?? planForGumroadProduct(ev.productId) ?? fallback;
}

/**
 * Find the clan a webhook is about.
 *
 * Two keys, most specific first. `ref` is the token we appended to the checkout URL, so it names
 * the clan that STARTED this purchase; the subscription id names one we have already seen.
 *
 * NOT the email any more. `clans.contact_email` is free text a clan owner types and nobody verifies,
 * so matching on it let one clan set its email to a customer's and catch their upgrade — or catch
 * their refund and get suspended into someone else's dispute. A sale neither key matches is logged
 * and left for staff, which is the honest answer for a purchase that never came through our checkout.
 */
async function clanForEvent(ev: ReturnType<typeof parseWebhook>) {
  if (ev.urlParams.ref) {
    const byRef = await db.query.clans.findFirst({ where: eq(clans.gumroadRef, ev.urlParams.ref) });
    if (byRef) return byRef;
  }
  if (ev.subscriptionId) {
    const bySub = await db.query.clans.findFirst({
      where: eq(clans.gumroadSubscriptionId, ev.subscriptionId),
    });
    if (bySub) return bySub;
  }
  return null;
}

export async function POST(req: NextRequest) {
  // Authenticate BEFORE reading the body. Gumroad's Ping carries no signature, so the shared secret
  // in the Ping URL is the gate. Body fields like seller_id appear in public product URLs and can
  // never be the only check — otherwise a forged "sale" buys a free upgrade.
  if (!verifyWebhookSecret(req.nextUrl.searchParams.get('key'))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const raw = await req.text();
  const ev = parseWebhook(raw);

  if (!verifySeller(ev.sellerId)) {
    return new Response('Invalid seller', { status: 401 });
  }

  const clan = await clanForEvent(ev);
  if (!clan) {
    // Nothing to attach it to. Logged rather than 500'd: retrying will not conjure a clan, and a
    // permanently-failing webhook is noise that hides the real ones. A sale with no clan is a
    // human problem — someone bought before creating one — and is picked up in /staff.
    console.warn('[gumroad] no clan for event', ev.kind, ev.subscriptionId, ev.email);
    return Response.json({ received: true, note: 'no matching clan' });
  }

  const current = planOf(clan.plan);

  // Anything that GRANTS — a sale or a renewal — must name a sale Gumroad still stands behind, and one
  // we have not already applied. Replaying a captured notification otherwise re-ran the trial clock
  // and lifted a refund suspension, every time.
  if (ev.kind === 'sale' || ev.kind === 'recurring_charge') {
    if (ev.saleId && ev.saleId === clan.gumroadSaleId) {
      return Response.json({ received: true, note: 'already applied' });
    }
    const check = await checkSaleWithGumroad(ev.saleId, ev.productId);
    if (check === 'error') return new Response('Could not confirm the sale with Gumroad', { status: 503 });
    if (check === 'rejected') {
      await logBilling(clan.id, 'billing_rejected', { kind: ev.kind, sale: ev.saleId });
      return Response.json({ received: true, note: 'sale not confirmed by Gumroad' });
    }
  }

  switch (ev.kind) {
    // ── Paid, or a free trial started ────────────────────────────────────────────────────────
    case 'sale': {
      const plan = purchasedPlan(ev, current === PLANS.free ? PLANS.bronze : current);
      const trialEnd = ev.freeTrialEndsAt && !Number.isNaN(Date.parse(ev.freeTrialEndsAt)) ? new Date(ev.freeTrialEndsAt).toISOString() : trialEndsAtIso();
      await db
        .update(clans)
        .set({
          plan: plan.id,
          memberCap: plan.memberCap,
          gumroadSaleId: ev.saleId,
          gumroadSubscriptionId: ev.subscriptionId,
          gumroadProductId: ev.productId,
          gumroadProductPermalink: ev.productPermalink,
          // The owner's own address wins: people often pay from a different email than the one they
          // gave Anvil, and the one they gave us is where they expect to hear from us.
          contactEmail: clan.contactEmail ?? ev.email,
          trialEndsAt: trialEnd,
          // The first charge falls due when the trial runs out — and if it never comes, that date
          // going by is what marks the clan overdue (lib/clanBilling).
          currentPeriodEnd: trialEnd,
          cancelAtPeriodEnd: false,
          // Paying again lifts a suspension only when BILLING put it there (a refund or dispute).
          // A suspension staff applied is a judgement about the clan, and money does not overturn it.
          status: clan.status === 'suspended' && (await suspendedByBilling(clan.id)) ? 'active' : clan.status,
        })
        .where(eq(clans.id, clan.id));
      await logBilling(clan.id, 'billing_subscribed', { plan: plan.id, subscription: ev.subscriptionId });
      return Response.json({ received: true, plan: plan.id });
    }

    // ── Renewed ──────────────────────────────────────────────────────────────────────────────
    case 'recurring_charge': {
      // A charge on a clan already dropped to free is a membership taken up again (the restart's own
      // notification may come after it, or not at all): it gets back the plan it had.
      const plan = purchasedPlan(ev, current === PLANS.free ? ((await planBeforeEnd(clan.id)) ?? PLANS.bronze) : current);
      await db
        .update(clans)
        .set({
          plan: plan.id,
          memberCap: plan.memberCap,
          gumroadSaleId: ev.saleId ?? clan.gumroadSaleId, // each charge has its own id — the replay latch
          // Gumroad never says when the next charge is, only how often they come. Counting it here
          // is what lets a renewal that never arrives — a failed card — show up as overdue. Counted
          // from the CHARGE, not from now: a notification redelivered weeks late (lfl's September
          // charge arrived again in late October) otherwise moved the due date a month past a
          // charge that had already failed.
          currentPeriodEnd: nextChargeDue(ev.recurrence, chargedAt(ev.saleTimestamp)),
          cancelAtPeriodEnd: false,
          trialEndsAt: null, // a charge means the trial converted
        })
        .where(eq(clans.id, clan.id));
      await logBilling(clan.id, 'billing_renewed', { plan: plan.id });
      return Response.json({ received: true });
    }

    // ── Cancelled, but still inside the paid term ────────────────────────────────────────────
    case 'cancellation': {
      // Deliberately keeps the plan. They paid for this term and Gumroad is still serving it;
      // downgrading now would take back time already bought.
      await db.update(clans).set({ cancelAtPeriodEnd: true }).where(eq(clans.id, clan.id));
      await logBilling(clan.id, 'billing_cancelled', { plan: clan.plan, effective: 'period end' });
      return Response.json({ received: true });
    }

    // ── The term actually ended ──────────────────────────────────────────────────────────────
    case 'subscription_ended': {
      await endMembership(clan);
      return Response.json({ received: true });
    }

    // ── Taken up again after it ended or was cancelled ───────────────────────────────────────
    case 'restarted': {
      if (clan.status === 'suspended') {
        // A suspension is for a person to lift, never a webhook with no money attached.
        await logBilling(clan.id, 'billing_restart_ignored', { reason: 'suspended' });
        return Response.json({ received: true, note: 'suspended' });
      }
      // A restart names no sale, so the replay latch sales use can't apply. Gumroad is asked
      // whether the membership is running instead.
      const check = await checkSubscriptionWithGumroad(ev.subscriptionId);
      if (check === 'error') return new Response('Could not confirm the subscription with Gumroad', { status: 503 });
      if (check === 'dead') {
        await logBilling(clan.id, 'billing_rejected', { kind: ev.kind, subscription: ev.subscriptionId });
        return Response.json({ received: true, note: 'subscription not running' });
      }
      // Cancelled but still inside the term: only the cancel flag was ever set, so only it clears.
      if (current !== PLANS.free) {
        await db.update(clans).set({ cancelAtPeriodEnd: false }).where(eq(clans.id, clan.id));
        await logBilling(clan.id, 'billing_restarted', { plan: clan.plan, was: 'cancelling' });
        return Response.json({ received: true, plan: clan.plan });
      }
      // Ended. Only a clan whose last billing word was that end gets its plan back from it — a
      // replayed restart after a later refund or staff change finds nothing to restore.
      const before = await planBeforeEnd(clan.id);
      if (!before) {
        await logBilling(clan.id, 'billing_restart_ignored', { reason: 'nothing to restore' });
        return Response.json({ received: true, note: 'nothing to restore' });
      }
      const plan = purchasedPlan(ev, before);
      await db
        .update(clans)
        .set({
          plan: plan.id,
          memberCap: plan.memberCap,
          currentPeriodEnd: nextChargeDue(ev.recurrence, Date.now()),
          cancelAtPeriodEnd: false,
        })
        .where(eq(clans.id, clan.id));
      await logBilling(clan.id, 'billing_restarted', { plan: plan.id, was: 'ended' });
      return Response.json({ received: true, plan: plan.id });
    }

    // ── Refund or chargeback ─────────────────────────────────────────────────────────────────
    case 'refund':
    case 'dispute': {
      await db
        .update(clans)
        .set({
          plan: 'free',
          memberCap: PLANS.free.memberCap,
          // These DO suspend, unlike a lapse: money was taken back, so the clan stops serving until
          // a human looks at it.
          status: 'suspended',
          gumroadSubscriptionId: null,
          cancelAtPeriodEnd: false,
        })
        .where(eq(clans.id, clan.id));
      await logBilling(clan.id, `billing_${ev.kind}`, { from: clan.plan, sale: ev.saleId });
      return Response.json({ received: true });
    }

    default:
      await logBilling(clan.id, 'billing_unhandled', { kind: ev.kind });
      return Response.json({ received: true, note: 'unhandled kind' });
  }
}

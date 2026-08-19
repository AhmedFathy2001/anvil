import { NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans } from '@/db/schema';
import { parseWebhook, verifySeller, verifyWebhookSecret, TRIAL_DAYS } from '@/lib/gumroad';
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

async function logBilling(clanId: number, eventType: string, detail: unknown) {
  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      eventType,
      // No actor: this is Gumroad talking, not a person. Leaving it null is more honest than
      // attributing a machine event to whoever happens to own the clan.
      newValue: JSON.stringify(detail),
      notes: 'gumroad webhook',
    })
    .catch(() => {});
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
 * Three keys, most specific first. `ref` is the token we appended to the checkout URL, so it names
 * the clan that STARTED this purchase; the subscription id names one we have already seen; email is
 * the last resort for a sale that never went through our checkout at all.
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
  if (ev.email) {
    const byEmail = await db.query.clans.findFirst({
      where: sql`lower(${clans.contactEmail}) = ${ev.email.toLowerCase()}`,
    });
    if (byEmail) return byEmail;
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

  switch (ev.kind) {
    // ── Paid, or a free trial started ────────────────────────────────────────────────────────
    case 'sale': {
      const plan = purchasedPlan(ev, current === PLANS.free ? PLANS.bronze : current);
      await db
        .update(clans)
        .set({
          plan: plan.id,
          memberCap: plan.memberCap,
          gumroadSaleId: ev.saleId,
          gumroadSubscriptionId: ev.subscriptionId,
          gumroadProductId: ev.productId,
          gumroadProductPermalink: ev.productPermalink,
          contactEmail: ev.email ?? clan.contactEmail,
          trialEndsAt: trialEndsAtIso(),
          cancelAtPeriodEnd: false,
          // A previously-suspended clan that pays again comes back. Suspension for abuse is a
          // separate act and an operator re-applies it; letting a payment silently un-suspend an
          // abusive clan is the trade, and it is the rarer case.
          status: clan.status === 'suspended' ? 'active' : clan.status,
        })
        .where(eq(clans.id, clan.id));
      await logBilling(clan.id, 'billing_subscribed', { plan: plan.id, subscription: ev.subscriptionId });
      return Response.json({ received: true, plan: plan.id });
    }

    // ── Renewed ──────────────────────────────────────────────────────────────────────────────
    case 'recurring_charge': {
      const plan = purchasedPlan(ev, current);
      await db
        .update(clans)
        .set({
          plan: plan.id,
          memberCap: plan.memberCap,
          currentPeriodEnd: null, // Gumroad owns the term; we only mirror what it tells us next.
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
      await db
        .update(clans)
        .set({
          plan: 'free',
          memberCap: PLANS.free.memberCap,
          gumroadSubscriptionId: null, // freed, so the same clan can subscribe again later
          cancelAtPeriodEnd: false,
          trialEndsAt: null,
        })
        .where(eq(clans.id, clan.id));
      // Note what is NOT touched: status. The site stays up, the roster stays, the history stays.
      await logBilling(clan.id, 'billing_ended', { from: clan.plan, to: 'free' });
      return Response.json({ received: true });
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

import { NextRequest } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans } from '@/db/schema';
import { checkSaleWithGumroad, checkSubscriptionWithGumroad, nextChargeDue, parseWebhook, verifySeller, verifyWebhookSecret } from '@/lib/gumroad';
import { endMembership, logBilling } from '@/lib/billingLapse';
import { billingTierOf, catalogOfKind, endedTierFor, entryTierFor, freeTierFor, gumroadPurchase, withYearlyRecurrence, type BillingTier } from '@/lib/billingCatalog';
import { applyClanSale, chargedAt, purchasedPlan } from '@/lib/clanSale';
import { log } from '@/lib/logger';
import { handleSupporterEvent, isSupporterEvent } from '@/lib/supporterBilling';
import { planKindOf } from '@/lib/unmatchedPurchaseRules';
import { recordUnmatchedPurchase } from '@/lib/unmatchedPurchases';

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
 * TWO CATALOGUES, ONE WEBHOOK. A clan buys the clan ladder (lib/plans); a creator space buys its own
 * (lib/creatorCatalog, separate Gumroad products). Both correlate the same way (the `ref` on the
 * checkout URL, then the subscription id). The product decides the catalogue (lib/billingCatalog
 * gumroadPurchase), the row's `kind` decides which one it may have, and a sale from the other one is
 * logged, ignored and kept for staff (lib/unmatchedPurchases). Ending, cancelling, refunding work the same for both — to that catalogue's free.
 *
 * Always 200 on an authentic event we understood, so Gumroad marks it delivered; only a bad secret
 * 401s and only genuine failures 500 (which Gumroad retries).
 */

/**
 * The plan a clan had before its subscription ended, from the billing_ended entry that dropped it —
 * so taking the membership up again gives back what was paid for, not a guess. Only when nothing
 * has happened since: a refund, dispute or staff change after the end makes the old plan stale.
 * Read in the row's own catalogue (lib/billingCatalog endedTierFor).
 */
async function planBeforeEnd(clanId: number, kind: string): Promise<BillingTier | null> {
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
    return endedTierFor(kind, from);
  } catch {
    return null;
  }
}

/**
 * Is this notification for a product of the OTHER catalogue than the row's? A clan tier bought
 * through a creator space's checkout (its ref pasted onto a clan link), a creator tier bought for a
 * clan, or a renewal of one: never applied, logged for staff.
 *
 * A NEW SALE on a creator space must also identify as a creator product: its products are new and
 * always configured (GUMROAD_PRODUCT_CREATOR_*), so an unrecognised one proves nothing. A renewal or
 * restart is matched by a subscription the space already holds — applied from a sale that passed
 * this — so only a positive mismatch stops it. A clan keeps the old leniency (an unrecognised product
 * falls back to its current or entry tier) because its storefront predates product ids being set.
 */
function wrongCatalog(ev: ReturnType<typeof parseWebhook>, kind: string): string | null {
  const bought = gumroadPurchase(ev);
  const mine = catalogOfKind(kind);
  if (bought && bought.catalog !== mine) return bought.catalog;
  if (!bought && mine === 'creator' && ev.kind === 'sale') return 'unknown';
  return null;
}

/**
 * Find the clan a webhook is about.
 *
 * A new SALE is matched by `ref` first — the token we appended to the checkout URL, naming the clan
 * that started this purchase — then by subscription id. EVERYTHING ELSE (a renewal, a cancel, an end,
 * a refund) is about one particular membership, so it is matched by that membership's id alone. A
 * clan's ref rides along on every notification for every membership ever bought through its checkout:
 * lfl bought Silver and Gold in one cart, kept Silver, and a cancel of the stray Gold matched by ref
 * would have marked Silver as cancelling. A notification about a membership the clan no longer points
 * at finds no clan and changes nothing.
 *
 * NOT the email any more. `clans.contact_email` is free text a clan owner types and nobody verifies,
 * so matching on it let one clan set its email to a customer's and catch their upgrade — or catch
 * their refund and get suspended into someone else's dispute. A sale neither key matches is logged
 * and left for staff, which is the honest answer for a purchase that never came through our checkout.
 */
async function clanForEvent(ev: ReturnType<typeof parseWebhook>) {
  if (ev.kind === 'sale' && ev.urlParams.ref) {
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
  // A yearly-only product's ping is a one-year term even without `recurrence` (lib/billingInterval).
  const ev = withYearlyRecurrence(parseWebhook(raw));

  if (!verifySeller(ev.sellerId)) {
    return new Response('Invalid seller', { status: 401 });
  }

  // The personal Supporter subscription rides the same webhook but is about a person, not a clan.
  if (isSupporterEvent(ev)) {
    const result = await handleSupporterEvent(ev);
    return Response.json(result.body, { status: result.status });
  }

  const clan = await clanForEvent(ev);
  if (!clan) {
    // Nothing to attach it to. Logged rather than 500'd: retrying will not conjure a clan, and a
    // permanently-failing webhook is noise that hides the real ones. A sale with no clan is a
    // human problem — someone bought before creating one — so it is kept in the unmatched inbox on
    // /staff/subscriptions (lib/unmatchedPurchases) for staff to attach or dismiss; a later
    // notification for the same membership only updates that row. Best-effort: never fails this.
    console.warn('[gumroad] no clan for event', ev.kind, ev.subscriptionId, ev.email);
    await recordUnmatchedPurchase(ev, { kind: planKindOf(ev), reason: 'no-ref' });
    return Response.json({ received: true, note: 'no matching clan' });
  }

  // The clan's tier in its OWN catalogue (lib/billingCatalog): the clan ladder, or a creator space's.
  const current = billingTierOf(clan.kind, clan.plan);

  // A sale, renewal or restart of a product from the other catalogue changes nothing — whatever ref or
  // subscription it arrived with. Logged (audit + server log) so staff can refund or move it by hand.
  if (ev.kind === 'sale' || ev.kind === 'recurring_charge' || ev.kind === 'restarted') {
    const other = wrongCatalog(ev, clan.kind);
    if (other) {
      const detail = { kind: ev.kind, catalog: other, spaceKind: clan.kind, product: ev.productId, tier: ev.tier, sale: ev.saleId, subscription: ev.subscriptionId };
      await logBilling(clan.id, 'billing_wrong_catalog', detail);
      log.warn('gumroad.wrong-catalog', { clanId: clan.id, ...detail });
      // Kept for staff too (the unmatched inbox), with the space whose checkout it came through: a
      // creator tier in the same cart as a clan tier is a real purchase that belongs on a creator space.
      // The product decides the row's kind; one neither catalogue knows is filed as a clan plan.
      await recordUnmatchedPurchase(ev, { kind: other === 'creator' ? 'creator' : 'plan', reason: 'cross-catalogue', refClanId: clan.id });
      return Response.json({ received: true, note: 'product is for another kind of space' });
    }
  }

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
      // What a matched sale does lives in lib/clanSale, shared with staff attaching an unmatched one.
      return Response.json(await applyClanSale(clan, ev));
    }

    // ── Renewed ──────────────────────────────────────────────────────────────────────────────
    case 'recurring_charge': {
      // A charge on a clan already dropped to free is a membership taken up again (the restart's own
      // notification may come after it, or not at all): it gets back the plan it had.
      const plan = purchasedPlan(ev, clan.kind, current.free ? ((await planBeforeEnd(clan.id, clan.kind)) ?? entryTierFor(clan.kind)) : current);
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
      if (!current.free) {
        await db.update(clans).set({ cancelAtPeriodEnd: false }).where(eq(clans.id, clan.id));
        await logBilling(clan.id, 'billing_restarted', { plan: clan.plan, was: 'cancelling' });
        return Response.json({ received: true, plan: clan.plan });
      }
      // Ended. Only a clan whose last billing word was that end gets its plan back from it — a
      // replayed restart after a later refund or staff change finds nothing to restore.
      const before = await planBeforeEnd(clan.id, clan.kind);
      if (!before) {
        await logBilling(clan.id, 'billing_restart_ignored', { reason: 'nothing to restore' });
        return Response.json({ received: true, note: 'nothing to restore' });
      }
      const plan = purchasedPlan(ev, clan.kind, before);
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
          plan: freeTierFor(clan.kind).id,
          memberCap: freeTierFor(clan.kind).memberCap,
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

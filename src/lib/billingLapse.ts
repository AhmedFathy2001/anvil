// A membership that stopped being paid for, noticed from our side.
//
// The webhook drops a clan to free when Gumroad says `subscription_ended`. Gumroad does not always
// say it: a membership whose card fails sits in `failed_payment` with no end date, indefinitely, and
// sends nothing more. lfl ran on Silver for weeks that way — paid in September, failed in October,
// and nothing here ever learned of it. So once a day every paying clan whose renewal date has gone by
// (or that never had one recorded) is checked with Gumroad directly, and one Gumroad no longer runs
// is ended exactly the way the webhook ends it. Paying again — a charge, a restart, a new checkout —
// gives the plan back through the webhook's existing paths, which read the billing_ended entry.

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans } from '@/db/schema';
import { daysUntil } from '@/lib/clanBilling';
import { checkSubscriptionWithGumroad } from '@/lib/gumroad';
import { PLANS } from '@/lib/plans';
import { log } from '@/lib/logger';

export async function logBilling(clanId: number, eventType: string, detail: unknown, notes = 'gumroad webhook') {
  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      eventType,
      // No actor: this is Gumroad talking (or our check of it), not a person. Leaving it null is more
      // honest than attributing a machine event to whoever happens to own the clan.
      newValue: JSON.stringify(detail),
      notes,
    })
    .catch(() => {});
}

/** Drop a clan to free because its membership ended. Status is NOT touched: the site, roster and history stay. */
export async function endMembership(clan: { id: number; plan: string }, notes = 'gumroad webhook', reason?: string) {
  await db
    .update(clans)
    .set({
      plan: 'free',
      memberCap: PLANS.free.memberCap,
      // KEPT, not cleared. A membership taken up again from Gumroad's side arrives as a restart
      // naming only this id — clearing it left that notification with no clan to find. A plan of
      // free is what says "not paying" (lib/clanBilling subscriptionFacts); a new checkout
      // overwrites the id anyway.
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
    })
    .where(eq(clans.id, clan.id));
  await logBilling(clan.id, 'billing_ended', { from: clan.plan, to: 'free', ...(reason ? { reason } : {}) }, notes);
}

/** A renewal webhook can land a little late; past this, a missing one is worth asking Gumroad about. */
const GRACE_DAYS = 1;

export interface LapseSweepResult {
  checked: number;
  ended: string[];
  errors: number;
  skipped?: 'no-token';
}

export async function sweepLapsedBilling(now = Date.now()): Promise<LapseSweepResult> {
  if (!process.env.GUMROAD_ACCESS_TOKEN) return { checked: 0, ended: [], errors: 0, skipped: 'no-token' };

  // clan-scope: global -- billing is the platform's; a handful of paying rows, filtered in JS because
  // the period column holds two timestamp shapes (lib/dbTime) and only daysUntil reads both.
  const paying = await db
    .select({
      id: clans.id,
      slug: clans.slug,
      plan: clans.plan,
      status: clans.status,
      subscriptionId: clans.gumroadSubscriptionId,
      currentPeriodEnd: clans.currentPeriodEnd,
    })
    .from(clans);

  const due = paying.filter((c) => {
    if (!c.subscriptionId || c.plan === 'free' || c.status === 'suspended') return false;
    const days = daysUntil(c.currentPeriodEnd, now);
    // No date at all is a subscription from before renewals recorded one — the case that hid lfl.
    return days == null || days < -GRACE_DAYS;
  });

  const result: LapseSweepResult = { checked: due.length, ended: [], errors: 0 };
  for (const clan of due) {
    const check = await checkSubscriptionWithGumroad(clan.subscriptionId);
    if (check === 'dead') {
      await endMembership(clan, 'billing check', 'gumroad no longer runs this membership');
      result.ended.push(clan.slug);
      log.info('billing-lapse.ended', { clanId: clan.id, from: clan.plan });
    } else if (check === 'error') {
      result.errors += 1;
    }
  }
  return result;
}

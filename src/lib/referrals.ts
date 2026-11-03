// Referrals: invite codes, held rewards and granting them (rules in lib/referralRules).
//
// The invite link is /r/<code>; it leaves a cookie, and the Supporter checkout carries the code to
// Gumroad as `via`, which comes back on the sale webhook (lib/supporterBilling). Only a purchase
// counts, attributed by that echo — never by email — and nobody can refer themselves.

import { randomBytes } from 'node:crypto';

import { and, eq, inArray, lte, sql } from 'drizzle-orm';

import { db } from '@/db';
import { referrals, supporterSubscriptions, users } from '@/db/schema';
import { log } from '@/lib/logger';
import { cappedReward, grantAfter, grantWindow, isReferralCode, milestoneAt, nextMilestone, rewardMonths } from '@/lib/referralRules';
import { parseStamp, rowInForce, SUPPORTER_TIERS, type SupporterTierId } from '@/lib/supporterTiers';

export const REFERRAL_COOKIE = 'anvil_via';

function newCode(): string {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

/** This person's invite code, made on first use. */
export async function ensureReferralCode(userId: number): Promise<string> {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { referralCode: true } });
  if (row?.referralCode) return row.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    try {
      await db.update(users).set({ referralCode: code }).where(eq(users.id, userId));
      return code;
    } catch {
      // a clash on the unique index: try another
    }
  }
  throw new Error('could not make a referral code');
}

export async function referrerForCode(code: string): Promise<number | null> {
  if (!isReferralCode(code)) return null;
  const row = await db.query.users.findFirst({ where: eq(users.referralCode, code), columns: { id: true } });
  return row?.id ?? null;
}

/** A Supporter purchase made through an invite: hold the referrer's reward. Never throws. */
export async function recordSupporterReferral(args: {
  code: string;
  buyerUserId: number;
  subscriptionId: string | null;
  saleId: string | null;
  recurrence: string | null;
  trialEndsAt: number | null;
}): Promise<void> {
  try {
    const referrer = await referrerForCode(args.code);
    if (referrer == null || referrer === args.buyerUserId) return;
    await db
      .insert(referrals)
      .values({
        referrerUserId: referrer,
        referredUserId: args.buyerUserId,
        kind: 'supporter',
        gumroadSubscriptionId: args.subscriptionId,
        gumroadSaleId: args.saleId,
        recurrence: args.recurrence,
        status: 'held',
        rewardMonths: rewardMonths(args.recurrence),
        grantAfter: new Date(grantAfter(Date.now(), args.trialEndsAt)).toISOString(),
      })
      .onConflictDoNothing();
  } catch (err) {
    log.warn('referral.record-failed', { message: (err as Error).message });
  }
}

/** The purchase behind a referral was refunded or never paid: take the reward back. */
export async function revokeReferrals(subscriptionId: string, opts: { heldOnly: boolean }): Promise<void> {
  await db.transaction(async (tx) => {
    // Locked, so a grant in flight for the same referral finishes first and is then taken back.
    const rows = await tx.select().from(referrals).where(eq(referrals.gumroadSubscriptionId, subscriptionId)).for('update');
    for (const r of rows) {
      if (r.status === 'revoked' || (opts.heldOnly && r.status !== 'held')) continue;
      if (r.status === 'granted' && r.rewardSubscriptionId) {
        await tx
          .update(supporterSubscriptions)
          .set({ status: 'refunded', endedAt: new Date().toISOString() })
          .where(eq(supporterSubscriptions.id, r.rewardSubscriptionId));
      }
      await tx.update(referrals).set({ status: 'revoked' }).where(eq(referrals.id, r.id));
    }
  });
}

/** Grant every held reward whose wait is over and whose purchase still stands. How many were granted. */
export async function grantDueReferrals(now = Date.now()): Promise<number> {
  const due = await db.query.referrals.findMany({
    where: and(eq(referrals.status, 'held'), lte(referrals.grantAfter, new Date(now).toISOString())),
    limit: 200,
  });
  let granted = 0;
  for (const r of due) {
    // One transaction per referral, claimed with a conditional update: two ticks (or a tick racing a
    // refund) can't both act on it, and a refund that lands first leaves nothing to claim.
    const done = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(referrals)
        .set({ status: 'granting' })
        .where(and(eq(referrals.id, r.id), eq(referrals.status, 'held')))
        .returning({ id: referrals.id });
      if (!claimed) return false;
      // The purchase must still be standing: refunded or never charged means no reward. Locked so a
      // refund for it waits until this grant is committed, then finds it and takes it back.
      const [bought] = r.gumroadSubscriptionId
        ? await tx
            .select()
            .from(supporterSubscriptions)
            .where(eq(supporterSubscriptions.gumroadSubscriptionId, r.gumroadSubscriptionId))
            .for('update')
        : [];
      if (!bought || bought.status === 'refunded' || bought.status === 'ended') {
        await tx.update(referrals).set({ status: 'revoked' }).where(eq(referrals.id, r.id));
        return false;
      }
      const mine = await tx.select().from(supporterSubscriptions).where(eq(supporterSubscriptions.userId, r.referrerUserId));
      const paid =
        mine
          .filter((m) => m.status !== 'granted' && rowInForce(m, now))
          .map((m) => m.tier as SupporterTierId)
          .sort((a, b) => SUPPORTER_TIERS[b].rank - SUPPORTER_TIERS[a].rank)[0] ?? null;
      const banked = mine.filter((m) => m.status === 'granted').map((m) => parseStamp(m.currentPeriodEnd));
      const { start, end } = grantWindow(now, banked, r.rewardMonths);
      const [reward] = await tx
        .insert(supporterSubscriptions)
        .values({
          userId: r.referrerUserId,
          // Never worth more than what the friend bought.
          tier: cappedReward(paid, bought.tier as SupporterTierId),
          status: 'granted',
          recurrence: 'referral',
          currentPeriodEnd: new Date(end).toISOString(),
          startedAt: new Date(start).toISOString(),
        })
        .returning({ id: supporterSubscriptions.id });
      await tx.update(referrals).set({ status: 'granted', rewardSubscriptionId: reward.id }).where(eq(referrals.id, r.id));

      // A milestone reached by this friend: granted once, after the reward above. Locked per referrer
      // so two grants landing together can't both see "the third" and pay it twice.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('referral-milestone'), ${r.referrerUserId})`);
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(referrals)
        .where(and(eq(referrals.referrerUserId, r.referrerUserId), eq(referrals.status, 'granted')));
      const milestone = milestoneAt(n);
      const marker = milestone ? `referral-milestone-${milestone.at}` : null;
      const already = marker
        ? await tx
            .select({ id: supporterSubscriptions.id })
            .from(supporterSubscriptions)
            .where(and(eq(supporterSubscriptions.userId, r.referrerUserId), eq(supporterSubscriptions.recurrence, marker)))
            .limit(1)
        : [];
      if (milestone && marker && already.length === 0) {
        const window2 = grantWindow(now, [...banked, end], milestone.months);
        await tx.insert(supporterSubscriptions).values({
          userId: r.referrerUserId,
          tier: milestone.tier,
          status: 'granted',
          recurrence: marker,
          currentPeriodEnd: new Date(window2.end).toISOString(),
          startedAt: new Date(window2.start).toISOString(),
        });
      }
      return true;
    });
    if (done) granted++;
  }
  return granted;
}

export interface ReferralSummary {
  code: string;
  held: number;
  granted: number;
  monthsEarned: number;
  /** Towards the next milestone (lib/referralRules), or null once every one is reached. */
  next: { from: number; to: number; label: string } | null;
}

export async function referralSummary(userId: number): Promise<ReferralSummary> {
  const code = await ensureReferralCode(userId);
  const rows = await db.query.referrals.findMany({
    where: and(eq(referrals.referrerUserId, userId), inArray(referrals.status, ['held', 'granted'])),
    columns: { status: true, rewardMonths: true },
  });
  return {
    code,
    held: rows.filter((r) => r.status === 'held').length,
    granted: rows.filter((r) => r.status === 'granted').length,
    monthsEarned: rows.filter((r) => r.status === 'granted').reduce((n, r) => n + r.rewardMonths, 0),
    next: nextMilestone(rows.filter((r) => r.status === 'granted').length),
  };
}

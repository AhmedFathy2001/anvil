// Unused trial days, given back as money when a clan subscribes before its Anvil trial ends.
//
// Anvil's plan trial takes no card, so a clan that subscribes on day 19 of 30 pays for a month it
// already had 11 free days of. Gumroad cannot start a membership later or discount only the first
// charge from the API (a code made there discounts every renewal), so the unused share is REFUNDED:
// the clan pays the normal price, and the site gives back price × unused days ÷ days in the term on
// that one sale. Nothing to share or reuse: the refund is issued against the clan's own sale, once,
// claimed on its trial row before any money moves.
//
// OFF unless ANVIL_TRIAL_REFUND=on. Off, a sale that would have had a refund only records what it
// would have been (billing_trial_refund, `dry`), so the numbers can be checked before it is trusted
// with money.

import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { ownerTrials } from '@/db/schema';
import { logBilling } from '@/lib/billingLapse';
import type { GumroadEvent } from '@/lib/gumroad';
import { log } from '@/lib/logger';

const DAY_MS = 86_400_000;
/** Days in a paid term, for the share a trial day is worth. An unknown recurrence counts as monthly. */
const TERM_DAYS: Record<string, number> = { monthly: 30, quarterly: 91, biannually: 182, yearly: 365, every_two_years: 730 };
/** Never the whole payment: a full refund ends the membership on Gumroad. */
export const MAX_REFUND_SHARE = 0.9;
/** A sale older than this gets no automatic refund: its date is the notification's word, and an old one would count days already used. */
export const MAX_SALE_AGE_MS = 48 * 3_600_000;
/** Below this it is not worth a card transaction. */
export const MIN_REFUND_CENTS = 50;

export const trialRefundOn = (env: Record<string, string | undefined> = process.env): boolean => env.ANVIL_TRIAL_REFUND === 'on';

/**
 * What to give back, in cents, and the whole unused days it stands for. Days are counted down (a
 * part day is not a day), the share is capped, and anything tiny is nothing.
 */
export function trialRefundCents(f: { priceCents: number | null; recurrence: string | null; trialEndsAtMs: number; chargedAtMs: number }): { cents: number; days: number } {
  const days = Math.floor((f.trialEndsAtMs - f.chargedAtMs) / DAY_MS);
  const price = f.priceCents ?? 0;
  if (!(days > 0) || !(price > 0)) return { cents: 0, days: Math.max(0, days) };
  const term = TERM_DAYS[f.recurrence ?? 'monthly'] ?? TERM_DAYS.monthly;
  const cents = Math.floor(price * Math.min(MAX_REFUND_SHARE, days / term));
  return cents >= MIN_REFUND_CENTS ? { cents, days } : { cents: 0, days };
}

export type RefundCall = { ok: true } | { ok: false; status: number | null; detail: string };

/** Ask Gumroad to give part of a sale back. The token needs permission to refund sales. */
export async function refundSalePartially(saleId: string, cents: number, fetcher: typeof fetch = fetch): Promise<RefundCall> {
  const token = process.env.GUMROAD_ACCESS_TOKEN;
  if (!token) return { ok: false, status: null, detail: 'no GUMROAD_ACCESS_TOKEN' };
  try {
    const res = await fetcher(`https://api.gumroad.com/v2/sales/${encodeURIComponent(saleId)}/refund`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ amount_cents: String(cents) }).toString(),
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });
    const body = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    if (res.ok && body?.success) return { ok: true };
    return { ok: false, status: res.status, detail: (body?.message ?? '').slice(0, 200) };
  } catch (error) {
    return { ok: false, status: null, detail: String(error).slice(0, 200) };
  }
}

/**
 * After a clan's plan sale has been applied: give back the unused share of its running Anvil trial.
 * Never throws: a refund that fails is recorded for staff and the sale stands.
 */
export async function refundUnusedTrial(clanId: number, ev: GumroadEvent, chargedAtMs: number, notes = 'gumroad webhook'): Promise<void> {
  try {
    // A first purchase only: a renewal has no trial left to give back.
    if (ev.isRecurringCharge || !ev.saleId || !(ev.priceCents != null && ev.priceCents > 0)) return;
    // clan-scope: this clan -- the trial row is read by the clan id the sale was matched to.
    const [trial] = await db
      .select()
      .from(ownerTrials)
      .where(and(eq(ownerTrials.kind, 'plan'), eq(ownerTrials.clanId, clanId), isNull(ownerTrials.revokedAt), isNull(ownerTrials.convertedAt), sql`${ownerTrials.endsAt} > ${new Date(chargedAtMs).toISOString()}`))
      .limit(1);
    if (!trial) return;
    // Only a sale made just now, during the trial. The charge time comes from the notification, so it
    // is never trusted to be older than two days, nor earlier than the trial itself.
    if (Date.now() - chargedAtMs > MAX_SALE_AGE_MS) return;
    const from = Math.max(chargedAtMs, trial.startsAt.getTime());
    const { cents, days } = trialRefundCents({ priceCents: ev.priceCents, recurrence: ev.recurrence, trialEndsAtMs: trial.endsAt.getTime(), chargedAtMs: from });
    if (cents <= 0) return;
    const detail = { sale: ev.saleId, cents, days, price: ev.priceCents, recurrence: ev.recurrence };
    if (!trialRefundOn()) {
      await logBilling(clanId, 'billing_trial_refund', { ...detail, dry: true }, notes);
      return;
    }
    // Claimed first: the trial becomes "converted" for exactly one caller, so a redelivered
    // notification (or two at once) can never refund twice.
    const claimed = await db
      .update(ownerTrials)
      .set({ convertedAt: new Date(chargedAtMs) })
      .where(and(eq(ownerTrials.id, trial.id), isNull(ownerTrials.convertedAt)))
      .returning({ id: ownerTrials.id });
    if (!claimed.length) return;
    const res = await refundSalePartially(ev.saleId, cents);
    await logBilling(clanId, 'billing_trial_refund', res.ok ? { ...detail, refunded: true } : { ...detail, refunded: false, status: res.status, error: res.detail }, notes);
    if (!res.ok) log.warn('trial-refund.failed', { clanId, sale: ev.saleId, status: res.status });
  } catch (error) {
    log.warn('trial-refund.error', { clanId, sale: ev.saleId }, error);
  }
}

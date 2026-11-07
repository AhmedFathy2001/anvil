// Unmatched Gumroad purchases: the pure half (no database), so the rules can be tested on their own.
//
// The webhook attaches a clan/creator plan sale to a space ONLY by its checkout `ref` or a subscription
// the space already holds, and a Supporter sale only by the buyer's `users.supporter_ref` — never by
// email, which nobody verifies. A sale neither matches used to be a console.warn that went with the
// container on the next deploy. lib/unmatchedPurchases keeps it instead; this module decides what the
// row says and what staff may do with it.

import { catalogOfKind, gumroadPurchase } from '@/lib/billingCatalog';
import type { GumroadEvent, GumroadEventKind } from '@/lib/gumroad';
import { supporterTierForGumroad } from '@/lib/supporterTiers';

/** What was bought: a clan plan, a creator-space plan, or a personal Supporter tier. */
export type UnmatchedKind = 'plan' | 'creator' | 'supporter';
/**
 * Why nothing took it:
 *   no-ref           a plan sale whose checkout ref names no clan (or that carried none)
 *   cross-catalogue  a creator product through a clan's checkout ref, or a clan product through a
 *                    creator space's (ref_clan_id says whose)
 *   no-buyer         a Supporter sale whose ref names no user
 */
export type UnmatchedReason = 'no-ref' | 'cross-catalogue' | 'no-buyer';
export type UnmatchedStatus = 'open' | 'attached' | 'dismissed';
/** The last thing Gumroad said about the membership, while the row is open. */
export type GumroadState = 'sold' | 'renewed' | 'cancelled' | 'ended' | 'restarted' | 'refunded' | 'disputed';

export const UNMATCHED_KINDS: readonly UnmatchedKind[] = ['plan', 'creator', 'supporter'];
export const UNMATCHED_REASONS: readonly UnmatchedReason[] = ['no-ref', 'cross-catalogue', 'no-buyer'];

/** Longest resolution note kept. */
export const MAX_NOTE = 500;

/**
 * Which plan catalogue a non-Supporter sale is from, by the product / tier it names
 * (lib/billingCatalog gumroadPurchase). A product neither catalogue recognises reads as a clan plan:
 * the clan storefront predates product ids being configured, and the webhook gives clans the same
 * leniency.
 */
export function planKindOf(ev: Pick<GumroadEvent, 'productId' | 'tier'>): 'plan' | 'creator' {
  return gumroadPurchase(ev)?.catalog === 'creator' ? 'creator' : 'plan';
}

/** The tier id we read the sale as, in its own catalogue; null when it names none we know. */
export function planIdOf(ev: Pick<GumroadEvent, 'productId' | 'tier'>, kind: UnmatchedKind): string | null {
  if (kind === 'supporter') return supporterTierForGumroad(ev.tier);
  const bought = gumroadPurchase(ev);
  if (!bought) return null;
  return (bought.catalog === 'creator') === (kind === 'creator') ? bought.tier.id : null;
}

/** What a notification about the membership moves an open row's gumroad_state to (null: nothing). */
export function gumroadStateAfter(kind: GumroadEventKind): GumroadState | null {
  switch (kind) {
    case 'recurring_charge':
      return 'renewed';
    case 'cancellation':
      return 'cancelled';
    case 'subscription_ended':
      return 'ended';
    case 'restarted':
      return 'restarted';
    case 'refund':
      return 'refunded';
    case 'dispute':
      return 'disputed';
    default:
      return null;
  }
}

/** The columns of a new unmatched_purchases row, from the sale notification that found no home. */
export interface UnmatchedRowValues {
  kind: UnmatchedKind;
  reason: UnmatchedReason;
  gumroadSaleId: string | null;
  gumroadSubscriptionId: string | null;
  productId: string | null;
  productName: string | null;
  productPermalink: string | null;
  tier: string | null;
  planId: string | null;
  recurrence: string | null;
  priceCents: number | null;
  currency: string | null;
  buyerEmail: string | null;
  ref: string | null;
  urlParams: Record<string, string> | null;
  freeTrialEndsAt: string | null;
  saleTimestamp: string | null;
  refClanId: number | null;
}

const clip = (v: string | null | undefined, n = 300): string | null => (v == null || v === '' ? null : v.slice(0, n));

export function unmatchedRowFromEvent(
  ev: GumroadEvent,
  opts: { kind: UnmatchedKind; reason: UnmatchedReason; refClanId?: number | null },
): UnmatchedRowValues {
  const params = Object.fromEntries(
    Object.entries(ev.urlParams ?? {})
      .slice(0, 20)
      .map(([k, v]) => [k.slice(0, 60), String(v).slice(0, 300)]),
  );
  return {
    kind: opts.kind,
    reason: opts.reason,
    gumroadSaleId: clip(ev.saleId),
    gumroadSubscriptionId: clip(ev.subscriptionId),
    productId: clip(ev.productId),
    productName: clip(ev.productName),
    productPermalink: clip(ev.productPermalink),
    tier: clip(ev.tier, 100),
    planId: planIdOf(ev, opts.kind),
    recurrence: clip(ev.recurrence, 40),
    priceCents: ev.priceCents != null && Number.isFinite(ev.priceCents) ? Math.round(ev.priceCents) : null,
    currency: clip(ev.currency, 10),
    buyerEmail: clip(ev.email),
    ref: clip(ev.urlParams?.ref, 100),
    urlParams: Object.keys(params).length ? params : null,
    freeTrialEndsAt: clip(ev.freeTrialEndsAt, 60),
    saleTimestamp: clip(ev.saleTimestamp, 60),
    refClanId: opts.refClanId ?? null,
  };
}

/** The sale notification again, from the row — what an attach replays through the webhook's own apply. */
export function eventFromRow(row: {
  gumroadSaleId: string | null;
  gumroadSubscriptionId: string | null;
  productId: string | null;
  productName: string | null;
  productPermalink: string | null;
  tier: string | null;
  recurrence: string | null;
  priceCents: number | null;
  currency: string | null;
  buyerEmail: string | null;
  urlParams: Record<string, string> | null;
  freeTrialEndsAt: string | null;
  saleTimestamp: string | null;
}): GumroadEvent {
  return {
    kind: 'sale',
    sellerId: null,
    saleId: row.gumroadSaleId,
    subscriptionId: row.gumroadSubscriptionId,
    productId: row.productId,
    productPermalink: row.productPermalink,
    productName: row.productName,
    currency: row.currency,
    tier: row.tier,
    email: row.buyerEmail,
    priceCents: row.priceCents,
    recurrence: row.recurrence,
    freeTrialEndsAt: row.freeTrialEndsAt,
    saleTimestamp: row.saleTimestamp,
    isRecurringCharge: false,
    urlParams: row.urlParams ?? {},
  };
}

/**
 * May a purchase of this kind be attached to this space? A creator product only to a creator space, a
 * clan product only to a clan — the same rule the webhook's wrongCatalog enforces, and the database's
 * clans_plan_matches_kind would refuse the other anyway. Null when it may; the reason when not.
 */
export function attachTargetProblem(kind: string, target: { kind: string | null; status?: string | null }): string | null {
  if (kind === 'supporter') return 'A Supporter purchase is attached to a person, not a space.';
  if (kind !== 'plan' && kind !== 'creator') return 'Unknown purchase kind.';
  const want = kind === 'creator' ? 'creator' : 'clan';
  if (catalogOfKind(target.kind) !== want) {
    return want === 'creator'
      ? 'This is a creator-space product: it can only go on a creator space.'
      : 'This is a clan plan: it can only go on a clan, not a creator space.';
  }
  // An archived space is gone from the product. A suspended one may still take it: the webhook applies
  // a sale to a suspended clan too, and lifts the suspension only when billing put it there.
  if (target.status === 'archived') return 'That space is archived; attach to a live one.';
  return null;
}

/**
 * Would attaching replace a membership the space already has? A space on a paid plan, or holding
 * another Gumroad subscription, is only overwritten when staff say so (`confirmReplace`). Null when it
 * is clear to go ahead; otherwise what staff are asked to confirm.
 */
export function replaceProblem(
  target: { planIsFree: boolean; gumroadSubscriptionId: string | null },
  subscriptionId: string | null,
  confirmReplace: boolean,
): string | null {
  if (confirmReplace) return null;
  const otherSub = !!target.gumroadSubscriptionId && target.gumroadSubscriptionId !== subscriptionId;
  if (!target.planIsFree || otherSub) {
    return otherSub
      ? `That space already has another Gumroad membership (${target.gumroadSubscriptionId}). Confirm to replace it; the old one keeps charging on Gumroad until it is cancelled there.`
      : 'That space is already on a paid plan. Confirm to replace it.';
  }
  return null;
}

/** A staff note, trimmed and capped; null when there is nothing in it. */
export function cleanNote(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t ? t.slice(0, MAX_NOTE) : null;
}

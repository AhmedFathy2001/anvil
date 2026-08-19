// Gumroad (Merchant of Record) integration. Gumroad has no SDK we need — it POSTs form-encoded
// notifications to our webhook (Ping and/or resource subscriptions), and that's all the billing flow
// relies on: the buyer configures + pays on a hosted Gumroad product, and we react to the webhook.
//
// Moved here from the control plane, unchanged apart from where its plan lookups live. The parsing
// is the part worth keeping intact: Gumroad sends two different shapes (Ping infers the event from
// boolean flags, resource subscriptions name it in `resource_name`) and normalising both into one
// event is what the webhook handler is written against.
//
// Config (env):
//   GUMROAD_SELLER_ID          — your Gumroad seller/user id; every webhook carries `seller_id`,
//                                we only trust POSTs where it matches.
//   GUMROAD_PRODUCT_{BRONZE,SILVER,GOLD} — product ids → tier (see plans.ts).
//   GUMROAD_URL_{BRONZE,SILVER,GOLD}     — the hosted checkout URL per tier (see plans.ts).
//   GUMROAD_TRIAL_DAYS         — cosmetic only; mirrors the free trial set on the Gumroad products
//                                so we can show "trial ends in N days" (default 30).

import crypto from 'crypto';

export { TRIAL_DAYS } from '@/lib/plans';

export function isConfigured(): boolean {
  return !!process.env.GUMROAD_SELLER_ID && !!process.env.GUMROAD_WEBHOOK_SECRET;
}

/** Constant-time string compare that doesn't leak length via early return. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // Hash to a fixed length first so differing lengths don't throw / leak.
  const ha = crypto.createHash('sha256').update(ab).digest();
  const hb = crypto.createHash('sha256').update(bb).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Primary trust gate. Gumroad's Ping/resource-subscriptions carry no HMAC signature, so we authenticate
 * the webhook by a secret we put in the Ping URL itself (?key=… or a secret path segment): only requests
 * presenting GUMROAD_WEBHOOK_SECRET are processed. Body fields like `seller_id` are NOT secret (they
 * appear in public product URLs/API) and must never be the sole check — an attacker could otherwise POST
 * a forged "sale" and have a clan provisioned for free.
 */
export function verifyWebhookSecret(presented: string | null | undefined): boolean {
  const expected = process.env.GUMROAD_WEBHOOK_SECRET;
  return !!expected && !!presented && safeEqual(presented, expected);
}

/** Defense-in-depth only (never the sole gate): the notification's seller id matches ours. */
export function verifySeller(sellerId: string | null | undefined): boolean {
  const expected = process.env.GUMROAD_SELLER_ID;
  return !!expected && !!sellerId && sellerId === expected;
}

/** Lifecycle event, normalized across Ping (flag-based) and resource subscriptions (resource_name). */
export type GumroadEventKind =
  | 'sale'                  // new purchase OR free-trial start
  | 'recurring_charge'      // subscription renewed and was charged
  | 'cancellation'          // buyer cancelled (stays active until period end)
  | 'subscription_ended'    // membership fully ended (failed payment / trial not converted / expired)
  | 'refund'
  | 'dispute'
  | 'other';

export interface GumroadEvent {
  kind: GumroadEventKind;
  sellerId: string | null;
  saleId: string | null;
  subscriptionId: string | null;
  productId: string | null;
  productPermalink: string | null;
  /** Membership tier name, e.g. "Gold" — set when one product has multiple tiers (variants[Tier]). */
  tier: string | null;
  email: string | null;
  priceCents: number | null;
  recurrence: string | null;      // 'monthly' | 'yearly' | ...
  isRecurringCharge: boolean;
  /** Query params we appended to the checkout URL, echoed back (our correlation `ref` lives here). */
  urlParams: Record<string, string>;
}

function bool(v: string | null): boolean {
  return v === 'true' || v === '1';
}

/** Parse a form-encoded Gumroad webhook body into a normalized event. */
export function parseWebhook(raw: string): GumroadEvent {
  const p = new URLSearchParams(raw);
  const get = (k: string) => p.get(k);

  // url_params[foo]=bar → urlParams.foo = bar ; variants[Tier]=Gold → variants.Tier = Gold
  const urlParams: Record<string, string> = {};
  const variants: Record<string, string> = {};
  for (const [k, v] of p.entries()) {
    const up = /^url_params\[(.+)\]$/.exec(k);
    if (up) { urlParams[up[1]] = v; continue; }
    const va = /^variants\[(.+)\]$/.exec(k);
    if (va) variants[va[1]] = v;
  }
  // Membership tier lives in variants (category usually "Tier"); fall back to a plain `tier` field.
  const tier = variants['Tier'] ?? Object.values(variants)[0] ?? get('tier') ?? null;

  const resourceName = get('resource_name'); // present on resource subscriptions, absent on Ping
  const isRecurringCharge = bool(get('is_recurring_charge'));
  const refunded = bool(get('refunded')) || bool(get('partially_refunded'));
  const disputed = bool(get('disputed'));
  const cancelled = bool(get('cancelled'));
  const ended = bool(get('subscription_ended')) || !!get('subscription_ended_at') || !!get('ended_at');

  let kind: GumroadEventKind;
  if (resourceName) {
    switch (resourceName) {
      case 'sale':                  kind = isRecurringCharge ? 'recurring_charge' : 'sale'; break;
      case 'refund':                kind = 'refund'; break;
      case 'dispute':               kind = 'dispute'; break;
      case 'cancellation':          kind = 'cancellation'; break;
      case 'subscription_ended':    kind = 'subscription_ended'; break;
      // subscription_updated / _restarted etc. — reconcile as a sale (active) when charged.
      default:                      kind = isRecurringCharge ? 'recurring_charge' : 'other';
    }
  } else {
    // Ping: infer from flags.
    if (refunded) kind = 'refund';
    else if (disputed) kind = 'dispute';
    else if (ended) kind = 'subscription_ended';
    else if (cancelled) kind = 'cancellation';
    else if (isRecurringCharge) kind = 'recurring_charge';
    else kind = 'sale';
  }

  const priceStr = get('price');
  return {
    kind,
    sellerId: get('seller_id'),
    saleId: get('sale_id'),
    subscriptionId: get('subscription_id'),
    productId: get('product_id'),
    productPermalink: get('product_permalink'),
    tier,
    email: get('email'),
    priceCents: priceStr != null ? Number(priceStr) : null,
    recurrence: get('recurrence'),
    isRecurringCharge,
    urlParams,
  };
}

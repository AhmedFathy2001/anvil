// Monthly or yearly: the billing interval for clan and creator plans, the way Supporter already has it.
//
// The rule is Supporter's (lib/supporterTiers: $1/mo or $10/yr, $2 or $20, $5 or $50): a year costs
// ten months, so yearly is "two months free". Clan (lib/plans) and creator (lib/creatorCatalog) tiers
// use the same rule on their monthly floor, so a yearly price is never a number someone has to keep in
// step by hand. Gumroad holds the real charge, as for monthly.
//
// A tier's yearly checkout is its own env (GUMROAD_URL_<TIER>_YEARLY, GUMROAD_URL_CREATOR_<TIER>_YEARLY)
// beside the monthly one; unset means the yearly button is not offered. A yearly sale grants the same
// tier — the webhook already reads Gumroad's `recurrence` for the term (lib/gumroad nextChargeDue), and
// a yearly-only product (GUMROAD_PRODUCT_<TIER>_YEARLY) is mapped to its tier with a yearly term even
// when the ping leaves `recurrence` out (lib/billingCatalog withYearlyRecurrence).
//
// Pure: no database import.

export type BillingInterval = 'monthly' | 'yearly';

/** A year is charged as this many months (Supporter's rule: two months free). */
export const YEARLY_MONTHS_CHARGED = 10;

/** `?billing=yearly` → 'yearly'; anything else is monthly. */
export function parseBillingInterval(v: string | string[] | null | undefined): BillingInterval {
  const s = Array.isArray(v) ? v[0] : v;
  return s === 'yearly' ? 'yearly' : 'monthly';
}

/** The yearly price for a monthly floor, to the cent. Null/0 in, the same out. */
export function yearlyPriceUsd(monthlyUsd: number | null): number | null {
  if (monthlyUsd == null || monthlyUsd === 0) return monthlyUsd;
  return Math.round(monthlyUsd * YEARLY_MONTHS_CHARGED * 100) / 100;
}

/** What a yearly price comes to per month, rounded down to the cent (never overstate the saving). */
export function yearlyPerMonthUsd(monthlyUsd: number): number {
  const year = yearlyPriceUsd(monthlyUsd) ?? 0;
  return Math.floor((year / 12) * 100) / 100;
}

export const usd = (n: number) => `$${n.toFixed(2)}`;

/**
 * The price line for a paid tier at an interval: "$2.99/mo", or "$29.90/yr · $2.49/mo".
 * Free (0) and negotiated (null) are the caller's own words.
 */
export function priceLine(monthlyUsd: number, interval: BillingInterval): string {
  if (interval === 'monthly') return `${usd(monthlyUsd)}/mo`;
  return `${usd(yearlyPriceUsd(monthlyUsd) ?? 0)}/yr · ${usd(yearlyPerMonthUsd(monthlyUsd))}/mo`;
}

/**
 * Which Gumroad product a checkout opens. Each tier has two: the ORIGINAL, which starts with Gumroad's
 * own free trial when the owner has one switched on there (TRIAL_DAYS > 0), and a PAY-NOW copy with no
 * trial, charged at once ("Skip trial, pay now", and "Subscribe" for anyone who has had a trial).
 * The pay-now envs are the original's name with `_NOW` on the end: GUMROAD_URL_SILVER_NOW,
 * GUMROAD_PRODUCT_SILVER_NOW, GUMROAD_URL_SILVER_YEARLY_NOW, … Unset = that button is not shown.
 */
export type CheckoutMode = 'trial' | 'now';

/** The pay-now env beside an original one (`X` → `X_NOW`). */
export function nowEnv(env: string | undefined): string | undefined {
  return env ? `${env}_NOW` : undefined;
}

/** The checkout env a tier uses at an interval, for the original product or its pay-now copy. */
export function urlEnvFor(
  tier: { gumroadUrlEnv?: string; gumroadUrlYearlyEnv?: string },
  interval: BillingInterval,
  mode: CheckoutMode = 'trial',
): string | undefined {
  const env = interval === 'yearly' ? tier.gumroadUrlYearlyEnv : tier.gumroadUrlEnv;
  return mode === 'now' ? nowEnv(env) : env;
}

/** Does this product id belong to the tier: its original or pay-now product, monthly or yearly? */
export function tierHasProduct(
  tier: { gumroadProductEnv?: string; gumroadProductYearlyEnv?: string },
  productId: string,
): boolean {
  return [tier.gumroadProductEnv, tier.gumroadProductYearlyEnv, nowEnv(tier.gumroadProductEnv), nowEnv(tier.gumroadProductYearlyEnv)].some(
    (env) => !!env && process.env[env] === productId,
  );
}

/** Is this the id of the tier's yearly-only product (original or pay-now)? */
export function tierHasYearlyProduct(tier: { gumroadProductYearlyEnv?: string }, productId: string): boolean {
  return [tier.gumroadProductYearlyEnv, nowEnv(tier.gumroadProductYearlyEnv)].some((env) => !!env && process.env[env] === productId);
}

/** Is this the id of the tier's pay-now product (no Gumroad trial), monthly or yearly? */
export function tierHasNowProduct(tier: { gumroadProductEnv?: string; gumroadProductYearlyEnv?: string }, productId: string): boolean {
  return [nowEnv(tier.gumroadProductEnv), nowEnv(tier.gumroadProductYearlyEnv)].some((env) => !!env && process.env[env] === productId);
}

/** Appends `ref` (the webhook's correlation key) to a checkout URL. */
export function withRef(base: string | null, ref: string | null | undefined): string | null {
  if (!base || !ref) return base;
  return `${base}${base.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref)}`;
}

/** Adds/removes `billing=yearly` on a site path (monthly is the default, so it is left off). */
export function withBilling(href: string, interval: BillingInterval): string {
  const [pathAndQuery, hash] = href.split('#', 2);
  const [path, query = ''] = pathAndQuery.split('?', 2);
  const params = new URLSearchParams(query);
  if (interval === 'yearly') params.set('billing', 'yearly');
  else params.delete('billing');
  const q = params.toString();
  return `${path}${q ? `?${q}` : ''}${hash != null ? `#${hash}` : ''}`;
}

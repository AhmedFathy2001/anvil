// The action under each column of /pricing's "For streamers & creators" table.
//
// The table used to be read-only: the only way to buy a creator tier was "Upgrade to …" on a space's
// admin dashboard (app/admin/dashboard/CreatorPlanCard). This picks, per column and per viewer, the
// same next step the rest of the site offers:
//
//   signed out           → sign in, then /host to make a space (a paid column carries ?plan= so the
//                          new space lands on its plan card, where its checkout is)
//   signed in, no space  → /host (?plan= for a paid column)
//   owns a space         → its own plan: "Your plan" (inert); lower tiers: "Included" (inert);
//                          a higher buyable tier: the dashboard card's exact Gumroad checkout + ref
//                          when on Free, /portal when already paying (Gumroad changes a plan there);
//                          no checkout configured → the space's plan card
//   Partner              → "Talk to us" on the Anvil Discord (set by hand, never bought)
//
// Yearly (?billing=yearly, lib/billingInterval): the same steps carry billing=yearly, and an owner's
// upgrade uses the tier's yearly checkout. A tier with no yearly checkout configured says "Yearly coming
// soon" (inert) wherever it would have asked for money; "Start free" stays, because the space is free.
//
// While freemium is not enforced (early access) a column that would START a space says "Start free",
// like the clan cards: nobody is asked for a card to begin. An existing space's upgrade still offers
// the checkout, exactly as its dashboard does.
//
// Pure: no database import (tests/pure-module-imports).

import { withBilling, type BillingInterval } from '@/lib/billingInterval';
import { CREATOR_PLANS, creatorPlanRank, type CreatorPlan, type CreatorPlanId } from '@/lib/creatorCatalog';

export type CreatorCta =
  | { kind: 'link'; label: string; href: string; primary: boolean }
  | { kind: 'external'; label: string; href: string; primary: boolean }
  | { kind: 'inert'; label: string };

export interface CreatorCtaViewer {
  signedIn: boolean;
  /** The creator space this person owns, if any (lib/clanCreate ownedCreatorSpace; one each). */
  space: { slug: string; plan: CreatorPlanId } | null;
}

export interface CreatorCtaOpts {
  enforced: boolean;
  /** Monthly or yearly (the /pricing switch). Default monthly. */
  interval?: BillingInterval;
  /** The checkout URL for `plan` AT `interval`, carrying the space's ref, or null if none is configured. */
  checkoutFor: (plan: CreatorPlan) => string | null;
  /** Is a yearly checkout configured for this tier? Only asked when `interval` is yearly. */
  yearlyOffered?: (plan: CreatorPlan) => boolean;
  /** Where "Talk to us" goes. */
  contactUrl: string;
}

/** Where making a creator space starts, for a column: /host, with ?plan= (and billing) for a buyable tier. */
export function hostHref(plan: CreatorPlan, interval: BillingInterval = 'monthly'): string {
  return plan.buyable ? withBilling(`/host?plan=${plan.id}`, interval) : '/host';
}

/** The tier a ?plan= on /host names, if it is one a new space can go on to buy. */
export function hostPlanParam(v: string | string[] | null | undefined): CreatorPlanId | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return null;
  const p = (CREATOR_PLANS as Record<string, CreatorPlan | undefined>)[s];
  return p && p.buyable ? p.id : null;
}

export function creatorPricingCta(plan: CreatorPlan, viewer: CreatorCtaViewer, opts: CreatorCtaOpts): CreatorCta {
  const space = viewer.signedIn ? viewer.space : null;
  const interval = opts.interval ?? 'monthly';
  // Yearly asked for, but this paid tier has no yearly checkout yet.
  const noYearly = interval === 'yearly' && plan.buyable && !(opts.yearlyOffered?.(plan) ?? false);
  const soon: CreatorCta = { kind: 'inert', label: 'Yearly coming soon' };

  if (space) {
    const current = CREATOR_PLANS[space.plan] ?? CREATOR_PLANS.creator_free;
    if (plan.id === current.id) return { kind: 'inert', label: 'Your plan' };
    if (creatorPlanRank(plan) < creatorPlanRank(current)) return { kind: 'inert', label: 'Included' };
  }

  if (!plan.buyable && plan.priceUsd == null) {
    return { kind: 'external', label: 'Talk to us', href: opts.contactUrl, primary: false };
  }

  if (space) {
    const label = `Upgrade to ${plan.name}`;
    if (space.plan !== 'creator_free') return { kind: 'link', label, href: '/portal', primary: true };
    if (noYearly) return soon;
    const checkout = opts.checkoutFor(plan);
    if (checkout) return { kind: 'external', label, href: checkout, primary: true };
    return { kind: 'link', label, href: withBilling(`/c/${space.slug}/admin/dashboard`, interval) + '#plan', primary: true };
  }

  const paidStart = plan.priceUsd !== 0 && opts.enforced;
  if (noYearly && paidStart) return soon;
  const host = hostHref(plan, noYearly ? 'monthly' : interval);
  const href = viewer.signedIn ? host : `/login?return=${encodeURIComponent(host)}`;
  const label = paidStart ? `Start with ${plan.name}` : 'Start free';
  return { kind: 'link', label, href, primary: plan.priceUsd === 0 };
}

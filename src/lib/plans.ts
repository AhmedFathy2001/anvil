// What a clan is entitled to.
//
// FREEMIUM CHANGES WHAT A PLAN IS. Under the hosted-container model a plan decided whether a clan
// EXISTED: no payment, no container, no site. Here every clan exists from the moment it is created,
// on `free`, and a paid tier raises limits. So this file answers "how much may this clan do", never
// "may this clan be here at all" — that is `clans.status`, and only abuse or a refund touches it.
//
// The stored value IS the customer-facing name. The control plane kept internal ids
// (starter/standard/pro) separate from the brand (Bronze/Silver/Gold) so provisioning code would not
// churn when marketing changed; there is no provisioning code left to protect, and two vocabularies
// for one concept is a translation layer that only ever produces bugs.

export const TRIAL_DAYS = Number(process.env.GUMROAD_TRIAL_DAYS || 30);

export const PLAN_IDS = ['free', 'bronze', 'silver', 'gold', 'custom'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly "pay from" floor in USD. Null = negotiated, or free. Gumroad holds the real charge. */
  priceUsd: number | null;
  priceSuggested?: number;
  /** Max active roster members. Null = no cap. */
  memberCap: number | null;
  capLabel: string;
  blurb: string;
  features: string[];
  popular?: boolean;
  /** Env holding this tier's Gumroad product id, matched against the webhook's `product_id`. */
  gumroadProductEnv?: string;
  /** Env holding this tier's hosted checkout URL. */
  gumroadUrlEnv?: string;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceUsd: 0,
    memberCap: 50,
    capLabel: 'Up to 50 members',
    blurb: 'Everything you need to run your first bingo.',
    features: [
      'Bingo events and boards',
      'Weekly SOTW / BOTW',
      'RuneLite auto drop-tracking',
      'Discord login',
    ],
  },
  bronze: {
    id: 'bronze',
    name: 'Bronze',
    priceUsd: 2.99,
    priceSuggested: 4.99,
    memberCap: 150,
    capLabel: 'Up to 150 members',
    blurb: 'For smaller clans getting their first bingo off the ground.',
    features: [
      'Everything in Free',
      'Discord notifications',
      'More media storage',
      'Community support',
    ],
    gumroadProductEnv: 'GUMROAD_PRODUCT_BRONZE',
    gumroadUrlEnv: 'GUMROAD_URL_BRONZE',
  },
  silver: {
    id: 'silver',
    name: 'Silver',
    priceUsd: 6.99,
    priceSuggested: 9.99,
    memberCap: 300,
    capLabel: 'Up to 300 members',
    blurb: 'For active clans running regular events with bigger rosters.',
    features: [
      'Everything in Bronze',
      'Run multiple events at once',
      'Priority updates',
      'More media storage',
    ],
    popular: true,
    gumroadProductEnv: 'GUMROAD_PRODUCT_SILVER',
    gumroadUrlEnv: 'GUMROAD_URL_SILVER',
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    priceUsd: 14.99,
    priceSuggested: 19.99,
    memberCap: 600,
    capLabel: 'Up to 600 members',
    blurb: 'For large clans running everything at once.',
    features: [
      'Everything in Silver',
      'Largest rosters',
      'Priority support',
      'Custom domain',
    ],
    gumroadProductEnv: 'GUMROAD_PRODUCT_GOLD',
    gumroadUrlEnv: 'GUMROAD_URL_GOLD',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    priceUsd: null,
    memberCap: null,
    capLabel: 'No cap',
    blurb: 'Negotiated. Set by an operator, never bought.',
    features: [],
  },
};

// ── Capabilities — the "premium features" half of the blend ────────────────────────────────────────
//
// The freemium lever is seats (memberCap, above) PLUS a small set of named capabilities. Free gets the
// whole core product (bingo, weekly, drop tracking, Discord login, and JOINING a co-hosted event) — a
// capability here is a genuine premium power, not table stakes. Co-hosting is "free to join, paid to
// host": `host-multi-clan` is the gate on being the HOST of a co-hosted event; a co-host joins for free.
export const CAPABILITIES = ['discord-notifications', 'concurrent-events', 'host-multi-clan', 'custom-domain'] as const;
export type Capability = (typeof CAPABILITIES)[number];

/** The lowest tier that unlocks each capability. Free unlocks none of these (it has the core product). */
export const CAPABILITY_MIN_PLAN: Record<Capability, PlanId> = {
  'discord-notifications': 'bronze',
  'concurrent-events': 'silver',
  'host-multi-clan': 'silver',
  'custom-domain': 'gold',
};

const PLAN_RANK: Record<PlanId, number> = { free: 0, bronze: 1, silver: 2, gold: 3, custom: 4 };

/** Does this plan's tier reach the one a capability needs? (Custom sits above Gold and has everything.) */
export function planHasCapability(plan: Plan, capability: Capability): boolean {
  return PLAN_RANK[plan.id] >= PLAN_RANK[CAPABILITY_MIN_PLAN[capability]];
}

export function isPlanId(v: string | null | undefined): v is PlanId {
  return v != null && (PLAN_IDS as readonly string[]).includes(v);
}

export function planOf(clanPlan: string | null | undefined): Plan {
  return isPlanId(clanPlan) ? PLANS[clanPlan] : PLANS.free;
}

/**
 * The tier Gumroad says was bought, by membership tier NAME ("Silver").
 *
 * One product with several tiers is how the storefront is set up, so this is the primary signal and
 * the product id is the fallback.
 */
export function planForGumroadTier(tier: string | null | undefined): Plan | null {
  if (!tier) return null;
  const want = tier.trim().toLowerCase();
  return Object.values(PLANS).find((p) => p.name.toLowerCase() === want) ?? null;
}

/** The tier matching a Gumroad product id, for the per-tier-product setup. */
export function planForGumroadProduct(productId: string | null | undefined): Plan | null {
  if (!productId) return null;
  return (
    Object.values(PLANS).find(
      (p) => p.gumroadProductEnv && process.env[p.gumroadProductEnv] === productId,
    ) ?? null
  );
}

/** Hosted checkout URL for a tier, if one is configured. */
export function checkoutUrl(plan: Plan): string | null {
  return plan.gumroadUrlEnv ? (process.env[plan.gumroadUrlEnv] ?? null) : null;
}

/**
 * Checkout URL carrying the clan's `ref` token — the strong correlation the webhook keys on. Gumroad
 * forwards a product URL's params to the ping as `url_params`, so this is how a payment finds its clan
 * even when the buyer pays with a different email than the clan's contact.
 */
export function checkoutUrlWithRef(plan: Plan, ref: string | null | undefined): string | null {
  const base = checkoutUrl(plan);
  if (!base || !ref) return base;
  return `${base}${base.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref)}`;
}

/**
 * Is this clan over what its plan allows?
 *
 * Returned rather than enforced here on purpose: what to DO about an over-cap clan is a product
 * decision (warn, block new joins, ignore) and it differs per surface. Deleting members to fit a
 * downgrade is never the answer.
 */
export function overMemberCap(plan: Plan, activeMembers: number): boolean {
  return plan.memberCap != null && activeMembers > plan.memberCap;
}

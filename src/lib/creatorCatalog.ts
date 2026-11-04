// The creator-space plan catalogue: its own tiers, prices, perks and Gumroad products.
//
// A creator space (lib/creatorSpaces) is a `clans` row, but it is NOT sold the clan ladder. It has
// different rules (players per event, not a roster) and its pricing is free to move on its own, so it
// has its own catalogue here, its own Gumroad products (GUMROAD_PRODUCT_CREATOR_* / GUMROAD_URL_CREATOR_*)
// and its own stored ids. The ids are prefixed (`creator_…`) so a value in `clans.plan` says which
// catalogue it belongs to on its own, and the database refuses a creator row holding a clan tier or the
// other way round (migration 0203's `clans_plan_matches_kind`). Clan code reads lib/plans; creator code
// reads this; lib/billingCatalog is the one place that picks between them by `kind`.
//
// Today the numbers are the clan ladder's, so nothing a creator sees changes; they are kept separate so
// they can change without touching a clan.
//
// Pure: no database import (tests/pure-module-imports).

import { freemiumEnforced } from '@/lib/entitlements';

export const CREATOR_PLAN_IDS = ['creator_free', 'creator_bronze', 'creator_silver', 'creator_gold', 'creator_partner'] as const;
export type CreatorPlanId = (typeof CREATOR_PLAN_IDS)[number];

/** What `clans.plan` holds for a creator space on the free tier (and what a lapse drops it back to). */
export const CREATOR_FREE_ID: CreatorPlanId = 'creator_free';

export interface CreatorPlan {
  id: CreatorPlanId;
  /** "Free", "Bronze", "Silver", "Gold", "Partner". */
  name: string;
  /** Monthly "pay from" floor in USD. Null = negotiated (Partner). Gumroad holds the real charge. */
  priceUsd: number | null;
  priceSuggested?: number;
  /** THE creator meter: players on one event. Null = no cap. */
  playersPerEvent: number | null;
  /**
   * Written to `clans.member_cap` beside the plan, as for a clan. Not a creator meter — a creator space
   * has no roster to cap — but the column is shared, so it keeps the value it has always had.
   */
  memberCap: number | null;
  blurb: string;
  /** What this tier adds over the one below, in plain words, for the plan card and portal. */
  perks: string[];
  /** On sale through Gumroad. Free is where everyone starts; Partner is set by hand. */
  buyable: boolean;
  /** Env holding this tier's Gumroad product id, matched against the webhook's `product_id`. */
  gumroadProductEnv?: string;
  /** Env holding this tier's hosted checkout URL. */
  gumroadUrlEnv?: string;
}

export const CREATOR_PLANS: Record<CreatorPlanId, CreatorPlan> = {
  creator_free: {
    id: 'creator_free',
    name: 'Free',
    priceUsd: 0,
    playersPerEvent: 50,
    memberCap: 50,
    blurb: 'Host events for your viewers.',
    perks: [],
    buyable: false,
  },
  creator_bronze: {
    id: 'creator_bronze',
    name: 'Bronze',
    priceUsd: 2.99,
    priceSuggested: 4.99,
    playersPerEvent: 150,
    memberCap: 150,
    blurb: 'Bigger events, and only your followers or subs get in.',
    perks: ['Only your Twitch, Kick or YouTube followers or subs can join'],
    buyable: true,
    gumroadProductEnv: 'GUMROAD_PRODUCT_CREATOR_BRONZE',
    gumroadUrlEnv: 'GUMROAD_URL_CREATOR_BRONZE',
  },
  creator_silver: {
    id: 'creator_silver',
    name: 'Silver',
    priceUsd: 6.99,
    priceSuggested: 9.99,
    playersPerEvent: 300,
    memberCap: 300,
    blurb: 'Several events at once, !join in chat, featured on Anvil.',
    perks: ['Run more than one event at a time', '!join in your Twitch or Kick chat', 'Featured first on anvilosrs.com/events'],
    buyable: true,
    gumroadProductEnv: 'GUMROAD_PRODUCT_CREATOR_SILVER',
    gumroadUrlEnv: 'GUMROAD_URL_CREATOR_SILVER',
  },
  creator_gold: {
    id: 'creator_gold',
    name: 'Gold',
    priceUsd: 14.99,
    priceSuggested: 19.99,
    playersPerEvent: 1000,
    memberCap: 600,
    blurb: 'The biggest events, your overlay without the Anvil mark.',
    perks: ['Hide the Anvil mark on your OBS overlay'],
    buyable: true,
    gumroadProductEnv: 'GUMROAD_PRODUCT_CREATOR_GOLD',
    gumroadUrlEnv: 'GUMROAD_URL_CREATOR_GOLD',
  },
  creator_partner: {
    id: 'creator_partner',
    name: 'Partner',
    priceUsd: null,
    playersPerEvent: null,
    memberCap: null,
    blurb: 'A deal with a creator. Set by an operator, never bought.',
    perks: [],
    buyable: false,
  },
};

const CREATOR_RANK: Record<CreatorPlanId, number> = {
  creator_free: 0,
  creator_bronze: 1,
  creator_silver: 2,
  creator_gold: 3,
  creator_partner: 4,
};

/** The tiers a creator can buy, in order. */
export const CREATOR_BUYABLE: readonly CreatorPlan[] = CREATOR_PLAN_IDS.map((id) => CREATOR_PLANS[id]).filter((p) => p.buyable);

export function isCreatorPlanId(v: string | null | undefined): v is CreatorPlanId {
  return v != null && (CREATOR_PLAN_IDS as readonly string[]).includes(v);
}

/**
 * A creator space's plan from its stored value. Strict: only creator ids are read — a clan tier
 * ('silver') reads as creator Free, never as the creator tier of the same name. The database keeps
 * clan ids off creator rows; this is the second fence.
 */
export function creatorPlanOf(stored: string | null | undefined): CreatorPlan {
  return isCreatorPlanId(stored) ? CREATOR_PLANS[stored] : CREATOR_PLANS.creator_free;
}

export function creatorPlanRank(plan: CreatorPlan): number {
  return CREATOR_RANK[plan.id];
}

/**
 * The creator tier a value from BEFORE the split means. Creator spaces sat on the clan ladder until
 * migration 0203 moved them; this is that mapping (the migration's SQL says the same thing), also used
 * for an old `billing_ended` audit entry that recorded the clan id a creator space was on.
 */
export const CREATOR_PLAN_FROM_CLAN_PLAN: Record<string, CreatorPlanId> = {
  free: 'creator_free',
  bronze: 'creator_bronze',
  silver: 'creator_silver',
  gold: 'creator_gold',
  custom: 'creator_partner',
};

/** creatorPlanOf, also reading a pre-split clan id the way migration 0203 maps it. Unknown → Free. */
export function creatorPlanFromLegacy(stored: string | null | undefined): CreatorPlan {
  if (isCreatorPlanId(stored)) return CREATOR_PLANS[stored];
  const mapped = stored != null ? CREATOR_PLAN_FROM_CLAN_PLAN[stored] : undefined;
  return CREATOR_PLANS[mapped ?? 'creator_free'];
}

// ── Capabilities ─────────────────────────────────────────────────────────────────────────────────

export const CREATOR_CAPABILITIES = [
  /** More than one live event at once. */
  'concurrent-events',
  /** Being the HOST of a co-hosted event (joining one is free). */
  'host-multi-clan',
  /** Entry gates on a stream platform (Twitch, Kick, YouTube…). Discord gates are free. */
  'stream-gates',
  /** The `!join` reply in the creator's Twitch / Kick chat. */
  'chat-join-bot',
  /** Hide the small Anvil mark on the OBS overlay. */
  'overlay-unbranded',
  /** Listed first in the clans directory (a creator space that chose to be listed). */
  'featured-listing',
] as const;
export type CreatorCapability = (typeof CREATOR_CAPABILITIES)[number];

/** The lowest creator tier that unlocks each capability. */
export const CREATOR_CAPABILITY_MIN_PLAN: Record<CreatorCapability, CreatorPlanId> = {
  'concurrent-events': 'creator_silver',
  'host-multi-clan': 'creator_silver',
  'stream-gates': 'creator_bronze',
  'chat-join-bot': 'creator_silver',
  'overlay-unbranded': 'creator_gold',
  'featured-listing': 'creator_silver',
};

/** Does this tier reach the one a capability needs? (Partner sits above Gold and has everything.) */
export function creatorPlanHasCapability(plan: CreatorPlan, capability: CreatorCapability): boolean {
  return CREATOR_RANK[plan.id] >= CREATOR_RANK[CREATOR_CAPABILITY_MIN_PLAN[capability]];
}

/**
 * May a creator space on this stored plan use this capability? The creator twin of lib/entitlements
 * clanCan: always yes while FREEMIUM_ENFORCED is off, gated by tier once it is on.
 */
export function creatorCan(stored: string | null | undefined, capability: CreatorCapability): boolean {
  if (!freemiumEnforced()) return true;
  return creatorPlanHasCapability(creatorPlanOf(stored), capability);
}

/** The tier name a capability needs, for upsell copy ("a Silver feature"). */
export function creatorMinPlanNameFor(capability: CreatorCapability): string {
  return CREATOR_PLANS[CREATOR_CAPABILITY_MIN_PLAN[capability]].name;
}

// ── Gumroad ──────────────────────────────────────────────────────────────────────────────────────

/** The creator tier matching a Gumroad product id (GUMROAD_PRODUCT_CREATOR_*), or null. */
export function creatorPlanForGumroadProduct(productId: string | null | undefined): CreatorPlan | null {
  if (!productId) return null;
  return CREATOR_BUYABLE.find((p) => p.gumroadProductEnv && process.env[p.gumroadProductEnv] === productId) ?? null;
}

/**
 * The creator tier a Gumroad tier name means. "Anvil Creator Silver" and "Creator Silver" always do;
 * a bare "Silver" only when the caller already knows the sale is for the creator catalogue (its
 * product id said so) — on its own, "Silver" is the clan tier.
 */
export function creatorPlanForGumroadTier(tier: string | null | undefined, opts: { bare?: boolean } = {}): CreatorPlan | null {
  if (!tier) return null;
  const name = tier.trim().toLowerCase().replace(/^anvil\s+/, '');
  const prefixed = /^creators?\s+/.test(name);
  if (!prefixed && !opts.bare) return null;
  const want = name.replace(/^creators?\s+/, '');
  return CREATOR_BUYABLE.find((p) => p.name.toLowerCase() === want) ?? null;
}

/** Hosted checkout URL for a creator tier, if one is configured. Null hides that tier's button. */
export function creatorCheckoutUrl(plan: CreatorPlan): string | null {
  return plan.gumroadUrlEnv ? (process.env[plan.gumroadUrlEnv] || null) : null;
}

/** The checkout URL carrying the space's `ref` (clans.gumroad_ref) — the webhook's correlation key. */
export function creatorCheckoutUrlWithRef(plan: CreatorPlan, ref: string | null | undefined): string | null {
  const base = creatorCheckoutUrl(plan);
  if (!base || !ref) return base;
  return `${base}${base.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref)}`;
}

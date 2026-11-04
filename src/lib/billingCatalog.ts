// Which plan catalogue a row is billed from — the one place clan and creator billing meet.
//
// Two catalogues share `clans.plan` and one Gumroad webhook: the clan ladder (lib/plans) and the
// creator one (lib/creatorCatalog). A row's `kind` picks its catalogue, and a stored plan id says
// which catalogue it came from on its own (creator ids are `creator_…`). The webhook, the lapse sweep,
// staff's plan editor and the billing portal ask this module instead of either catalogue directly, so
// none of them can hand a creator space a clan tier or the other way round.
//
// Pure: no database import.

import { PLANS, PLAN_IDS, isPlanId, planForGumroadProduct, planForGumroadTier, planOf, type Plan } from '@/lib/plans';
import {
  CREATOR_FREE_ID,
  CREATOR_PLANS,
  CREATOR_PLAN_IDS,
  creatorPlanForGumroadProduct,
  creatorPlanForGumroadTier,
  creatorPlanFromLegacy,
  creatorPlanOf,
  isCreatorPlanId,
  type CreatorPlan,
} from '@/lib/creatorCatalog';

export type Catalog = 'clan' | 'creator';

/** The catalogue a `clans.kind` is billed from. Anything but 'creator' is a clan (lib/creatorSpaces). */
export function catalogOfKind(kind: string | null | undefined): Catalog {
  return kind === 'creator' ? 'creator' : 'clan';
}

/** The catalogue a stored plan id belongs to, or null for a value neither knows. */
export function catalogOfPlanId(id: string | null | undefined): Catalog | null {
  if (isCreatorPlanId(id)) return 'creator';
  if (isPlanId(id)) return 'clan';
  return null;
}

/** The ids a row of this kind may hold — staff's plan picker and its route. */
export function planIdsFor(kind: string | null | undefined): readonly string[] {
  return catalogOfKind(kind) === 'creator' ? CREATOR_PLAN_IDS : PLAN_IDS;
}

/** Is this stored id a free tier, in either catalogue? (lib/clanBilling inlines the same two ids.) */
export function isFreePlanId(id: string | null | undefined): boolean {
  return id === 'free' || id === CREATOR_FREE_ID;
}

/** One tier, whichever catalogue it is from: the fields billing writes and shows. */
export interface BillingTier {
  catalog: Catalog;
  id: string;
  name: string;
  priceUsd: number | null;
  /** Written to `clans.member_cap` with the plan. */
  memberCap: number | null;
  free: boolean;
}

function fromClan(p: Plan): BillingTier {
  return { catalog: 'clan', id: p.id, name: p.name, priceUsd: p.priceUsd, memberCap: p.memberCap, free: p.id === 'free' };
}

function fromCreator(p: CreatorPlan): BillingTier {
  return { catalog: 'creator', id: p.id, name: p.name, priceUsd: p.priceUsd, memberCap: p.memberCap, free: p.id === CREATOR_FREE_ID };
}

/** A row's tier, read from its own catalogue. A value from the other one reads as that catalogue's Free. */
export function billingTierOf(kind: string | null | undefined, stored: string | null | undefined): BillingTier {
  return catalogOfKind(kind) === 'creator' ? fromCreator(creatorPlanOf(stored)) : fromClan(planOf(stored));
}

/** Where a lapse, refund or dispute drops a row of this kind. */
export function freeTierFor(kind: string | null | undefined): BillingTier {
  return catalogOfKind(kind) === 'creator' ? fromCreator(CREATOR_PLANS.creator_free) : fromClan(PLANS.free);
}

/** The first paid tier — what a sale that names no tier at all is taken as, on a free row. */
export function entryTierFor(kind: string | null | undefined): BillingTier {
  return catalogOfKind(kind) === 'creator' ? fromCreator(CREATOR_PLANS.creator_bronze) : fromClan(PLANS.bronze);
}

/**
 * The paid tier a `billing_ended` audit entry recorded (`from`), read for a row of this kind, or null
 * when it was free or from the other catalogue. A creator space ended before the split recorded a
 * clan id ('silver'); that reads the way migration 0203 maps it.
 */
export function endedTierFor(kind: string | null | undefined, from: string | null | undefined): BillingTier | null {
  if (catalogOfKind(kind) === 'creator') {
    const p = creatorPlanFromLegacy(from);
    return p.id === CREATOR_FREE_ID ? null : fromCreator(p);
  }
  if (!isPlanId(from) || from === 'free') return null;
  return fromClan(PLANS[from]);
}

/**
 * What a Gumroad notification says was bought: the catalogue, and the tier when it can tell.
 *
 *   1. A creator product id (GUMROAD_PRODUCT_CREATOR_*) → creator; the tier name refines it when one
 *      product carries several tiers.
 *   2. A clan product id (GUMROAD_PRODUCT_*) → clan, tier name first, as clans always were.
 *   3. No known product: a tier named "Creator Silver" → creator; "Silver" → clan (the clan storefront
 *      is one product with tiers, and its id need not be configured).
 *   4. Nothing recognisable → null: the caller decides (a clan keeps its old fallback; a creator space
 *      takes nothing it cannot prove was a creator product).
 */
export function gumroadPurchase(ev: { productId: string | null; tier: string | null }): { catalog: Catalog; tier: BillingTier } | null {
  const creatorProduct = creatorPlanForGumroadProduct(ev.productId);
  if (creatorProduct) {
    return { catalog: 'creator', tier: fromCreator(creatorPlanForGumroadTier(ev.tier, { bare: true }) ?? creatorProduct) };
  }
  const clanProduct = planForGumroadProduct(ev.productId);
  if (clanProduct) return { catalog: 'clan', tier: fromClan(planForGumroadTier(ev.tier) ?? clanProduct) };
  const creatorTier = creatorPlanForGumroadTier(ev.tier);
  if (creatorTier) return { catalog: 'creator', tier: fromCreator(creatorTier) };
  const clanTier = planForGumroadTier(ev.tier);
  if (clanTier) return { catalog: 'clan', tier: fromClan(clanTier) };
  return null;
}

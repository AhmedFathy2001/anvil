import { isFreePlanId } from '@/lib/billingCatalog';

/**
 * The Gumroad membership a clan is still being charged for, or null.
 *
 * Deleting a clan removes its row; it does not tell Gumroad anything (we have no call that cancels a
 * buyer's membership). A plan that still renews would then keep charging the owner, and each charge
 * would land in the staff unmatched-purchases inbox with no clan to give it to. A plan the owner has
 * already cancelled (cancelAtPeriodEnd) is only running out the term they paid for: nothing more will
 * be charged, so it doesn't stop a delete.
 */
export function renewingClanPlan(clan: { plan: string; gumroadSubscriptionId: string | null; cancelAtPeriodEnd: boolean }): string | null {
  if (!clan.gumroadSubscriptionId || isFreePlanId(clan.plan) || clan.cancelAtPeriodEnd) return null;
  return clan.gumroadSubscriptionId;
}

export const OWNER_RENEWING_MESSAGE =
  "This clan's plan still renews. Cancel it on Gumroad first (Plan → Manage on Gumroad), then delete the clan: deleting it here doesn't stop the payments.";

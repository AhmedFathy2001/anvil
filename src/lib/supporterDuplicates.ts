// Two paid Supporter memberships at once (tests/supporter-duplicates.test.ts). Pure.
//
// Changing Supporter tier by buying again is a NEW Gumroad membership; the old one keeps charging
// until the person cancels it on Gumroad (the site has no cancel call). Each membership is its own
// supporter_subscriptions row, so "which one to cancel" needs no record of its own: it is every
// membership still set to renew except the newest. It clears itself when Gumroad reports the older
// one cancelled ('cancelling') or ended.

import { SUPPORTER_TIERS, parseStamp, type SupporterTierId } from './supporterTiers.ts';

export interface PaidRow {
  id: number;
  tier: string;
  status: string;
  startedAt: string;
  gumroadSubscriptionId: string | null;
}

export interface MembershipToCancel {
  rowId: number;
  subscriptionId: string;
  tierName: string;
}

/** The older memberships still set to renew, oldest first. Empty unless two or more are renewing. */
export function membershipsToCancel(rows: PaidRow[]): MembershipToCancel[] {
  const renewing = rows
    .filter((r) => r.status === 'active' && !!r.gumroadSubscriptionId && r.tier in SUPPORTER_TIERS)
    .sort((a, b) => parseStamp(a.startedAt) - parseStamp(b.startedAt) || a.id - b.id);
  return renewing.slice(0, -1).map((r) => ({ rowId: r.id, subscriptionId: r.gumroadSubscriptionId as string, tierName: SUPPORTER_TIERS[r.tier as SupporterTierId].name }));
}

/** The one-line warning on an upgrade button, before they buy. */
export const SECOND_MEMBERSHIP_WARNING =
  'This is a new membership. Your current one keeps charging until you cancel it on Gumroad, so cancel it after you buy.';

/** The persistent notice once two are running. */
export const TWO_MEMBERSHIPS_NOTICE = 'You now have two memberships. Cancel the older one here so you are not charged twice';

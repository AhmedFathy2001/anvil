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

/** One extra clan / space membership (lib/extraMemberships, state 'to_cancel'), as its notice needs it. */
export interface ExtraMembershipFacts {
  /** The extra membership's tier, and the tier that stays the plan. */
  tierName: string;
  keptTierName: string;
  /** 'superseded' (the older one after an upgrade) or 'lower_tier' (a lower / equal tier bought while a higher one is live). */
  reason: string | null;
  /** Gumroad reported it cancelled: it will not charge again, and runs to `periodEndsAt` (ms) when that is known. */
  cancelledAt: number | null;
  periodEndsAt: number | null;
}

const dayMonthYear = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * The owner's notice for an extra membership. `lead` ends where the link to manage it on Gumroad
 * goes; `link` is that link's words; `askCancel` false = nothing to do (already cancelled), shown quietly.
 */
export function extraMembershipNotice(f: ExtraMembershipFacts): { lead: string; link: string; askCancel: boolean } {
  if (f.cancelledAt != null) {
    const until = f.periodEndsAt != null ? `, ends ${dayMonthYear(f.periodEndsAt)}` : '';
    return {
      lead: `Your other ${f.tierName} membership is cancelled${until}. It will not be charged again, so there is nothing more to do`,
      link: `see it on Gumroad`,
      askCancel: false,
    };
  }
  if (f.reason === 'lower_tier') {
    const lead =
      f.tierName === f.keptTierName
        ? `You bought ${f.tierName} twice. One ${f.tierName} membership stays. Cancel the second one here so you are not charged twice`
        : `You bought ${f.tierName} while you have ${f.keptTierName}. ${f.keptTierName} stays. Cancel the ${f.tierName} membership here so you are not charged twice`;
    return { lead, link: `manage the ${f.tierName} membership on Gumroad`, askCancel: true };
  }
  return { lead: TWO_MEMBERSHIPS_NOTICE, link: `manage the older ${f.tierName} membership on Gumroad`, askCancel: true };
}

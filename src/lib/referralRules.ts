// Referral rewards, pure (lib/referrals does the reads and writes).
//
// Somebody buys Supporter through your invite link: you earn Supporter time the site grants, never
// cash. It is held REFERRAL_HOLD_DAYS after the first real charge so a refund or chargeback can take
// it back before it lands. A monthly purchase earns a month, a yearly one three. If you already pay,
// the time comes one tier up (Supporter → Champion → Patron), so it is still worth something — but
// never above the tier the friend bought.

import { SUPPORTER_TIER_ORDER, type SupporterTierId } from '@/lib/supporterTiers';

export const REFERRAL_HOLD_DAYS = 14;
const DAY = 86_400_000;

export function rewardMonths(recurrence: string | null | undefined): number {
  return recurrence === 'yearly' ? 3 : 1;
}

/** The tier the reward is granted at, from the tier the referrer pays for (null: not paying). */
export function rewardTier(paid: SupporterTierId | null): SupporterTierId {
  if (!paid) return 'supporter';
  const i = SUPPORTER_TIER_ORDER.indexOf(paid);
  return SUPPORTER_TIER_ORDER[Math.min(i + 1, SUPPORTER_TIER_ORDER.length - 1)];
}

/** The reward tier, never above the tier the friend bought: a $1 sale can't mint a Patron month. */
export function cappedReward(paid: SupporterTierId | null, bought: SupporterTierId): SupporterTierId {
  const want = rewardTier(paid);
  const order = SUPPORTER_TIER_ORDER;
  const b = order.includes(bought) ? bought : 'supporter';
  return order.indexOf(want) <= order.indexOf(b) ? want : b;
}

/** When the reward may be granted: two weeks after the first real charge (a trial's end, or now). */
export function grantAfter(now: number, trialEndsAt: number | null): number {
  return Math.max(now, trialEndsAt ?? now) + REFERRAL_HOLD_DAYS * DAY;
}

/** `months` calendar months after `from`, in UTC. */
export function addMonths(from: number, months: number): number {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.getTime();
}

/**
 * Where a new grant sits: after any reward time already banked, so two referrals in one week are two
 * months, not the same month twice.
 */
export function grantWindow(now: number, bankedEnds: number[], months: number): { start: number; end: number } {
  const start = Math.max(now, ...bankedEnds.filter((t) => Number.isFinite(t)));
  return { start, end: addMonths(start, months) };
}

/** Invite codes: what /r/<code> accepts. */
export function isReferralCode(s: unknown): s is string {
  return typeof s === 'string' && /^[a-z0-9]{6,12}$/.test(s);
}

/**
 * Milestones on top of the per-friend reward: the count is friends whose purchase settled (granted
 * referrals). Each is granted once, as Supporter time like any other reward, stacked after what's banked.
 */
export const REFERRAL_MILESTONES: { at: number; tier: SupporterTierId; months: number; label: string }[] = [
  { at: 3, tier: 'champion', months: 1, label: 'a month of Champion' },
  { at: 10, tier: 'champion', months: 3, label: '3 months of Champion' },
  { at: 25, tier: 'patron', months: 12, label: 'a year of Patron' },
];

/** The milestone reached exactly at this count, if any. */
export function milestoneAt(count: number) {
  return REFERRAL_MILESTONES.find((m) => m.at === count) ?? null;
}

/** Progress towards the next milestone: { from, to, label } with `from` the last one passed (0 at first). */
export function nextMilestone(count: number): { from: number; to: number; label: string } | null {
  const i = REFERRAL_MILESTONES.findIndex((m) => m.at > count);
  if (i < 0) return null;
  return { from: i === 0 ? 0 : REFERRAL_MILESTONES[i - 1].at, to: REFERRAL_MILESTONES[i].at, label: REFERRAL_MILESTONES[i].label };
}

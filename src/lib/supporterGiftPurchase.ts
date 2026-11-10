// Paid Supporter gifts, the pure half: one person buys Supporter time for another, ONCE, with no
// renewal. The buyer picks who on anvilosrs.com (a gift intent, lib/supporterGiftCheckout); the time
// lands on the recipient's login as an ordinary granted row (recurrence 'gift-paid'), so flair and
// every other read treat it like any membership. It never climbs the recipient's tenure ladder
// (lib/supporterTiers isPaidRow skips granted rows): they didn't pay for it. It does climb the
// GIVER's ladder, below.
//
// Gumroad sells it as one product with one variant per tier and length: "Champion · 3 months".

import { SUPPORTER_TIERS, SUPPORTER_TIER_ORDER, type SupporterTierId } from './supporterTiers.ts';

export { PAID_GIFT_RECURRENCE } from './supporterTiers.ts';

/** The lengths on sale, in months. A year is the yearly price (two months free, as on a plan). */
export const GIFT_LENGTHS = [1, 3, 12] as const;
export type GiftLength = (typeof GIFT_LENGTHS)[number];

export function giftPriceUsd(tier: SupporterTierId, months: GiftLength): number {
  const t = SUPPORTER_TIERS[tier];
  return months === 12 ? t.yearlyUsd : t.monthlyUsd * months;
}

const lengthLabel = (m: GiftLength) => (m === 12 ? '1 year' : `${m} month${m === 1 ? '' : 's'}`);

/** The Gumroad variant name for a tier and length: "Champion · 3 months", "Patron · 1 year". */
export function giftOptionName(tier: SupporterTierId, months: GiftLength): string {
  return `${SUPPORTER_TIERS[tier].name} · ${lengthLabel(months)}`;
}

/** Every option, for the product's setup and the page's price list. */
export const GIFT_OPTIONS = SUPPORTER_TIER_ORDER.flatMap((tier) =>
  GIFT_LENGTHS.map((months) => ({ tier, months, name: giftOptionName(tier, months), usd: giftPriceUsd(tier, months) })),
);

/** Read a sale's variant back into a tier and length; anything else is null, never a guess. */
export function parseGiftOption(name: string | null | undefined): { tier: SupporterTierId; months: GiftLength } | null {
  const m = /^\s*(supporter|champion|patron)\s*[·\-–|]\s*(1|3|12)\s*(month|months|mo)\s*$|^\s*(supporter|champion|patron)\s*[·\-–|]\s*1\s*year\s*$/i.exec(name ?? '');
  if (!m) return null;
  const tier = (m[1] ?? m[4]).toLowerCase() as SupporterTierId;
  const months = (m[4] ? 12 : Number(m[2])) as GiftLength;
  return GIFT_LENGTHS.includes(months) ? { tier, months } : null;
}

/**
 * The giver ladder: months of Supporter bought for other people. Counted in months, never money,
 * so a Patron month and a Supporter month weigh the same and nobody's spend is on show.
 */
export const GIVER_RANKS = [
  { id: 'giver', name: 'Giver', months: 1 },
  { id: 'benefactor', name: 'Benefactor', months: 5 },
  { id: 'pillar', name: 'Pillar of the clan', months: 15 },
] as const;
export type GiverRank = (typeof GIVER_RANKS)[number];

export function giverRank(months: number): { rank: GiverRank | null; next: GiverRank | null } {
  const rank = [...GIVER_RANKS].reverse().find((r) => months >= r.months) ?? null;
  const next = GIVER_RANKS.find((r) => months < r.months) ?? null;
  return { rank, next };
}

/** The rows that matter for a gift: the recipient's own memberships and time already granted to them. */
export interface GiftTargetRow {
  tier: string;
  status: string;
  recurrence?: string | null;
  currentPeriodEnd: string | null;
}

const rankOf = (t: string) => (t in SUPPORTER_TIERS ? SUPPORTER_TIERS[t as SupporterTierId].rank : 0);
const endOf = (r: GiftTargetRow) => (r.currentPeriodEnd ? Date.parse(r.currentPeriodEnd) : NaN);

/**
 * Why this gift can't be bought for them right now, or null. A tier they already PAY for (or a lower
 * one) would do nothing while their subscription runs, and Gumroad can't move their billing date, so
 * it waits until theirs ends. A gift above what they pay upgrades them for its length.
 */
export function giftBlocked(rows: GiftTargetRow[], tier: SupporterTierId, now = Date.now()): string | null {
  let paying: SupporterTierId | null = null;
  for (const r of rows) {
    if (!(r.tier in SUPPORTER_TIERS)) continue;
    const live = r.status === 'active' || (r.status === 'cancelling' && !(endOf(r) <= now));
    if (!live) continue;
    if (!paying || rankOf(r.tier) > rankOf(paying)) paying = r.tier as SupporterTierId;
  }
  if (!paying || rankOf(tier) > rankOf(paying)) return null;
  return `They already pay for ${SUPPORTER_TIERS[paying].name}. Gift a higher tier to upgrade them, or this one once their subscription ends.`;
}

/**
 * When a new gift starts: now, or, on top of time already granted to them at this tier or above (a
 * gift, invite time), the moment that runs out. Two Patron months are back to back, not side by side.
 */
export function giftStartsAt(rows: GiftTargetRow[], tier: SupporterTierId, now = Date.now()): number {
  let start = now;
  for (const r of rows) {
    if (r.status !== 'granted' || rankOf(r.tier) < rankOf(tier)) continue;
    const end = endOf(r);
    if (end > start) start = end;
  }
  return start;
}

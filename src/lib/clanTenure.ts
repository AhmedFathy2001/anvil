// Clan tenure: how long a clan has paid for Anvil without a break, on the same ladder as a
// Supporter's star (lib/supporterTiers TENURE_LADDER). Pure: the billing paths call these to move
// clans.paid_since / paid_ended_at (drizzle/0254), readers to say what the clan has earned.
//
// Only paid membership counts: a clan comped by hand (a plan with no subscription) shows nothing,
// and a refund or chargeback wipes the run. A lapse shorter than the grace (a failed card, a late
// renewal) keeps it, the same 30 days as a Supporter.

import { TENURE_GRACE_MS, parseStamp, tenureFor, wholeMonths, type TenureStep } from './supporterTiers.ts';

export interface ClanRunLike {
  plan: string;
  paidSince: string | null;
  paidEndedAt: string | null;
  gumroadSubscriptionId?: string | null;
}

const isFree = (plan: string) => plan === 'free' || plan === 'creator_free';
const iso = (ms: number) => new Date(ms).toISOString();

/** The columns to set when a clan goes onto (or stays on) a paid plan. */
export function runOnPaid(clan: ClanRunLike, now = Date.now()): { paidSince: string; paidEndedAt: null } {
  const ended = parseStamp(clan.paidEndedAt);
  const keep =
    !!clan.paidSince && (!isFree(clan.plan) || Number.isNaN(ended) || now - ended <= TENURE_GRACE_MS);
  return { paidSince: keep ? clan.paidSince! : iso(now), paidEndedAt: null };
}

/** The columns to set when a paid plan ends (the clan drops to free, history kept). */
export function runOnEnded(clan: ClanRunLike, now = Date.now()): { paidEndedAt?: string } {
  return clan.paidSince && !isFree(clan.plan) ? { paidEndedAt: iso(now) } : {};
}

/** The columns to set when the money was taken back: the run is gone. */
export const runOnRefund = (): { paidSince: null; paidEndedAt: null } => ({ paidSince: null, paidEndedAt: null });

export interface ClanTenure {
  months: number;
  step: TenureStep;
  since: string;
}

/** What the clan has earned right now, or null (free, comped, or never paid). */
export function clanTenure(clan: ClanRunLike, now = Date.now()): ClanTenure | null {
  if (isFree(clan.plan) || !clan.gumroadSubscriptionId || !clan.paidSince) return null;
  const start = parseStamp(clan.paidSince);
  if (Number.isNaN(start)) return null;
  const months = wholeMonths(start, now);
  return { months, step: tenureFor(months).step, since: iso(start) };
}

/** "Backing Anvil for 1 year" — the line a clan's badge carries. */
export function clanTenureLine(t: ClanTenure): string {
  const y = Math.floor(t.months / 12);
  if (y >= 1) return `Backing Anvil for ${y} year${y === 1 ? '' : 's'}`;
  return t.months >= 1 ? `Backing Anvil for ${t.months} month${t.months === 1 ? '' : 's'}` : 'New on Anvil';
}

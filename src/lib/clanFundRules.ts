// The clan fund, pure (lib/clanFund does the reads and writes; tests/clan-fund-rules.test.ts).
//
// The owner starts a fund FOR ONE PLAN. Its goal is that plan's yearly price (a year costs ten
// months, lib/billingInterval). Members chip in with a yearly Gumroad membership from $6, renewing
// until they cancel; the clan's payer covers whatever is left with the same product. The fund never
// picks a tier of its own: below the goal the clan stays where it is, at the goal it gets the plan.
//
//   counting   'active' always; 'cancelling' until the year it paid for runs out; nothing else.
//   funded     counting total ≥ goal → the clan gets the plan, collection closes ("Fully funded").
//   short      a funded clan whose total drops below the goal keeps the plan GRACE_DAYS, then goes
//              to free. Nothing is deleted. Back over the goal inside the grace, nothing happens.

import { yearlyPriceUsd } from './billingInterval.ts';
import { PLANS } from './plans.ts';

export const FUND_PLANS = ['bronze', 'silver', 'gold'] as const;
export type FundPlanId = (typeof FUND_PLANS)[number];
export const isFundPlan = (v: unknown): v is FundPlanId => typeof v === 'string' && (FUND_PLANS as readonly string[]).includes(v);

/** The smallest chip-in, in cents (the product's pay-what-you-want minimum). */
export const MIN_CHIP_CENTS = 600;
export const GRACE_DAYS = 7;
/** How far ahead the "the fund will be short" warning looks. */
export const WARN_DAYS = 7;
const DAY = 86_400_000;

export type PledgeStatus = 'active' | 'cancelling' | 'failed' | 'ended' | 'refunded';

export interface PledgeLike {
  status: string;
  cents: number;
  recurrence?: string | null;
  currentPeriodEnd?: string | null;
  isPayer?: boolean;
  userId?: number | null;
}

/** Both timestamp shapes the database holds (lib/dbTime): JS ISO and 'YYYY-MM-DD HH:MM:SS' UTC. */
export function stampMs(stamp: string | null | undefined): number {
  if (!stamp) return NaN;
  return Date.parse(stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`);
}

/** The fund's goal in cents: the plan's yearly price. */
export function goalCents(plan: FundPlanId): number {
  return Math.round((yearlyPriceUsd(PLANS[plan].priceUsd) ?? 0) * 100);
}

/** Does this chip-in count toward the fund at `now`? */
export function counts(p: PledgeLike, now: number): boolean {
  if (p.status === 'active') return true;
  if (p.status === 'cancelling') {
    const end = stampMs(p.currentPeriodEnd);
    return Number.isFinite(end) && end > now;
  }
  return false;
}

/** What one chip-in gives a year, in cents (the product is yearly; a monthly one is twelve). */
export function yearlyCents(p: PledgeLike): number {
  return p.recurrence === 'monthly' ? p.cents * 12 : p.cents;
}

export interface FundTotals {
  goal: number;
  total: number;
  /** What's left to the goal, 0 once it is met. */
  left: number;
  /** People who chipped in and count now (the payer's share not among them). Never who gave what. */
  members: number;
  funded: boolean;
  pct: number;
}

export function fundTotals(plan: FundPlanId, pledges: PledgeLike[], now: number): FundTotals {
  const goal = goalCents(plan);
  const live = pledges.filter((p) => counts(p, now));
  const total = live.reduce((sum, p) => sum + yearlyCents(p), 0);
  const people = new Set<string>();
  live.filter((p) => !p.isPayer).forEach((p, i) => people.add(p.userId != null ? `u${p.userId}` : `anon${i}`));
  return {
    goal,
    total,
    left: Math.max(0, goal - total),
    members: people.size,
    funded: goal > 0 && total >= goal,
    pct: goal > 0 ? Math.min(100, Math.floor((total / goal) * 100)) : 0,
  };
}

/** The total the fund will have in `days`, if every active chip-in renews and cancelled ones end on time. */
export function totalIn(pledges: PledgeLike[], now: number, days = WARN_DAYS): number {
  return pledges.filter((p) => counts(p, now + days * DAY)).reduce((sum, p) => sum + yearlyCents(p), 0);
}

export type FundStep =
  | { kind: 'grant' }
  | { kind: 'keep' }
  | { kind: 'short'; graceEndsAt: number }
  | { kind: 'drop' }
  | { kind: 'none' };

/**
 * What a recompute does. `granted`: the plan in force is the fund's. `shortSince`: when the grace began.
 * `blocked`: another membership pays for the clan's plan, so the fund never grants (they're exclusive).
 */
export function fundStep(args: { funded: boolean; granted: boolean; shortSince: number | null; blocked: boolean; now: number }): FundStep {
  const { funded, granted, shortSince, blocked, now } = args;
  if (blocked) return { kind: 'none' };
  if (funded) return granted && shortSince == null ? { kind: 'keep' } : { kind: 'grant' };
  if (!granted) return { kind: 'none' };
  const since = shortSince ?? now;
  const graceEndsAt = since + GRACE_DAYS * DAY;
  return now >= graceEndsAt ? { kind: 'drop' } : { kind: 'short', graceEndsAt };
}

/**
 * Spread into every write that gives a clan its plan from a MEMBERSHIP (a sale, a renewal, a restart,
 * an older membership taking over, a staff edit): from then on the plan is not the fund's, so a fund
 * recompute or a lapse check never treats it as one.
 */
export const MEMBERSHIP_OWNS_PLAN = { fundFunded: false, fundShortSince: null } as const;

/** Does the clan fund pay for the plan in force? Only its own plan, and only while it says so. */
export function fundPaysPlan(clan: { plan: string; fundPlan?: string | null; fundFunded?: boolean | null }): boolean {
  return !!clan.fundFunded && !!clan.fundPlan && clan.plan === clan.fundPlan;
}

export function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
}

/** A checkout link for the fund product, carrying the clan's ref and, when known, who is paying. */
export function fundCheckoutUrl(base: string | null | undefined, clanRef: string | null | undefined, payerRef: string | null | undefined, cover = false): string | null {
  if (!base || !clanRef) return null;
  const params = new URLSearchParams({ ref: clanRef });
  if (payerRef) params.set('payer', payerRef);
  if (cover) params.set('cover', '1');
  return `${base}${base.includes('?') ? '&' : '?'}${params.toString()}`;
}

// Anvil's own plan trial, the pure half (lib/planTrials does the reads and writes;
// tests/plan-trial-rules.test.ts).
//
// A plan trial lends a clan or creator space a paid tier until a date, with no card and no Gumroad
// membership behind it. It is an owner_trials row of kind 'plan'; `clans.plan` is NEVER written, so
// what the row pays for and what it is lent stay two separate facts. The tier in force is the higher
// of the two, decided at read time: when the date passes the trial simply stops counting.
//
// EVERY new clan or space gets one automatically (the top tier, "no restrictions", 30 days by
// default) with no card. autoTrialDecision is the whole rule for when it does not.

import { planOf, planRank, trialDaysFrom } from './plans.ts';
import { CREATOR_BUYABLE, CREATOR_PLANS, creatorPlanOf, creatorPlanRank, isCreatorPlanId } from './creatorCatalog.ts';

const DAY = 86_400_000;

/** After a trial ends, how long the page still says "Your trial ended on …" before the ordinary upgrade prompt. */
export const PLAN_TRIAL_GRACE_DAYS = 3;
/** Inside this many days of the end, the button reads "Subscribe to keep <tier>". */
export const PLAN_TRIAL_LAST_DAYS = 7;

/**
 * How long the automatic trial on a new clan or creator space runs (ANVIL_PLAN_TRIAL_DAYS, default
 * 30). 0 switches automatic trials off; staff can still grant one by hand.
 */
export function autoTrialDays(raw: string | undefined = process.env.ANVIL_PLAN_TRIAL_DAYS): number {
  if (raw == null || raw.trim() === '') return 30;
  return Math.min(trialDaysFrom(raw), 365);
}

/** The tiers a plan trial may lend, per catalogue (never Free, never the hand-set Custom / Partner). */
export function trialTierIds(kind: string | null | undefined): string[] {
  return kind === 'creator' ? CREATOR_BUYABLE.map((p) => p.id) : ['bronze', 'silver', 'gold'];
}

/** The tier the automatic trial lends: the top one on sale in the row's catalogue. */
export function topTrialTier(kind: string | null | undefined): string {
  const ids = trialTierIds(kind);
  return ids[ids.length - 1];
}

/** A plan id's rank inside its own catalogue (Free 0). An id from the other catalogue ranks as Free. */
export function tierRankOf(kind: string | null | undefined, id: string | null | undefined): number {
  return kind === 'creator' ? creatorPlanRank(creatorPlanOf(id)) : planRank(planOf(id));
}

/** The display name of a plan id in the row's catalogue. */
export function tierNameOf(kind: string | null | undefined, id: string | null | undefined): string {
  return kind === 'creator' ? (isCreatorPlanId(id) ? CREATOR_PLANS[id].name : CREATOR_PLANS.creator_free.name) : planOf(id).name;
}

/** The member cap a plan id carries in the row's catalogue (null = none). */
export function tierCapOf(kind: string | null | undefined, id: string | null | undefined): number | null {
  return kind === 'creator' ? creatorPlanOf(id).memberCap : planOf(id).memberCap;
}

export interface RunningTrial {
  tier: string;
  endsAt: number;
}

/**
 * The plan in force: what the row pays for (`stored`), or the running trial's tier when that is
 * higher. A purchase of the trial's tier or above simply takes over; a purchase BELOW it does not
 * cut the trial short. An ended or absent trial changes nothing.
 */
export function effectivePlanId(kind: string | null | undefined, stored: string, trial: RunningTrial | null, now = Date.now()): string {
  if (!trial || trial.endsAt <= now) return stored;
  if (!trialTierIds(kind).includes(trial.tier)) return stored;
  return tierRankOf(kind, trial.tier) > tierRankOf(kind, stored) ? trial.tier : stored;
}

/** The member cap in force with it: the higher of the stored cap and the trial tier's (null = no cap). */
export function effectiveMemberCap(kind: string | null | undefined, stored: string, storedCap: number | null, trial: RunningTrial | null, now = Date.now()): number | null {
  if (effectivePlanId(kind, stored, trial, now) === stored) return storedCap;
  const lent = tierCapOf(kind, trial!.tier);
  if (storedCap == null || lent == null) return null;
  return Math.max(storedCap, lent);
}

// ── The one-trial rule ──────────────────────────────────────────────────────────────────────────

export type AutoTrialRefusal = 'off' | 'clan-had-trial' | 'had-membership' | 'name-had-trial';

export interface AutoTrialFacts {
  /** autoTrialDays(): 0 = automatic trials are off. */
  days: number;
  /** This clan or space already has a plan trial on record (running, ended or revoked). */
  clanHadTrial: boolean;
  /** It has ever had a paid membership, or a Gumroad trial of one. */
  hadMembership: boolean;
  /**
   * A clan with this in-game name, VERIFIED, already used a trial and was then deleted: creating it
   * again does not restart the trial. False for a space, and for a clan that names no in-game clan yet.
   */
  nameHadTrial: boolean;
}

/**
 * Does a new clan or creator space start its automatic trial? Every one does, a person's second clan
 * included, except: automatic trials are off; this row already had one; it has had a paid membership;
 * or it is a deleted clan (same verified in-game name) created again.
 */
export function autoTrialDecision(f: AutoTrialFacts): { grant: true } | { grant: false; reason: AutoTrialRefusal } {
  if (f.days <= 0) return { grant: false, reason: 'off' };
  if (f.clanHadTrial) return { grant: false, reason: 'clan-had-trial' };
  if (f.hadMembership) return { grant: false, reason: 'had-membership' };
  if (f.nameHadTrial) return { grant: false, reason: 'name-had-trial' };
  return { grant: true };
}

/** The key an in-game clan name is remembered by. */
export function inGameNameKey(name: string | null | undefined): string | null {
  const k = (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return k || null;
}

// ── What the owner sees ─────────────────────────────────────────────────────────────────────────

export type TrialPhase =
  /** Running, more than PLAN_TRIAL_LAST_DAYS left. */
  | 'running'
  /** Running, in its last days. */
  | 'last-days'
  /** Ended within PLAN_TRIAL_GRACE_DAYS, not paid for. */
  | 'just-ended'
  /** Ended longer ago, revoked, or paid for: nothing trial-specific to say. */
  | 'none';

export function trialPhase(t: { endsAt: number; revoked: boolean } | null, paidCovers: boolean, now = Date.now()): TrialPhase {
  if (!t || t.revoked || paidCovers) return 'none';
  if (t.endsAt > now) return t.endsAt - now <= PLAN_TRIAL_LAST_DAYS * DAY ? 'last-days' : 'running';
  return now - t.endsAt <= PLAN_TRIAL_GRACE_DAYS * DAY ? 'just-ended' : 'none';
}

/** Whole days left, rounded up ("3 days left" until the last hour). 0 once it is over. */
export function daysLeft(endsAt: number, now = Date.now()): number {
  return endsAt > now ? Math.ceil((endsAt - now) / DAY) : 0;
}

/** A clan converted if it now PAYS (a Gumroad membership) for the trial's tier or above. */
export function planConverted(clan: { kind: string; plan: string; gumroadSubscriptionId: string | null }, trialTier: string): boolean {
  return !!clan.gumroadSubscriptionId && tierRankOf(clan.kind, clan.plan) >= tierRankOf(clan.kind, trialTier) && tierRankOf(clan.kind, trialTier) > 0;
}

// ── Which checkout a buy button opens ───────────────────────────────────────────────────────────

export interface BuyFacts {
  /** TRIAL_DAYS (or the Supporter equivalent): Gumroad's own trial length; 0 = Gumroad's trial is off. */
  gumroadTrialDays: number;
  /** They have had a trial of this product family: a site trial, a Gumroad trial, or a membership. */
  trialUsed: boolean;
  /** The original product's checkout link (with Gumroad's trial when one is switched on there). */
  trialUrl: string | null;
  /** The pay-now product's checkout link (no trial, charged at once). */
  nowUrl: string | null;
}

export type BuyButtons =
  /** Never had a trial and Gumroad's is on: "Start free trial", with "Skip trial, pay now" when that link exists. */
  | { kind: 'trial'; trialUrl: string; nowUrl: string | null; trialDays: number }
  /** One button, charged today. */
  | { kind: 'subscribe'; url: string }
  /** They have had their trial and the pay-now link is not set up yet: nothing to open. */
  | { kind: 'soon' }
  /** No checkout configured at all. */
  | { kind: 'none' };

/**
 * The buttons a tier gets. Nobody who has had a trial is ever sent to the product that starts another:
 * they get the pay-now product, or "Subscribing opens soon" until it is configured.
 */
export function buyButtons(f: BuyFacts): BuyButtons {
  if (f.trialUsed) {
    if (f.nowUrl) return { kind: 'subscribe', url: f.nowUrl };
    // With Gumroad's trial off the original product charges at once too, so it is safe to use.
    if (f.gumroadTrialDays <= 0 && f.trialUrl) return { kind: 'subscribe', url: f.trialUrl };
    return f.trialUrl ? { kind: 'soon' } : { kind: 'none' };
  }
  if (f.gumroadTrialDays > 0 && f.trialUrl) return { kind: 'trial', trialUrl: f.trialUrl, nowUrl: f.nowUrl, trialDays: f.gumroadTrialDays };
  const url = f.trialUrl ?? f.nowUrl;
  return url ? { kind: 'subscribe', url } : { kind: 'none' };
}

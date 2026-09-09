// What a clan's subscription actually IS, and whether an operator should look at it.
//
// The billing columns have been on `clans` since the control plane was folded in, written by the
// Gumroad webhook and read by exactly one page: /portal, which is the customer's own view of their
// own subscription. The operator surface could show `plan` and nothing else — so nobody running
// this could answer, from inside the product, who is on trial, whose trial ends on Thursday, who
// cancelled but is still inside the term they paid for, or whose renewal date went by a fortnight
// ago while their plan still says gold.
//
// Four columns and a plan name do not read as a state on their own; the combinations are what mean
// something, and they are not obvious. `cancelAtPeriodEnd` with a future `currentPeriodEnd` is a
// paying customer who is leaving — the most important row on the page and the least visible one.
// `plan: 'gold'` with no subscription id at all is a clan somebody comped by hand, which is fine
// and must never be chased for payment.
//
// Pure and dependency-free (no `@/` imports) so tests/clan-billing.test.ts can type-strip it, the
// same way lib/adminAttention and lib/eventStage do. Every threshold lives here so the wording and
// the sorting cannot drift apart.

export type BillingState =
  /** Inside a trial that has not run out. */
  | 'trialing'
  /** The trial ran out and nothing was ever paid. */
  | 'trial-expired'
  /** Paying, renewing. */
  | 'active'
  /** Paying, cancelled, still inside the term they bought. Leaving unless something changes. */
  | 'cancelling'
  /** Had a subscription; the period end is behind us. A failed payment, or a cancel we missed. */
  | 'lapsed'
  /** On a paid plan with no subscription behind it — comped, or migrated by hand. */
  | 'comped'
  /** Free tier, no trial, nothing owed. The ordinary resting state under freemium. */
  | 'free';

export interface BillingFacts {
  plan: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  subscribed: boolean;
}

export interface BillingStatus {
  state: BillingState;
  /**
   * Days until the date that matters for this state — the trial's end, or the period's.
   * Negative once it is behind us. Null when no date applies.
   */
  daysLeft: number | null;
  /** One line, in the words an operator would use. */
  label: string;
  /** Worth a human's attention now. Drives the "needs a look" section, not the colour of a chip. */
  attention: boolean;
}

const DAY = 86_400_000;

/** Inside this many days, a trial ending stops being a fact and becomes something to do about. */
export const TRIAL_WARN_DAYS = 7;

/**
 * How far past a renewal date we tolerate before calling it lapsed.
 *
 * Gumroad's webhook for a successful renewal does not always land on the exact hour the old period
 * ends, and clock skew is real, so a clan is not delinquent the moment the timestamp passes. A day
 * is longer than any of that and shorter than anybody would notice.
 */
const GRACE_DAYS = 1;

/** Whole days from `now` to an ISO/space-separated stamp. Negative once it is in the past. */
export function daysUntil(stamp: string | null, now: number): number | null {
  if (!stamp) return null;
  // These columns hold two timestamp shapes — ISO from JS, 'YYYY-MM-DD HH:MM:SS' from Postgres —
  // and only the first ten characters mean the same thing in both. See lib/dbTime.
  const parsed = Date.parse(stamp.includes('T') ? stamp : stamp.replace(' ', 'T') + 'Z');
  if (Number.isNaN(parsed)) return null;
  return Math.floor((parsed - now) / DAY);
}

function plural(n: number, one: string): string {
  return `${n} ${n === 1 ? one : one + 's'}`;
}

/**
 * The state, and how long it has left.
 *
 * Order matters: a trial is asked about first because a clan can hold a trial date AND a plan name
 * at once, and while the trial is running that is what it is.
 */
export function billingStatus(facts: BillingFacts, now: number): BillingStatus {
  const trial = daysUntil(facts.trialEndsAt, now);
  const period = daysUntil(facts.currentPeriodEnd, now);

  if (trial != null && trial >= 0 && !facts.subscribed) {
    return {
      state: 'trialing',
      daysLeft: trial,
      label: trial === 0 ? 'Trial ends today' : `Trial · ${plural(trial, 'day')} left`,
      attention: trial <= TRIAL_WARN_DAYS,
    };
  }

  if (facts.subscribed) {
    if (facts.cancelAtPeriodEnd) {
      return {
        state: 'cancelling',
        daysLeft: period,
        // NOT "cancelled". They are still paid up, still served, and still reachable — which is the
        // entire reason this deserves to be on the page rather than in a report next quarter.
        label:
          period != null && period >= 0
            ? `Cancelling · ${plural(period, 'day')} left`
            : 'Cancelled, term over',
        attention: true,
      };
    }
    if (period != null && period < -GRACE_DAYS) {
      return {
        state: 'lapsed',
        daysLeft: period,
        label: `Renewal ${plural(Math.abs(period), 'day')} overdue`,
        attention: true,
      };
    }
    return {
      state: 'active',
      daysLeft: period,
      label: period != null && period >= 0 ? `Renews in ${plural(period, 'day')}` : 'Active',
      attention: false,
    };
  }

  if (trial != null && trial < 0) {
    return {
      state: 'trial-expired',
      daysLeft: trial,
      label: `Trial ended ${plural(Math.abs(trial), 'day')} ago`,
      // Not a fault and not urgent — under freemium they simply fell back to free — but it is the
      // moment a conversation is worth having, and nothing else on the platform marks it.
      attention: true,
    };
  }

  // A paid plan with nothing behind it. Deliberate in every case we have (a migration, a deal, a
  // clan being let off while something is fixed), so it is stated rather than flagged.
  if (facts.plan !== 'free') {
    return { state: 'comped', daysLeft: null, label: `${facts.plan} · no subscription`, attention: false };
  }

  return { state: 'free', daysLeft: null, label: 'Free', attention: false };
}

/**
 * How long a clan has been quiet.
 *
 * Two different silences, and only one of them is a problem: a clan that has not run an event since
 * March may simply run one bingo a quarter, but a clan whose roster has not synced in a month has
 * nobody with the plugin installed, and everything downstream of the roster is stale for them.
 */
export interface Liveness {
  /** Days since the last event or competition started. Null if it never ran one. */
  eventDays: number | null;
  /** Days since a roster push last arrived. Null if it never synced. */
  syncDays: number | null;
  /** Nothing has arrived from the game in a long time — the signal that matters. */
  quiet: boolean;
}

/** Past this with no roster push, treat the clan as not actually running. */
export const QUIET_SYNC_DAYS = 30;

export function liveness(
  row: { lastEventAt: string | null; lastRosterSyncAt: string | null },
  now: number,
): Liveness {
  const eventDays = negate(daysUntil(row.lastEventAt, now));
  const syncDays = negate(daysUntil(row.lastRosterSyncAt, now));
  return {
    eventDays,
    syncDays,
    // A clan that has NEVER synced is not quiet, it is new or unverified — both already have their
    // own line on the overview, and adding it here would say the same thing twice.
    quiet: syncDays != null && syncDays >= QUIET_SYNC_DAYS,
  };
}

function negate(n: number | null): number | null {
  return n == null ? null : Math.max(0, -n);
}

// The plan-limit rules, with no database anywhere in sight.
//
// Split out from lib/member-cap so the grace-window arithmetic — the part that decides whether a
// clan keeps growing — can be unit-tested directly (tests/member-cap.test.ts). Imports nothing on
// purpose: that's what lets Node's native type-stripping run it without resolving the `@/` alias.

/**
 * How long a clan may sit over its cap before new members stop being added.
 *
 * Time, not a headcount. A roster sync that hasn't run in weeks lands its whole backlog in one go,
 * so a numeric grace ("cap + 10") would be spent by a single catch-up sync and block a clan that
 * did nothing wrong. A month is long enough to notice the prompts, decide, and upgrade — or to
 * trim the roster — without anyone's plugin breaking mid-event.
 */
export const CAP_GRACE_DAYS = 30;

/** Start warning while there's still room to act, rather than at the moment it's too late. */
export const CAP_NEAR_WINDOW = 10;

export type CapState =
  /** Comfortably under the cap. */
  | 'ok'
  /** Within CAP_NEAR_WINDOW of the cap — nudge before it bites. */
  | 'approaching'
  /** Over the cap, inside the grace window. Everything still works; upgrade prompts show. */
  | 'grace'
  /** Over the cap past the grace window. New members stop being added; nothing else changes. */
  | 'blocked';

export interface CapStatus {
  cap: number | null; // null = unlimited
  active: number;
  overLimit: boolean;
  remaining: number | null; // null = unlimited
  state: CapState;
  /** ISO timestamp the clan first went over, or null when under the cap. */
  overSince: string | null;
  /** ISO timestamp new members stop being accepted, or null when not over. */
  graceEndsAt: string | null;
  /** Whole days left in the grace window (0 once it has expired). */
  graceDaysLeft: number | null;
}

/**
 * Assemble the status from a headcount and a (possibly null) over-since stamp. Pure — exported so
 * the grace-window rules can be tested without a database (tests/member-cap.test.ts).
 */
export function statusFrom(cap: number | null, active: number, overSince: string | null, now: Date): CapStatus {
  if (cap == null) {
    return { cap: null, active, overLimit: false, remaining: null, state: 'ok', overSince: null, graceEndsAt: null, graceDaysLeft: null };
  }
  const remaining = Math.max(0, cap - active);
  if (active <= cap) {
    return {
      cap,
      active,
      overLimit: false,
      remaining,
      state: remaining <= CAP_NEAR_WINDOW ? 'approaching' : 'ok',
      overSince: null,
      graceEndsAt: null,
      graceDaysLeft: null,
    };
  }
  const since = overSince ?? now.toISOString();
  const graceEnds = new Date(Date.parse(since) + CAP_GRACE_DAYS * 86_400_000);
  const msLeft = graceEnds.getTime() - now.getTime();
  return {
    cap,
    active,
    overLimit: true,
    remaining: 0,
    state: msLeft > 0 ? 'grace' : 'blocked',
    overSince: since,
    graceEndsAt: graceEnds.toISOString(),
    graceDaysLeft: Math.max(0, Math.ceil(msLeft / 86_400_000)),
  };
}

/**
 * How many NEW billable members may still be added. Null = unlimited.
 *
 * Only 'blocked' actually stops growth: under the cap, approaching it, or inside the grace window,
 * a clan keeps adding members exactly as before. Nothing here ever removes or disables an existing
 * member — going over your plan shouldn't break the people already playing.
 */
export function newMemberAllowance(status: CapStatus): number | null {
  if (status.cap == null) return null;
  return status.state === 'blocked' ? 0 : null;
}

/** One line explaining the current state, written for a clan admin rather than an operator. */
export function capMessage(status: CapStatus): string | null {
  if (status.cap == null) return null;
  switch (status.state) {
    case 'approaching':
      return `${status.active} of ${status.cap} member slots used — ${status.remaining} left.`;
    case 'grace':
      return `Your roster is over its ${status.cap}-member plan (${status.active} members). You have ${status.graceDaysLeft} day${status.graceDaysLeft === 1 ? '' : 's'} to upgrade or trim it before new members stop being added.`;
    case 'blocked':
      return `Your roster is over its ${status.cap}-member plan (${status.active} members) and the grace period has ended, so new members are no longer added. Existing members are unaffected — upgrade or trim the roster to resume.`;
    default:
      return null;
  }
}

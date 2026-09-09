// Where a dashboard snooze is kept, and how long one may last.
//
// Split out of the route so the dashboard page can read the same key and the same parser without
// importing a route handler, and so the clamp is stated once rather than in two places that drift.

/** One settings row per clan holding `{ itemKey: expiresAtEpochMs }`. */
export const SNOOZE_SETTING_KEY = 'dashboard_attention_snooze';

/**
 * The longest anything may be put down for.
 *
 * A month is longer than any real "I know, it's next week" and short enough that a snooze can never
 * become a way of deleting an item. Anything that genuinely should not be tracked has a real
 * control somewhere else — write the fees off, give the board dates.
 */
export const MAX_SNOOZE_DAYS = 30;

/** Tolerant of anything: a corrupt or hand-edited setting means "nothing is snoozed", never a crash. */
export function parseSnoozes(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

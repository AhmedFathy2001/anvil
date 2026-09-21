/**
 * WHEN A MEMBER IS WORTH ASKING THE HISCORES ABOUT AGAIN.
 *
 * Its own module, with no database import, because this is the arithmetic the sweep runs on and
 * pure arithmetic must be testable without standing a Postgres up — the convention lib/cofferMath
 * already set, and which tests/pure-module-imports enforces. It lived in lib/statHistory, which
 * reaches for @/db at module scope, so its suite could not load at all.
 */

const MINUTE = 60_000;

/**
 * The longest anyone RACING RIGHT NOW may be left unread.
 *
 * The full ladder assumes the plugin is the live signal and the sweep is the fallback that fills the
 * gaps. When a push stops arriving — the setting is off, the config poll is failing, the client is
 * simply not running — that assumption fails silently, and the person's own competition row stops
 * moving for two hours while they are actively training the metric. Somebody watching the board
 * they are second on cannot tell that from broken, and reasonably reports it as such.
 */
const ENROLLED_MAX = 30 * MINUTE;

/**
 * How long until this member is worth fetching again, given how many consecutive fetches found
 * nothing new. Capped at two hours on purpose: everyone in the sweep's queue is enrolled in
 * something, so the cost of being late is a leaderboard that lags. A plugin push resets the streak,
 * so members running the plugin never sit on this ladder while they're playing.
 *
 * `enrolled` shortens the tail for someone in a LIVE competition, where "late" means a leaderboard
 * that looks frozen to the person on it.
 */
export function nextDueAfterMiss(missStreak: number, enrolled = false): number {
  if (missStreak <= 0) return 0;          // just gained something — keep them hot
  const ms = missStreak === 1 ? 30 * MINUTE : missStreak === 2 ? 60 * MINUTE : 120 * MINUTE;
  return enrolled ? Math.min(ms, ENROLLED_MAX) : ms;
}

/** ISO timestamp for the member's next eligible fetch, or null for "due now". */
export function nextDueAt(missStreak: number, from: Date = new Date(), enrolled = false): string | null {
  const ms = nextDueAfterMiss(missStreak, enrolled);
  return ms === 0 ? null : new Date(from.getTime() + ms).toISOString();
}

/** Whether a member is eligible this tick. Missing/!parseable due date means due. */
export function isDue(nextDueAtIso: string | null | undefined, now: Date = new Date()): boolean {
  if (!nextDueAtIso) return true;
  const due = Date.parse(nextDueAtIso);
  return Number.isNaN(due) || due <= now.getTime();
}


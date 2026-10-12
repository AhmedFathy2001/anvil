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


// ── Plugin-first ─────────────────────────────────────────────────────────────────────────────────
//
// A running plugin pushes every skill and KC the moment it moves (api/plugin/stats → the account's
// live overlay), which is fresher than anything the hiscores can say. So while it is pushing, the sweep
// stops spending Jagex budget re-reading what the client already told us, and only RECONCILES every
// few hours — the overlay is max(hiscores, pushed), and a reconcile is what lets a bad push heal.
//
// The moment pushes stop — logout, mobile play, a client that crashed mid-race — the account gets one
// poll straight away (the logout flush lands on the hiscores and the overlay reconciles), and from
// then on rides the ordinary ladder until the plugin comes back.

/** A push this recent means the client is running right now. */
export const PLUGIN_ACTIVE_MS = 20 * MINUTE;
/** How often a pushing account is still reconciled against the hiscores. */
export const PLUGIN_RECONCILE_MS = 6 * 60 * MINUTE;

export interface SweepDueInput {
  /** A competition row or stat tile still waiting on its first reading. Always due. */
  needsBaseline: boolean;
  /** The ladder's own schedule (statsNextDueAt). */
  nextDueAt: string | null | undefined;
  /** The last plugin push (accounts.live_stats_at). */
  liveStatsAt: string | null | undefined;
  /** The last hiscores poll (accounts.stats_polled_at). Null = never polled. */
  polledAt: string | null | undefined;
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return Number.isNaN(t) ? null : t;
}

/** Whether the sweep should ask the hiscores about this account this tick. */
export function sweepDue(input: SweepDueInput, now: Date = new Date()): boolean {
  if (input.needsBaseline) return true;
  const nowMs = now.getTime();
  const pushed = ms(input.liveStatsAt);
  const polled = ms(input.polledAt);

  // Never polled: one reading is what the overlay sits on top of, whatever the plugin is doing.
  if (polled === null) return true;

  if (pushed !== null && nowMs - pushed < PLUGIN_ACTIVE_MS) {
    return nowMs - polled >= PLUGIN_RECONCILE_MS;
  }
  // Pushes have stopped since our last look — read the hiscores once, now.
  if (pushed !== null && pushed > polled) return true;

  return isDue(input.nextDueAt, now);
}

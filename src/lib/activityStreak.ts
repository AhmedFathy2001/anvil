// Weekly activity streaks: the pure half (no database). A WEEK runs from the game's weekly reset,
// Wednesday 00:00 UTC, to the next. It counts when the character was active on at least
// ACTIVE_DAYS_NEEDED different days in it; a streak is consecutive weeks that counted.
//
// "Active" is real play, from the hiscores sweep (member_daily_stats): XP past a small floor, or any
// boss kill time. Never time logged in: rewarding that would reward AFKing.
//
// Rest weeks: one is banked at the start of every calendar month (never more than one held). A week
// that falls short spends it, and the streak carries on without growing. Free and the same for
// everyone — protection is never sold, so a streak can sit on a leaderboard.
//
// Milestones at 4 / 12 / 26 / 52 weeks: Kindled, Steady, Forged, Eternal.

export const ACTIVE_DAYS_NEEDED = 3;
/** A day's XP has to reach this to count (a few minutes of real training at any level). */
export const ACTIVE_XP_FLOOR = 1_000;
/** How far back a streak is replayed: two years of weeks. */
export const HISTORY_WEEKS = 104;

export const STREAK_MILESTONES = [
  { weeks: 4, name: 'Kindled' },
  { weeks: 12, name: 'Steady' },
  { weeks: 26, name: 'Forged' },
  { weeks: 52, name: 'Eternal' },
] as const;

const DAY_MS = 86_400_000;

/** Did this day of hiscores gains count as playing? */
export function isActiveDay(d: { xpGained: number; ehbMilliGained: number }): boolean {
  return d.xpGained >= ACTIVE_XP_FLOOR || d.ehbMilliGained > 0;
}

const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The Wednesday (UTC) that starts the game week holding `day`, as 'YYYY-MM-DD'. */
export function weekOf(day: string): string {
  const ms = dayMs(day);
  const dow = new Date(ms).getUTCDay(); // 0 Sun … 3 Wed
  return dayOf(ms - ((dow - 3 + 7) % 7) * DAY_MS);
}

/** When the week holding `day` ends (the next reset), as an ISO instant. */
export function weekEndsAt(day: string): string {
  return new Date(dayMs(weekOf(day)) + 7 * DAY_MS).toISOString();
}

export type WeekMark = 'active' | 'rest' | 'missed';

export interface Streak {
  /** Weeks in the streak, counting this week once it has its days. */
  weeks: number;
  best: number;
  /** Distinct active days so far this week, and how many it needs. */
  thisWeek: number;
  needed: number;
  /** This week already counts. */
  safe: boolean;
  /** A rest week is banked for the next week that falls short. */
  restBanked: boolean;
  /** Completed weeks oldest → newest (up to 52), then this week as 'active' only once safe. */
  history: WeekMark[];
  /** The milestone reached (null below Kindled), and the next one. */
  milestone: (typeof STREAK_MILESTONES)[number] | null;
  next: (typeof STREAK_MILESTONES)[number] | null;
  /** When this week ends: the reset. */
  resetsAt: string;
}

/**
 * A character's streak from the days it was active (UTC 'YYYY-MM-DD', any order, duplicates fine).
 * Replays HISTORY_WEEKS of weeks, so the answer only ever depends on the days given and `today`.
 */
export function streakFrom(activeDays: Iterable<string>, today: string): Streak {
  const perWeek = new Map<string, Set<string>>();
  for (const d of activeDays) {
    if (d > today) continue;
    const w = weekOf(d);
    let set = perWeek.get(w);
    if (!set) perWeek.set(w, (set = new Set()));
    set.add(d);
  }
  const current = weekOf(today);
  const curMs = dayMs(current);
  let run = 0;
  let best = 0;
  let bank = 0;
  let month = '';
  const history: WeekMark[] = [];
  for (let i = HISTORY_WEEKS; i >= 1; i--) {
    const w = dayOf(curMs - i * 7 * DAY_MS);
    // A new calendar month banks a rest week (one held at most).
    if (w.slice(0, 7) !== month) {
      month = w.slice(0, 7);
      bank = 1;
    }
    const days = perWeek.get(w)?.size ?? 0;
    let mark: WeekMark;
    if (days >= ACTIVE_DAYS_NEEDED) {
      run++;
      mark = 'active';
    } else if (run > 0 && bank > 0) {
      bank--;
      mark = 'rest';
    } else {
      run = 0;
      mark = 'missed';
    }
    best = Math.max(best, run);
    history.push(mark);
  }
  if (current.slice(0, 7) !== month) bank = 1;
  const thisWeek = perWeek.get(current)?.size ?? 0;
  const safe = thisWeek >= ACTIVE_DAYS_NEEDED;
  const weeks = run + (safe ? 1 : 0);
  best = Math.max(best, weeks);
  const shown = history.slice(-52);
  if (safe) shown.push('active');
  const reached = [...STREAK_MILESTONES].reverse().find((m) => weeks >= m.weeks) ?? null;
  const next = STREAK_MILESTONES.find((m) => weeks < m.weeks) ?? null;
  return {
    weeks,
    best,
    thisWeek,
    needed: ACTIVE_DAYS_NEEDED,
    safe,
    restBanked: bank > 0,
    history: shown,
    milestone: reached,
    next,
    resetsAt: weekEndsAt(today),
  };
}

/** Is this character on a streak right now (it counts, or last week did and this one can still)? */
export const onStreak = (s: Streak): boolean => s.weeks > 0;

/** The one login-brief line for a streak, or null when there's nothing worth saying. */
export function streakBriefLine(s: Streak): string | null {
  if (s.weeks === 0 && s.thisWeek === 0) return null;
  if (s.safe) {
    if (s.milestone && s.weeks === s.milestone.weeks) return `${s.weeks}-week streak! ${s.milestone.name} reached.`;
    return s.next ? `Week ${s.weeks} locked in. Next milestone: ${s.next.weeks} weeks.` : `Week ${s.weeks} locked in.`;
  }
  const left = s.needed - s.thisWeek;
  const days = `${left} more active day${left === 1 ? '' : 's'}`;
  if (s.weeks === 0) return `${days} this week starts a streak.`;
  return s.restBanked
    ? `Week ${s.weeks + 1}: ${days} before reset, or your rest week covers it.`
    : `Week ${s.weeks + 1}: ${days} before reset keeps your streak.`;
}

// Everything a ladder board knows about itself beyond "who has the most points".
//
// A ladder is the one format that usually never ends, and an endless leaderboard is only
// interesting if it can answer questions the raw total can't: am I climbing or sliding, is anyone
// on a run, what happened this week, who won the last one. All of that is derivable from
// `completions` — every row carries its team, its time and (often) the player it credited — so
// none of it needs a new table, a snapshot or a cron.
//
// Pure and dependency-free (like lib/eventRules and lib/eventAxes) so it's directly testable:
// the caller loads rows and hands them over as {@link Claim}s.

/** The shape this module ranks. Structurally satisfied by lib/memberBreakdown's IndividualStanding. */
export interface StandingRow {
  playerId: number;
  name: string;
  points: number;
  tasks: number;
}

/**
 * One scoring event on the ladder: a completed task, attributed to a person where we can.
 *
 * `playerId` is null when a completion can't be pinned to one member (a multi-person team finished
 * a team-total tile). Those still count for the board — the standings split them properly — they
 * just can't feed a personal streak, so the personal reads skip them.
 */
export interface Claim {
  playerId: number | null;
  teamId: number;
  tileId: number;
  /** ISO UTC, as stored in completions.completedAt. */
  at: string;
  points: number;
  label?: string;
}

const DAY_MS = 86_400_000;

// ---- calendar ---------------------------------------------------------------------------------

/** The UTC calendar month containing `now`, as an [start, end) ISO window. */
export function monthWindow(now: Date = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

/** The trailing `days`-day window ending now — the "who is moving right now" board. */
export function trailingWindow(days: number, now: Date = new Date()): { start: string; end: string } {
  return { start: new Date(now.getTime() - days * DAY_MS).toISOString(), end: now.toISOString() };
}

/** 'YYYY-MM' for an ISO timestamp — completions store UTC text, so a prefix slice is exact. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** The [start, end) ISO window for a 'YYYY-MM' key. */
export function monthWindowFor(key: string): { start: string; end: string } {
  const [y, m] = key.split('-').map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
    end: new Date(Date.UTC(y, m, 1)).toISOString(),
  };
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "August 2026" for a 'YYYY-MM' key. */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/**
 * Which season a rolling (monthly-reset) ladder is in — 1 for the month it started in, counting
 * whole calendar months since. Returns 1 when the event has no start date.
 */
export function seasonNumber(startDate: string | null | undefined, now: Date = new Date()): number {
  if (!startDate) return 1;
  const s = new Date(startDate);
  if (Number.isNaN(s.getTime())) return 1;
  const months =
    (now.getUTCFullYear() - s.getUTCFullYear()) * 12 + (now.getUTCMonth() - s.getUTCMonth());
  return Math.max(1, months + 1);
}

/** How far through the current month we are, 0–1 — the season meter. */
export function seasonProgress(now: Date = new Date()): { day: number; days: number; fraction: number } {
  const days = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const day = now.getUTCDate();
  return { day, days, fraction: Math.min(1, day / days) };
}

// ---- movement ---------------------------------------------------------------------------------

/**
 * How each player's RANK changed between two boards — positive means they climbed.
 *
 * The "before" board is the same standings computation run over completions older than the cutoff,
 * so this is exact history rather than a sampled snapshot: no extra table, and it stays correct
 * even if a completion is deleted or back-dated. Null means they weren't on the board at all then.
 */
export function rankMovement(
  current: StandingRow[],
  previous: StandingRow[],
): Map<number, number | null> {
  const was = new Map<number, number>();
  previous.forEach((r, i) => was.set(r.playerId, i + 1));
  const out = new Map<number, number | null>();
  current.forEach((r, i) => {
    const before = was.get(r.playerId);
    out.set(r.playerId, before === undefined ? null : before - (i + 1));
  });
  return out;
}

// ---- streaks ----------------------------------------------------------------------------------

const dayKey = (iso: string) => iso.slice(0, 10);

/** Distinct UTC days a player claimed something on, oldest first. */
function claimDays(claims: Claim[], playerId: number): string[] {
  const days = new Set<string>();
  for (const c of claims) if (c.playerId === playerId) days.add(dayKey(c.at));
  return [...days].sort();
}

const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

/**
 * A player's claim streak in days. `current` counts back from today (or yesterday — a streak
 * doesn't break until a whole day passes without a claim, otherwise everyone's streak would read
 * as broken every morning until they logged in).
 */
export function claimStreak(
  claims: Claim[],
  playerId: number,
  now: Date = new Date(),
): { current: number; longest: number; lastDay: string | null } {
  const days = claimDays(claims, playerId);
  if (days.length === 0) return { current: 0, longest: 0, lastDay: null };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = dayDiff(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const today = now.toISOString().slice(0, 10);
  const last = days[days.length - 1];
  const sinceLast = dayDiff(last, today);
  let current = 0;
  if (sinceLast <= 1) {
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (dayDiff(days[i - 1], days[i]) === 1) current++;
      else break;
    }
  }
  return { current, longest, lastDay: last };
}

/** The longest streak anyone has ever put together on this ladder. */
export function bestStreak(
  claims: Claim[],
  now: Date = new Date(),
): { playerId: number; days: number } | null {
  const ids = new Set<number>();
  for (const c of claims) if (c.playerId != null) ids.add(c.playerId);
  let best: { playerId: number; days: number } | null = null;
  for (const id of ids) {
    const { longest } = claimStreak(claims, id, now);
    if (!best || longest > best.days) best = { playerId: id, days: longest };
  }
  return best;
}

// ---- personal reads ---------------------------------------------------------------------------

/** A player's points per trailing 7-day bucket, oldest first — the "am I speeding up" chart. */
export function weekBuckets(
  claims: Claim[],
  playerId: number,
  weeks = 3,
  now: Date = new Date(),
): { start: string; end: string; points: number; tasks: number }[] {
  const out: { start: string; end: string; points: number; tasks: number }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = new Date(now.getTime() - w * 7 * DAY_MS);
    const start = new Date(end.getTime() - 7 * DAY_MS);
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    let points = 0;
    let tasks = 0;
    for (const c of claims) {
      if (c.playerId !== playerId) continue;
      if (c.at >= startIso && c.at < endIso) {
        points += c.points;
        tasks++;
      }
    }
    out.push({ start: startIso, end: endIso, points, tasks });
  }
  return out;
}

/** The biggest single claim a player has landed. */
export function bestClaim(claims: Claim[], playerId: number): Claim | null {
  let best: Claim | null = null;
  for (const c of claims) {
    if (c.playerId !== playerId) continue;
    if (!best || c.points > best.points) best = c;
  }
  return best;
}

/**
 * Where this season lands if the player keeps their current pace — points so far, scaled by how
 * much of the season is left. Returns null before there's enough of a season to extrapolate from
 * (a projection off six hours of data is a made-up number).
 */
export function projectSeason(
  pointsSoFar: number,
  seasonStart: string,
  seasonEnd: string,
  now: Date = new Date(),
): number | null {
  const start = Date.parse(seasonStart);
  const end = Date.parse(seasonEnd);
  const t = now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || t <= start) return null;
  const elapsed = t - start;
  if (elapsed < 2 * DAY_MS || pointsSoFar <= 0) return null;
  return Math.round((pointsSoFar / elapsed) * (end - start));
}

// ---- history ----------------------------------------------------------------------------------

/**
 * The months BEFORE the current one that had any activity, newest first — the seasons a rolling
 * ladder has already finished, and therefore the ones with a champion.
 */
export function pastSeasonKeys(claims: Claim[], now: Date = new Date(), limit = 6): string[] {
  const thisMonth = monthKey(now.toISOString());
  const keys = new Set<string>();
  for (const c of claims) {
    const k = monthKey(c.at);
    if (k < thisMonth) keys.add(k);
  }
  return [...keys].sort().reverse().slice(0, limit);
}

/** Most tasks any one player has claimed inside a single trailing week. */
export function bestWeek(claims: Claim[]): { playerId: number; tasks: number; points: number } | null {
  const byPlayerDay = new Map<string, { playerId: number; day: string; points: number; tasks: number }>();
  for (const c of claims) {
    if (c.playerId == null) continue;
    const key = `${c.playerId}:${dayKey(c.at)}`;
    const row = byPlayerDay.get(key) ?? { playerId: c.playerId, day: dayKey(c.at), points: 0, tasks: 0 };
    row.points += c.points;
    row.tasks++;
    byPlayerDay.set(key, row);
  }
  const rows = [...byPlayerDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  let best: { playerId: number; tasks: number; points: number } | null = null;
  for (const anchor of rows) {
    let tasks = 0;
    let points = 0;
    for (const r of rows) {
      if (r.playerId !== anchor.playerId) continue;
      const gap = dayDiff(anchor.day, r.day);
      if (gap >= 0 && gap < 7) {
        tasks += r.tasks;
        points += r.points;
      }
    }
    if (!best || tasks > best.tasks) best = { playerId: anchor.playerId, tasks, points };
  }
  return best;
}

// ---- feed -------------------------------------------------------------------------------------

export interface FeedItem {
  kind: 'claim' | 'opened' | 'closed';
  at: string;
  playerId?: number | null;
  playerName?: string;
  tileLabel: string;
  points?: number;
}

/**
 * The "as it happens" strip: claims interleaved with the board's own rotation, newest first.
 * Rotation events are what make a rotating ladder legible — a task appearing and a task expiring
 * are the two things that change what you should be doing.
 */
export function buildFeed(
  claims: Claim[],
  rotations: { label: string; revealedAt?: string | null; closedAt?: string | null }[],
  nameOf: (playerId: number) => string | undefined,
  limit = 8,
): FeedItem[] {
  const items: FeedItem[] = [];
  for (const c of claims) {
    items.push({
      kind: 'claim',
      at: c.at,
      playerId: c.playerId,
      playerName: c.playerId != null ? nameOf(c.playerId) : undefined,
      tileLabel: c.label ?? 'a task',
      points: c.points,
    });
  }
  for (const t of rotations) {
    if (t.revealedAt) items.push({ kind: 'opened', at: t.revealedAt, tileLabel: t.label });
    if (t.closedAt) items.push({ kind: 'closed', at: t.closedAt, tileLabel: t.label });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

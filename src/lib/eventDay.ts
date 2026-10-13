// Event "days" and the per-day snapshot the daily digest diffs against.
//
// A day is a 24h slice counted from the event's own start — not a calendar day in anybody's
// timezone. Two clans on a co-hosted board live in different zones; "Day 3" meaning hours 48–72 of
// the event is the one definition both sides read the same way, and it makes the digest land at the
// start's time of day, when people are already watching the channel.
//
// Imports nothing (except the dbTime parser's logic, inlined) so node's type-stripping tests can run it.

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Both stored timestamp formats ("YYYY-MM-DD HH:MM:SS" = UTC, and ISO) → epoch ms. */
export function stampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? null : ms;
}

/** 1-based event day a moment falls in; null before the start (or for an unparseable stamp). */
export function eventDayOf(stamp: string | null | undefined, startMs: number): number | null {
  const ms = stampMs(stamp);
  if (ms == null || ms < startMs) return null;
  return Math.floor((ms - startMs) / DAY_MS) + 1;
}

/** How many whole days an event spans (a 7-day event → 7; a 7½-day one → 8). */
export function eventDayCount(startMs: number, endMs: number): number {
  return Math.max(1, Math.ceil((endMs - startMs) / DAY_MS));
}

/**
 * The most recent FULL day whose digest is due at `nowMs`, or null.
 *
 * A day that ends at (or within `endGraceMs` of) the event's end is never digested: the event-ended
 * post covers it, and two posts a minute apart summarising the same hours is noise.
 */
export function dueDigestDay(nowMs: number, startMs: number, endMs: number, endGraceMs = 60 * 60 * 1000): number | null {
  if (nowMs < startMs + DAY_MS) return null;
  const day = Math.floor((nowMs - startMs) / DAY_MS);
  const dayEnd = startMs + day * DAY_MS;
  if (dayEnd >= endMs - endGraceMs) return null;
  return day;
}

/** The plugin's running per-event counters, plus a trimmed hiscores read, at one moment. */
export interface PlayerDayCounters {
  deaths: number;
  lootGp: number;
  pvpKills: number;
  minutes: number;
  caTasks: number;
  biggestHit: number;
  /** Trimmed hiscores JSON ({skills, bosses, clues}) — same shape biggestGain/clueGain read. */
  stats: string | null;
}

export interface TeamDayState {
  score: number;
  rank: number;
}

export interface DaySnapshotData {
  players: Record<string, PlayerDayCounters>;
  teams: Record<string, TeamDayState>;
  /** Running clan-of-the-day tally on a clan-v-clan board: clanId → days won. */
  clanDayWins?: Record<string, number>;
}

/**
 * Keep only what the digest diffs: skill XP, boss KC, clue counts. A full hiscores read carries
 * ranks and every activity; storing all of it per player per day is what bloated player_snapshots
 * once, so trim to the three sections and drop the ranks.
 */
export function trimStats(json: string | null | undefined): string | null {
  if (!json) return null;
  let parsed: Record<string, Record<string, { xp?: number; score?: number }>>;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  const out: Record<string, Record<string, { xp?: number; score?: number }>> = {};
  const keep = (section: 'skills' | 'bosses' | 'clues', field: 'xp' | 'score') => {
    const src = parsed?.[section];
    if (!src || typeof src !== 'object') return;
    const dst: Record<string, { xp?: number; score?: number }> = {};
    for (const [key, value] of Object.entries(src)) {
      const n = Number(value?.[field]);
      if (Number.isFinite(n) && n > 0) dst[key] = { [field]: n };
    }
    out[section] = dst;
  };
  keep('skills', 'xp');
  keep('bosses', 'score');
  keep('clues', 'score');
  return JSON.stringify(out);
}

/** Overall XP and summed boss KC gained between two (trimmed or full) hiscores reads. */
export function totalGains(
  baselineJson: string | null | undefined,
  currentJson: string | null | undefined,
): { xp: number; kc: number } {
  if (!baselineJson || !currentJson) return { xp: 0, kc: 0 };
  let before: Record<string, Record<string, { xp?: number; score?: number }>>;
  let after: typeof before;
  try {
    before = JSON.parse(baselineJson);
    after = JSON.parse(currentJson);
  } catch {
    return { xp: 0, kc: 0 };
  }
  const num = (v: unknown) => Math.max(0, Number(v ?? 0) || 0);
  // Overall when both sides have it; otherwise the sum of skills (a trimmed read may lack overall
  // when the account is unranked overall).
  const xpOf = (s: typeof before) => {
    const skills = s?.skills ?? {};
    if (skills.overall?.xp != null) return num(skills.overall.xp);
    return Object.entries(skills).reduce((sum, [k, v]) => (k === 'overall' ? sum : sum + num(v?.xp)), 0);
  };
  const kcOf = (s: typeof before) =>
    Object.values(s?.bosses ?? {}).reduce((sum, v) => sum + num(v?.score), 0);
  return {
    xp: Math.max(0, xpOf(after) - xpOf(before)),
    kc: Math.max(0, kcOf(after) - kcOf(before)),
  };
}

/** Rank teams by score, ties sharing a rank (1, 2, 2, 4). */
export function rankTeams(scores: { teamId: number; score: number }[]): Map<number, number> {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const ranks = new Map<number, number>();
  sorted.forEach((t, i) => {
    const prev = sorted[i - 1];
    ranks.set(t.teamId, prev && prev.score === t.score ? ranks.get(prev.teamId)! : i + 1);
  });
  return ranks;
}

/**
 * Biggest climb across a rank history: for each team, the worst rank it held at any snapshot minus
 * its final rank. Returns the best climber (ties → whoever finished higher), or null when nobody
 * climbed at least `minClimb` places.
 */
export function biggestComeback(
  history: Map<number, number>[],
  finalRanks: Map<number, number>,
  minClimb = 1,
): { teamId: number; from: number; to: number } | null {
  let best: { teamId: number; from: number; to: number } | null = null;
  for (const [teamId, to] of finalRanks) {
    let worst = to;
    for (const snap of history) {
      const r = snap.get(teamId);
      if (r != null && r > worst) worst = r;
    }
    const climb = worst - to;
    if (climb < minClimb) continue;
    if (!best || climb > best.from - best.to || (climb === best.from - best.to && to < best.to)) {
      best = { teamId, from: worst, to };
    }
  }
  return best;
}

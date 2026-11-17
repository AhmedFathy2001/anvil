// The daily post of a running weekly competition (SOTW, BOTW, an item hunt, efficiency): what each
// player gained since the day began, the standings, and who moved.
//
// The lifecycle tick already writes each weekly's ranks once per UTC day (lib/rankMoves, for the
// "▲3 today" on the standings). It now keeps the gains beside them, so the first tick of a new day
// has yesterday's start and today's start in hand: the difference is the day just finished.
//
// Pure: lib/competitionTeamsPosts decides who hears it; the tests drive this directly.

export interface DailyLine {
  rsn: string;
  /** Gained over the whole competition so far. */
  total: number;
  /** Gained during the day just finished. */
  day: number;
  rank: number;
  /** Places climbed during the day (negative = dropped); null when there is nothing to compare with. */
  moved: number | null;
}

export interface DayStart {
  ranks: Record<string, number>;
  /** Null on a row written before gains were kept: the day cannot be worked out. */
  gains: Record<string, number> | null;
}

/**
 * The board now against the board as the finished day began. `prev` null = the competition's first
 * day (everything gained so far was gained in it). Returns null when the day cannot be worked out.
 */
export function dailyLines(board: { rsn: string; gained: number }[], prev: DayStart | null, keyOf: (rsn: string) => string): DailyLine[] | null {
  if (prev && !prev.gains) return null;
  return board.map((e, i) => {
    const key = keyOf(e.rsn);
    const was = prev?.gains?.[key] ?? 0;
    const wasRank = prev?.ranks?.[key];
    return { rsn: e.rsn, total: e.gained, day: Math.max(0, e.gained - was), rank: i + 1, moved: wasRank != null ? wasRank - (i + 1) : null };
  });
}

/** A quiet day is not posted: nobody gained anything. */
export const dayWorthPosting = (lines: DailyLine[]): boolean => lines.some((l) => l.day > 0);

/** Who gained the most during the day; null on a quiet one. */
export function dayBest(lines: DailyLine[]): DailyLine | null {
  const best = [...lines].sort((a, b) => b.day - a.day || a.rank - b.rank)[0];
  return best && best.day > 0 ? best : null;
}

/** Who climbed the most places; null unless somebody climbed at least one. */
export function dayClimber(lines: DailyLine[]): DailyLine | null {
  const best = [...lines].filter((l) => (l.moved ?? 0) > 0).sort((a, b) => (b.moved ?? 0) - (a.moved ?? 0) || a.rank - b.rank)[0];
  return best ?? null;
}

const HOUR_MS = 3_600_000;
/**
 * Whether a daily post makes sense at this moment of the competition: not in its first half day (the
 * start post just went out) and not in its last three hours (the results are about to).
 */
export function dailyWindowOpen(startIso: string, endIso: string, nowMs: number): boolean {
  const a = Date.parse(startIso);
  const b = Date.parse(endIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return nowMs - a >= 12 * HOUR_MS && b - nowMs >= 3 * HOUR_MS;
}

/** A clan switch that is on unless it was turned off ("false" / "0"). */
export const switchOn = (raw: string | null | undefined): boolean => !(raw === 'false' || raw === '0');

export const WEEKLY_DAILY_KEY = 'weekly_post_daily';
export const WEEKLY_HALFWAY_KEY = 'weekly_post_halfway';

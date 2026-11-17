// "Is this running board keeping up with its clock?" The admin events list already works out how much
// of the window has gone and how much of the board is cleared, and never put the two side by side.
// Pure (no database), so the rule and its wording are tested directly (tests/event-pace.test.ts).

/** How many points of difference still read as on pace. */
export const PACE_TOLERANCE = 10;

export type PaceLabel = 'ahead' | 'on pace' | 'behind pace';

export interface Pace {
  label: PaceLabel;
  /** Whole percents, as the label's title quotes them. */
  timePct: number;
  boardPct: number;
  /** The hover text: both numbers, in words. */
  title: string;
}

/**
 * The window is `start` to `end` (ms), `now` is the clock, the board has `cleared` of `total` tiles.
 * Null when there is nothing to compare: no end date, no start, a window that does not run forward,
 * or a board with no tiles.
 */
export function eventPace(input: {
  start: number | null;
  end: number | null;
  now: number;
  cleared: number;
  total: number;
}): Pace | null {
  const { start, end, now, cleared, total } = input;
  if (start == null || end == null || !(end > start) || !(total > 0)) return null;
  const timePct = Math.round(Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)));
  const boardPct = Math.round(Math.min(100, Math.max(0, (cleared / total) * 100)));
  const gap = boardPct - timePct;
  const label: PaceLabel = gap > PACE_TOLERANCE ? 'ahead' : gap < -PACE_TOLERANCE ? 'behind pace' : 'on pace';
  return {
    label,
    timePct,
    boardPct,
    title: `${timePct}% of the time has gone and ${boardPct}% of the tiles are cleared. Within ${PACE_TOLERANCE} points of each other counts as on pace.`,
  };
}

import { modeKeyFor } from '@/lib/eventModes';

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Format large numbers with K/M/B suffixes
 * e.g., 4000000 -> "4M", 200000 -> "200K", 1500 -> "1.5K"
 */
export function formatNumber(num: number, decimals: number = 1): string {
  if (num >= 1_000_000_000) {
    const val = num / 1_000_000_000;
    return val % 1 === 0 ? `${val}B` : `${val.toFixed(decimals)}B`;
  }
  if (num >= 1_000_000) {
    const val = num / 1_000_000;
    return val % 1 === 0 ? `${val}M` : `${val.toFixed(decimals)}M`;
  }
  if (num >= 1_000) {
    const val = num / 1_000;
    return val % 1 === 0 ? `${val}K` : `${val.toFixed(decimals)}K`;
  }
  return num.toString();
}

/**
 * The weight a single tile contributes to a team's score.
 * In 'points' mode it's the tile's configured `points` (default 1); in classic
 * 'tiles' mode every tile is worth 1. This is the one place the two scoring modes
 * diverge — everything else (completion mechanics, blackout detection) is shared.
 */
export function tileWeight(
  scoringMode: string | null | undefined,
  points: number | null | undefined,
): number {
  if (scoringMode === 'points') return points ?? 0;
  return 1;
}

/** True when the event tallies standings by summed point weights rather than tile counts. */
export function isPointsMode(scoringMode: string | null | undefined): boolean {
  return scoringMode === 'points';
}

/**
 * True when the event is the ordered linear "tile race" track rather than a grid.
 * In this format tiles are completed in sequence (sequential lock) and a team's
 * standing is the furthest tile it has reached. Mirrors {@link isPointsMode}.
 */
export function isTileRaceFormat(format: string | null | undefined): boolean {
  return format === 'tilerace';
}

/**
 * Total tiles for an event, accounting for all three shapes:
 *   • classic bingo (bingo + tiles) → a square N×N grid → N²
 *   • Leagues bingo (bingo + points) → an arbitrary task list → N
 *   • tile race (tilerace)           → a linear track       → N
 * `boardSize` is N. Only classic squares it.
 */
export function eventTileCount(
  format: string | null | undefined,
  scoringMode: string | null | undefined,
  boardSize: number,
): number {
  if (isTileRaceFormat(format)) return boardSize;
  if (isPointsMode(scoringMode)) return boardSize;
  return boardSize * boardSize;
}

/** Short mode label for badges/headers. Pass the event's rules JSON to name reveal modes. */
export function eventModeLabel(
  format: string | null | undefined,
  scoringMode: string | null | undefined,
  rules?: string | null,
): string {
  switch (modeKeyFor(format, scoringMode, rules)) {
    case 'race': return 'Tile race';
    case 'showdown': return 'Showdown';
    case 'luckydraw': return 'Lucky draw';
    case 'bounty': return 'Bounty hunt';
    case 'leagues': return 'Leagues';
    default: return 'Bingo';
  }
}

/** Compact shape badge, e.g. "5×5", "Race · 12", "Leagues · 30", "Showdown · 12". */
export function eventShapeBadge(
  format: string | null | undefined,
  scoringMode: string | null | undefined,
  boardSize: number,
  rules?: string | null,
): string {
  const key = modeKeyFor(format, scoringMode, rules);
  if (key === 'classic') return `${boardSize}×${boardSize}`;
  if (key === 'race') return `Race · ${boardSize}`;
  return `${eventModeLabel(format, scoringMode, rules)} · ${boardSize}`;
}

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

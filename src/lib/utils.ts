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

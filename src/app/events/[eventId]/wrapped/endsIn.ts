/** "in 3 days", "in 5 hours", "in 12 minutes", or "soon" for a time ahead of `now`; null once it has passed. */
export function endsInLabel(endMs: number, nowMs: number): string | null {
  const diff = endMs - nowMs;
  if (!Number.isFinite(diff) || diff <= 0) return null;
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'soon';
  if (min < 60) return `in ${min} minute${min === 1 ? '' : 's'}`;
  const hours = Math.round(min / 60);
  if (hours < 48) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `in ${days} days`;
}

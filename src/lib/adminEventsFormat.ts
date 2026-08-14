// Pure formatting for the admin Events list. Split out of lib/adminEventsOverview so the client
// component can import these without dragging `@/db` (and everything it imports) into the browser
// bundle — the queries stay server-only, the number formatting is shared.

/** How many days of submission history the hero sparkline shows. */
export const SPARK_DAYS = 14;

/** Compact gp — 120m, 4.5m, 800k. Matches how prizes are talked about in Discord. */
export function formatGp(gp: number): string {
  if (gp >= 1_000_000_000) return `${trimZero(gp / 1_000_000_000)}b`;
  if (gp >= 1_000_000) return `${trimZero(gp / 1_000_000)}m`;
  if (gp >= 1_000) return `${trimZero(gp / 1_000)}k`;
  return String(gp);
}

function trimZero(n: number): string {
  const s = n.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/**
 * A weekly's gain, in the unit that competition ranks by.
 *
 * Efficiency comps store milli-hours (see lib/efficiency), so they divide down rather than
 * abbreviating like raw xp.
 */
export function formatWeeklyGain(type: string, value: number): string {
  if (type === 'boss') return `${value.toLocaleString()} kc`;
  if (type === 'efficiency') return `${(value / 1000).toFixed(1)} hrs`;
  return `${formatGp(value)} xp`;
}

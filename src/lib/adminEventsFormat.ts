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

/**
 * Read a gp amount the way people actually type it: "50m", "1.5b", "500k", "2 500 000".
 *
 * Prize inputs are the one place in Anvil where somebody has to enter a nine-digit number, and
 * nobody says "fifty million" by counting zeroes. Returns null for anything that isn't a number, so
 * a form can tell "empty" from "nonsense" without a second parse.
 */
export function parseGpInput(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/[\s,_]/g, '');
  if (!s) return null;
  const m = /^(\d+(?:\.\d+)?)([kmb])?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const mult = m[2] === 'b' ? 1_000_000_000 : m[2] === 'm' ? 1_000_000 : m[2] === 'k' ? 1_000 : 1;
  return Math.round(n * mult);
}

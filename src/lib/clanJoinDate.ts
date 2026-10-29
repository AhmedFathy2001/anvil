// When an account joined its clan IN GAME. The roster sync carries it: the plugin reads each
// member's join date off the clan settings and sends how many days ago that was (`joinedDays`),
// which turns back into a calendar date here. Pure.
//
// "Days ago" is counted on the reporting player's own calendar, so two members in different time
// zones can disagree by a day. A stored date only moves when a report differs by MORE than a day —
// a real change, not two clocks — so a steady roster rewrites nothing.

const DAY_MS = 86_400_000;

/** `joinedDays` from a sync → 'YYYY-MM-DD' (UTC), or null when absent or implausible. */
export function joinDateFromDays(joinedDays: unknown, now: Date = new Date()): string | null {
  if (typeof joinedDays !== 'number' || !Number.isInteger(joinedDays) || joinedDays < 0 || joinedDays > 365 * 30) return null;
  return new Date(now.getTime() - joinedDays * DAY_MS).toISOString().slice(0, 10);
}

/** Should a newly reported date replace the stored one? */
export function joinDateChanged(stored: string | null | undefined, reported: string | null): boolean {
  if (!reported) return false;
  if (!stored) return true;
  return Math.abs(Date.parse(`${stored}T00:00:00Z`) - Date.parse(`${reported}T00:00:00Z`)) > DAY_MS;
}

/** "Mar 2024" style, or the full date when `exact`. Input is 'YYYY-MM-DD'. */
export function formatJoinDate(date: string, exact = false): string {
  const d = new Date(`${date}T12:00:00Z`);
  return exact
    ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// Lab-session rules the browser needs too (lib/lab is server-only).

/** How long an ended session is kept for a look back before the sweep deletes it. */
export const LAB_KEEP_DAYS = 7;

/** The lab clan's address. Reserved in lib/clanNames so nobody can found a clan there. Lives here,
 * not in lib/lab, so light readers (the clan switcher) can name it without importing the lab. */
export const LAB_CLAN_SLUG = 'anvil-lab';

/**
 * The Supporter lab's test clanmates (lib/labSupporter) have logins whose Discord id starts with
 * this, which no real Discord id can. Anything counting real people leaves them out by it.
 */
export const LAB_DUMMY_LOGIN = 'lab-dummy-';

/**
 * On a lab board `frozenAt` is NOT a sub-out. The lab pins each participant's stat readings with the
 * bench mechanism (lib/labStats, lib/labTileControls: frozenAt + frozenStats) so the hiscores sweep
 * leaves them alone — so the participant who is actually playing (pushing stats) is exactly the one
 * who gets frozen. Display surfaces read frozenAt as "Subbed out", so strip it from rows before they
 * reach a page on a lab board. Scoring code keeps reading the raw rows; this is for display only.
 * Off a lab board the rows come back untouched (there frozenAt is only ever a real bench/sub-out).
 */
export function withoutLabPins<T extends { frozenAt?: string | null }>(rows: T[], isLab: boolean): T[] {
  if (!isLab) return rows;
  return rows.map((r) => (r.frozenAt ? { ...r, frozenAt: null } : r));
}

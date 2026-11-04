// The /profile person card's folded character list (app/profile/CharacterFold): one compact line per
// character — its seat here, whether it is playing, its total level and XP.
//
// Pure, so the row shape is testable without a database; the read is in lib/characterFoldRead.

import type { HiscoresSnapshot } from '@/lib/hiscores';
import { snapshotFromLiveStats } from '@/lib/liveSnapshot';

export type FoldSeat = 'member' | 'guest' | 'event' | null;

export interface FoldCharacter {
  accountId: number;
  rsn: string;
  isPrimary: boolean;
  /** Its seat in the clan (or space) whose tab this is; null with none. */
  seat: FoldSeat;
  /** Name of a live event it is playing, for the "playing" dot. */
  playingIn: string | null;
  totalLevel: number | null;
  totalXp: number | null;
  /** Last plugin push, for the card's "is this thing on?" dot. */
  lastPingAt: string | null;
  verified: boolean;
}

/** What the row says about the seat — "no seat" is a fact worth showing, not an absence. */
export function seatLabel(seat: FoldSeat, space: boolean): string {
  if (seat === 'member') return 'member here';
  if (seat === 'guest') return 'guest here';
  if (seat === 'event') return space ? 'entered an event' : 'event player';
  return 'no seat';
}

/**
 * Total level and XP off an account's stored stats: the last hiscores snapshot, else what the plugin
 * pushed (the same fallback the profile uses), else the sweep's last observed total XP alone.
 */
export function levelAndXp(row: {
  statsLastSnapshot: string | null;
  liveStats: string | null;
  statsOverallXp: number | null;
}): { totalLevel: number | null; totalXp: number | null } {
  let snapshot: HiscoresSnapshot | null = null;
  if (row.statsLastSnapshot) {
    try {
      snapshot = JSON.parse(row.statsLastSnapshot) as HiscoresSnapshot;
    } catch {
      snapshot = null;
    }
  }
  snapshot ??= snapshotFromLiveStats(row.liveStats);
  const overall = snapshot?.skills?.overall;
  const level = overall && overall.level > 0 ? overall.level : null;
  const xp = overall && overall.xp > 0 ? overall.xp : row.statsOverallXp && row.statsOverallXp > 0 ? row.statsOverallXp : null;
  return { totalLevel: level, totalXp: xp };
}

/** Main first, then by name — the order the card has always listed them in. */
export function sortFold<T extends { isPrimary: boolean; rsn: string }>(rows: readonly T[]): T[] {
  return rows.slice().sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.rsn.localeCompare(b.rsn));
}

/** "13.4M", "250M", "1.2B" — a row's XP at a glance. */
export function compactXp(xp: number): string {
  if (xp >= 1_000_000_000) return `${(xp / 1_000_000_000).toFixed(1)}B`;
  if (xp >= 10_000_000) return `${Math.round(xp / 1_000_000)}M`;
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1_000) return `${Math.round(xp / 1_000)}K`;
  return Math.round(xp).toLocaleString();
}

/** lib/auth normalizeRsn's rule (space and underscore are one character; case-blind), kept pure here. */
function sameRsn(a: string, b: string): boolean {
  const n = (s: string) => s.trim().toLowerCase().replace(/[\s_]+/g, ' ');
  return n(a) === n(b);
}

/**
 * Which character /profile's CHARACTER VIEW is about, from `?account=` — or null for the overview.
 *
 * Only a name that is one of theirs opens it: seated here first, then one this tab holds no seat
 * for, matched by any spelling (space/underscore, case). No `?account=`, an empty one, a typo or
 * somebody else's name is the overview — never a guess at their main, and never anyone else's
 * character (both lists are only theirs).
 */
export function pickViewedCharacter<S extends { rsn: string }, U extends { rsn: string }>(
  wanted: string | null | undefined,
  seated: readonly S[],
  unseated: readonly U[],
): { row: S | U; seated: boolean } | null {
  const w = wanted?.trim();
  if (!w) return null;
  const on = seated.find((s) => sameRsn(s.rsn, w));
  if (on) return { row: on, seated: true };
  const off = unseated.find((o) => sameRsn(o.rsn, w));
  return off ? { row: off, seated: false } : null;
}

/**
 * The page the rest of the world sees for a character: the clan's member page for a seat on a
 * clan's tab, else (a creator space, or no seat here) its public /p/ page.
 */
export function fullProfileHref(c: { rsn: string; seat: FoldSeat }, space: boolean): string {
  const rsn = encodeURIComponent(c.rsn);
  return !space && (c.seat === 'member' || c.seat === 'guest') ? `/members/${rsn}` : `/p/${rsn}`;
}

/**
 * Where a row in the fold goes: `?account=<rsn>`, KEEPING the tab the page is on — the same tab of
 * another character is the useful comparison — and dropping the picks inside it (`stat`, `page`,
 * `progress`), which name things the other character may not have.
 */
export function foldHref(rsn: string, current: { get(key: string): string | null } | null): string {
  const q = new URLSearchParams();
  q.set('account', rsn);
  const tab = current?.get('tab');
  if (tab) q.set('tab', tab);
  return `/profile?${q.toString().replace(/\+/g, '%20')}`;
}

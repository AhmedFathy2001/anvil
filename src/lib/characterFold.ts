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

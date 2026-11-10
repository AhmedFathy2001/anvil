// The members table's sort (app/members/MembersDirectory). Pure, so it can run in the browser on the
// list the page already sent, and be tested without one.

import type { MemberListRow, RosterMovement } from '@/lib/memberProfile';
import { normalizeRank } from '@/lib/rankRules';

export type MemberSortKey = 'name' | 'rank' | 'week' | 'streak' | 'ehp' | 'ehb' | 'xp';

export interface MemberSort {
  key: MemberSortKey;
  /** Highest (or most senior, or Z) first. */
  desc: boolean;
  movement: Record<number, Pick<RosterMovement, 'week'>>;
  /** Ranks most senior first (lib/rankRules effectiveRankOrder). */
  rankOrder: string[];
  /** Weekly activity streak by name (lib/activityStreaks); missing = none. */
  streaks?: Record<string, number>;
}

type Row = Pick<MemberListRow, 'id' | 'rsn' | 'rank' | 'isGuest' | 'ehp' | 'ehb' | 'overallXp'>;

/**
 * Sorted copy. Unknowns — a member not swept yet, a guest or a rank the ladder doesn't hold when
 * sorting by rank — go last in BOTH directions: unknown is not "lowest", and flipping the order
 * shouldn't float them to the top. Ties go to the busier player (EHP), then by name.
 */
export function sortMembers<T extends Row>(rows: T[], s: MemberSort): T[] {
  const byName = (a: T, b: T) => a.rsn.localeCompare(b.rsn);
  if (s.key === 'name') return [...rows].sort((a, b) => (s.desc ? byName(b, a) : byName(a, b)));
  const seniority = new Map(s.rankOrder.map((r, i) => [r, s.rankOrder.length - i]));
  const value = (m: T): number | null => {
    switch (s.key) {
      case 'rank': {
        if (m.isGuest) return null;
        const k = normalizeRank(m.rank);
        return k ? seniority.get(k) ?? null : null;
      }
      case 'week':
        return s.movement[m.id]?.week ?? 0;
      case 'streak':
        return s.streaks?.[m.rsn] ?? 0;
      case 'ehp':
        return m.ehp;
      case 'ehb':
        return m.ehb;
      default:
        return m.overallXp;
    }
  };
  const dir = s.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb === null) return byName(a, b);
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va !== vb) return dir * (va - vb);
    const ta = a.ehp ?? -1;
    const tb = b.ehp ?? -1;
    return ta !== tb ? tb - ta : byName(a, b);
  });
}

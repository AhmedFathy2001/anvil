// A clan's "Moments" (lib/clanMoments): what its members did lately that is worth a tile on its public
// page — a pet, a new collection-log slot, a 99, a max. The rules, pure: which label a moment wears
// and which one leads the wall. Tested in tests/clan-moments.

import { SKILLS } from '@/lib/constants';

export interface Moment {
  rsn: string;
  /** "unlocked Tumeken's shadow at 412 KC" / "hit 99 Slayer". */
  text: string;
  iconUrl: string | null;
  /** ISO time it was seen. */
  at: string;
  /** The short tag over the tile. */
  tag: string;
  /** How much it deserves the big tile: higher leads. */
  weight: number;
}

export type MomentSource =
  | { kind: 'clog'; pageName: string }
  | { kind: 'milestone'; milestone: string; threshold: number };

/** The total level of a maxed account: every skill at 99, counted from the skill list so a new skill moves it. */
export const MAX_TOTAL = SKILLS.filter((s) => s !== 'overall').length * 99;

/** The tag and weight for one source row. */
export function momentLabel(src: MomentSource): { tag: string; weight: number } {
  if (src.kind === 'clog') {
    if (src.pageName === 'All Pets') return { tag: 'Pet', weight: 100 };
    return { tag: 'New log slot', weight: 60 };
  }
  switch (src.milestone) {
    case 'total':
      return src.threshold >= MAX_TOTAL ? { tag: 'Maxed', weight: 90 } : { tag: 'Total level', weight: 30 };
    case 'level':
      return { tag: src.threshold >= 99 ? 'Level 99' : 'Level', weight: src.threshold >= 99 ? 70 : 20 };
    case 'kc':
      return { tag: 'Kill count', weight: 40 };
    case 'xp':
    case 'totalxp':
      return { tag: 'XP milestone', weight: 35 };
    case 'ehp':
    case 'ehb':
      return { tag: 'Efficiency', weight: 30 };
    default:
      return { tag: 'Milestone', weight: 10 };
  }
}

/**
 * The wall's order: the weightiest of the last few days leads (it gets the big tile), then the rest
 * newest first. One member never fills the wall: at most `perPerson` of anyone's.
 */
export function orderMoments(all: Moment[], limit = 9, perPerson = 3): Moment[] {
  const byNew = [...all].sort((a, b) => b.at.localeCompare(a.at));
  const seen = new Map<string, number>();
  const kept: Moment[] = [];
  for (const m of byNew) {
    const n = seen.get(m.rsn) ?? 0;
    if (n >= perPerson) continue;
    seen.set(m.rsn, n + 1);
    kept.push(m);
  }
  if (kept.length === 0) return [];
  let lead = 0;
  for (let i = 1; i < kept.length; i++) if (kept[i].weight > kept[lead].weight) lead = i;
  return [kept[lead], ...kept.filter((_, i) => i !== lead)].slice(0, limit);
}

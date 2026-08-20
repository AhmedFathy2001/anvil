/**
 * What KIND of player someone is, drawn against their own clan.
 *
 * Deliberately not a power score. A single "how strong is this person" number turns into a league
 * table, reads badly for anyone newer, and answers a question nobody actually has — a captain
 * picking a roster wants to know that someone is bossing-heavy and barely skills, which is a shape,
 * not a rank. So this is six axes, each a PERCENTILE within the clan, because an absolute XP number
 * means nothing at a glance and "ahead of 80% of the clan at bossing" means something instantly.
 *
 * Every axis comes from data the roster already keeps clan-wide and cheaply: the newest daily row
 * (EHP/EHB/XP) and the derived activity blob (clues, minigames, collection log). Nothing here parses
 * a hiscores snapshot — a profile view that did would read megabytes on a 400-member clan, which is
 * exactly what those derived columns exist to avoid.
 *
 * Pure: the caller loads, this shapes.
 */

export const SHAPE_AXES = [
  { key: 'skilling', label: 'Skilling' },
  { key: 'bossing', label: 'Bossing' },
  { key: 'experience', label: 'Total XP' },
  { key: 'clues', label: 'Clues' },
  { key: 'minigames', label: 'Minigames' },
  { key: 'collection', label: 'Collection' },
] as const;

export type ShapeAxisKey = (typeof SHAPE_AXES)[number]['key'];

export interface ShapeAxis {
  key: ShapeAxisKey;
  label: string;
  /** 0–100. Their standing among everyone the clan has numbers for. Null = nothing to place them by. */
  pct: number | null;
  /** "#3 of 41", when the axis came from a clan placing rather than a raw value. */
  standing: { position: number; of: number } | null;
}

export interface PlayerShape {
  axes: ShapeAxis[];
  /** How many members the percentiles are taken over — the honest denominator for "top 10%". */
  tracked: number;
  /** True when nothing could be placed at all: a member the sweep has never seen. */
  empty: boolean;
}

/**
 * Where `value` sits in `values`, as 0–100.
 *
 * Midpoint of the tie block rather than "strictly below", so ten members on zero all read 50 for
 * that axis instead of every one of them reading 100 — which is what "nobody has done any of this"
 * should look like: the middle of a crowd, not the top of one.
 */
export function percentileOf(values: number[], value: number): number | null {
  if (values.length === 0) return null;
  let below = 0;
  let equal = 0;
  for (const v of values) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  return Math.round(((below + equal / 2) / values.length) * 100);
}

/**
 * A clan placing ("#3 of 41") as a percentile, where #1 is 100.
 *
 * `of` is however many members have that activity at all — someone placed third of three is not in
 * the same position as third of three hundred, and a single-entrant board is not a 100th percentile
 * so much as an empty one.
 */
export function percentileFromRank(position: number, of: number): number | null {
  if (!Number.isFinite(position) || !Number.isFinite(of) || of <= 0 || position <= 0) return null;
  if (of === 1) return null;
  return Math.round(((of - position) / (of - 1)) * 100);
}

/** The activity keys each activity-backed axis reads, best placing wins. */
const AXIS_ACTIVITIES: Partial<Record<ShapeAxisKey, string[]>> = {
  clues: ['cluesAll'],
  // Whichever minigame they actually play: someone with 8k zeal and no rifts is a minigame player.
  minigames: ['riftsClosed', 'soulWarsZeal', 'lastManStanding', 'pvpArena'],
  collection: ['collectionsLogged'],
};

export interface ShapeInputs {
  /** Everyone the clan has totals for, including the subject. */
  members: { id: number; ehpMilli: number; ehbMilli: number; overallXp: number }[];
  /** The subject's clan placings by activity key (lib/memberProfile#getActivityStandings). */
  standings: Record<string, { position: number; of: number }>;
  memberId: number;
}

export function buildPlayerShape({ members, standings, memberId }: ShapeInputs): PlayerShape {
  const me = members.find((m) => m.id === memberId) ?? null;
  const tracked = members.length;

  const numeric = (pick: (m: ShapeInputs['members'][number]) => number): number | null => {
    if (!me || tracked === 0) return null;
    return percentileOf(members.map(pick), pick(me));
  };

  const axes: ShapeAxis[] = SHAPE_AXES.map((axis) => {
    const keys = AXIS_ACTIVITIES[axis.key];
    if (keys) {
      // Best placing across the axis's activities — their strongest claim to it.
      let best: { position: number; of: number } | null = null;
      let bestPct: number | null = null;
      for (const key of keys) {
        const standing = standings[key];
        if (!standing) continue;
        const pct = percentileFromRank(standing.position, standing.of);
        if (pct == null) continue;
        if (bestPct == null || pct > bestPct) {
          bestPct = pct;
          best = standing;
        }
      }
      return { key: axis.key, label: axis.label, pct: bestPct, standing: best };
    }
    const pct =
      axis.key === 'skilling'
        ? numeric((m) => m.ehpMilli)
        : axis.key === 'bossing'
          ? numeric((m) => m.ehbMilli)
          : numeric((m) => m.overallXp);
    return { key: axis.key, label: axis.label, pct, standing: null };
  });

  return { axes, tracked, empty: axes.every((a) => a.pct == null) };
}

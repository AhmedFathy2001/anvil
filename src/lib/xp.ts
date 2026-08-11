// The OSRS experience curve, and the two questions worth asking of it: what level is this XP, and
// how far to the next milestone.
//
// Generated rather than typed out: each level costs floor(L + 300 * 2^(L/7)) / 4 more than the last,
// which is the actual formula Jagex uses — a hard-coded table is 126 numbers nobody can verify by
// reading.

const MAX_LEVEL = 126; // virtual levels; skills cap at 99 but the curve keeps going to 200m
export const XP_AT_99 = 13_034_431;
export const MAX_XP = 200_000_000;

/** Cumulative XP required for each level, indexed by level (XP_TABLE[1] === 0). */
export const XP_TABLE: number[] = (() => {
  const table = [0, 0];
  let points = 0;
  for (let level = 1; level < MAX_LEVEL; level++) {
    points += Math.floor(level + 300 * Math.pow(2, level / 7));
    table[level + 1] = Math.floor(points / 4);
  }
  return table;
})();

/** Level for a given XP, capped at 99 — the level the hiscores would report. */
export function levelFromXp(xp: number): number {
  for (let level = 99; level >= 1; level--) {
    if (xp >= XP_TABLE[level]) return level;
  }
  return 1;
}

export interface LevelProgress {
  level: number;
  /** 0-1 through the current level. 1 when already at the target. */
  progress: number;
  xpToNext: number;
}

/**
 * How far through the climb to `target` this XP is. Used for the "nearest 99s" rings, where the
 * honest measure is XP remaining rather than levels remaining — 98 to 99 is a seventh of the whole
 * skill, so counting levels would put someone at 98 and someone at 92 in the same neighbourhood.
 */
export function progressToLevel(xp: number, target = 99): LevelProgress {
  const level = levelFromXp(xp);
  if (level >= target) return { level, progress: 1, xpToNext: 0 };
  const floorXp = XP_TABLE[level];
  const targetXp = XP_TABLE[target];
  const span = targetXp - floorXp;
  return {
    level,
    progress: span > 0 ? Math.min(1, Math.max(0, (xp - floorXp) / span)) : 0,
    xpToNext: Math.max(0, targetXp - xp),
  };
}

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
  /** 0-1 of the whole climb to the target, by XP. 1 when already there. */
  progress: number;
  xpToNext: number;
}

/**
 * How far this XP is toward `target`, as a share of the WHOLE climb from zero — not of the current
 * level band.
 *
 * The band version reads as almost-zero for anyone who just levelled: someone at 94 with 5M banked
 * showed an empty ring, because they were at the start of the 94→99 stretch. Measuring against the
 * total is what makes "86% of the way to 99 Farming" mean what a player expects, and it's the same
 * basis every other OSRS tool uses.
 */
export function progressToLevel(xp: number, target = 99): LevelProgress {
  const level = levelFromXp(xp);
  const targetXp = XP_TABLE[target];
  if (xp >= targetXp) return { level, progress: 1, xpToNext: 0 };
  return {
    level,
    progress: targetXp > 0 ? Math.min(1, Math.max(0, xp / targetXp)) : 0,
    xpToNext: Math.max(0, targetXp - xp),
  };
}

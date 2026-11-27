import { isRaidFamily, type RaidFamily } from '@/lib/raidNpcs';

// Where a moment happened, kept for analytics (deaths by place, drops by raid mode and level): the
// map region the plugin stood in for any death or drop, and inside a raid which raid, its mode, the
// Tombs raid level and the party size, all read off the game by the plugin (AnvilPlugin raidHere).
//
// Never trusted for scoring beyond what lib/deathSource already allows; it only describes the moment.
// Pure: the moments route and the tests read it.

export type RaidMode = 'entry' | 'normal' | 'hard' | 'cm' | 'expert';

export interface MomentPlace {
  /** The game's map region id (x >> 6 << 8 | y >> 6), or null. */
  regionId: number | null;
  raid: RaidFamily | null;
  raidMode: RaidMode | null;
  /** Tombs of Amascut raid level (0-600), else null. */
  raidLevel: number | null;
  partySize: number | null;
}

const MODES: Record<RaidFamily, readonly RaidMode[]> = {
  cox: ['normal', 'cm'],
  tob: ['entry', 'normal', 'hard'],
  toa: ['entry', 'normal', 'expert'],
};

/** Tombs mode by raid level, as the game names it: Entry below 150, Expert from 300. */
export function toaModeOf(level: number): RaidMode {
  return level < 150 ? 'entry' : level < 300 ? 'normal' : 'expert';
}

const int = (v: unknown, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : null;

/**
 * The place a pushed moment describes. `raid` is the death's settled tag (lib/deathSource) or the
 * client's for other kinds: "cox" | "tob" | "toa", or an Entry Mode's "toa-entry" / "tob-entry".
 */
export function momentPlace(raw: Record<string, unknown>): MomentPlace {
  const tag = typeof raw.raid === 'string' ? raw.raid : null;
  const entry = tag === 'toa-entry' || tag === 'tob-entry';
  const family = entry ? (tag!.slice(0, 3) as RaidFamily) : isRaidFamily(tag) ? tag : null;
  const level = family === 'toa' ? int(raw.raidLevel, 600) : null;
  const sent = typeof raw.raidMode === 'string' && family && MODES[family].includes(raw.raidMode as RaidMode) ? (raw.raidMode as RaidMode) : null;
  const raidMode = !family ? null : level != null ? toaModeOf(level) : entry ? 'entry' : sent;
  return {
    regionId: int(raw.regionId, 65_535),
    raid: family,
    raidMode,
    raidLevel: level,
    partySize: family ? int(raw.party, 100) : null,
  };
}

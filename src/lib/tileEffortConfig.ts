export const RAID_EFFORT_MODES = [
  { key: 'chambersOfXeric', label: 'Chambers of Xeric' },
  { key: 'chambersOfXericChallengeMode', label: 'Chambers of Xeric — Challenge Mode' },
  { key: 'theatreOfBlood', label: 'Theatre of Blood — Normal' },
  { key: 'theatreOfBloodHardMode', label: 'Theatre of Blood — Hard Mode' },
  { key: 'tombsOfAmascut', label: 'Tombs of Amascut — Normal / Entry' },
  { key: 'tombsOfAmascutExpertMode', label: 'Tombs of Amascut — Expert' },
] as const;

export type RaidEffortMode = (typeof RAID_EFFORT_MODES)[number]['key'];

export interface TileRaidEffortConfig {
  /** Raid table/mode used by balancing, independent of plugin source matching. */
  mode: RaidEffortMode;
  /** Personal chance of any unique, expressed as 1 in N after raid context/team allocation. */
  uniqueDenominator?: number | null;
  /** Expected minutes per completed raid, including the time cost of failed attempts. */
  completionMinutes?: number | null;
  /** Optional author-facing context; informational until a formula-backed ToA model is selected. */
  raidLevel?: number | null;
}

export interface TileEffortConfig {
  /** Execution premium: 0–5, adding 0–25% after expected time/failures. */
  skillRating?: number | null;
  /** Average person-hours to finish, including setup and failed attempts; overrides rough models. */
  expectedHours?: number | null;
  raid?: TileRaidEffortConfig | null;
}

const RAID_MODE_KEYS = new Set<string>(RAID_EFFORT_MODES.map((m) => m.key));

export function isRaidEffortMode(value: unknown): value is RaidEffortMode {
  return typeof value === 'string' && RAID_MODE_KEYS.has(value);
}

/** Defensive reader for persisted/admin-authored JSON. Invalid fields fall back individually. */
export function parseTileEffortConfig(raw: unknown): TileEffortConfig | null {
  let value = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return null;
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const out: TileEffortConfig = {};
  if (Number.isInteger(input.skillRating) && (input.skillRating as number) >= 0 && (input.skillRating as number) <= 5) {
    out.skillRating = input.skillRating as number;
  }
  const expectedHours = typeof input.expectedHours === 'number' ? input.expectedHours : Number(input.expectedHours);
  if (Number.isFinite(expectedHours) && expectedHours > 0 && expectedHours <= 100_000) {
    out.expectedHours = expectedHours;
  }
  if (input.raid && typeof input.raid === 'object' && !Array.isArray(input.raid)) {
    const raid = input.raid as Record<string, unknown>;
    if (isRaidEffortMode(raid.mode)) {
      out.raid = { mode: raid.mode };
      const unique = typeof raid.uniqueDenominator === 'number' ? raid.uniqueDenominator : Number(raid.uniqueDenominator);
      if (Number.isFinite(unique) && unique > 1 && unique <= 1_000_000) out.raid.uniqueDenominator = unique;
      const minutes = typeof raid.completionMinutes === 'number' ? raid.completionMinutes : Number(raid.completionMinutes);
      if (Number.isFinite(minutes) && minutes > 0 && minutes <= 1_440) out.raid.completionMinutes = minutes;
      const level = typeof raid.raidLevel === 'number' ? raid.raidLevel : Number(raid.raidLevel);
      if (Number.isInteger(level) && level >= 0 && level <= 1_000) out.raid.raidLevel = level;
    }
  }
  return out.skillRating != null || out.expectedHours != null || out.raid ? out : null;
}

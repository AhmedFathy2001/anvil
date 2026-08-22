// The hiscores entries that aren't skills and aren't bosses.
//
// Every snapshot we fetch already contains these — clue counts, GOTR rifts, Bounty Hunter, LMS,
// Soul Wars, Colosseum glory, collection-log slots — because one hiscores read returns the whole
// account. They were simply never readable as tile stats: snapshotValue only knew `skills[key].xp`
// and `bosses[key].score`, so "close 100 rifts" or "20 elite clues" silently tracked zero forever.
//
// The awkward part is that they don't live in one place. Bosses are a flat map, but clues nest under
// `clues[tier]` and Bounty Hunter under `bountyHunter[mode]`, so each entry carries the PATH to its
// own number rather than the reader guessing.
//
// Deliberately imports nothing — it's unit-tested directly (tests/hiscores-activities.test.ts), and
// the snapshot is read structurally so this file never depends on the hiscores library's types.

/**
 * How an activity is displayed and compared.
 *
 * `count` entries are a tally that only goes up, so more is better and two members can be ranked
 * against each other. `rank` entries are a hiscores POSITION, where 1 is the best score in the game
 * and "unranked" is worse than any number — ordering those like counts would put the clan's best PKer
 * last. Nothing outside the display layer needs the distinction, which is why tiles have never had it.
 */
export type ActivityScale = 'count' | 'rank';

/** Display grouping, so a profile doesn't list clue tiers next to Bounty Hunter. */
export type ActivityGroup = 'clues' | 'minigames' | 'collection';

export interface ActivityOption {
  /** Stable key stored in tiles.trackedStat. Never reuse or rename one — boards depend on it. */
  key: string;
  label: string;
  /** Where the number lives in a snapshot: ['riftsClosed'] or ['clues','hard']. */
  path: [string] | [string, string];
  /** Extra search terms players actually type. */
  aliases?: string[];
  /** What one unit means, for tile copy: "100 rifts closed". */
  unit?: string;
  group: ActivityGroup;
  scale: ActivityScale;
  /** Shown instead of the full label where the row is already grouped ("Elite" under Clues). */
  shortLabel?: string;
}

export const HISCORES_ACTIVITIES: ActivityOption[] = [
  // ── Skilling / minigames ────────────────────────────────────────────────────────────────────
  {
    key: 'riftsClosed',
    label: 'Guardians of the Rift',
    path: ['riftsClosed'],
    aliases: ['gotr', 'rift', 'rifts', 'guardians'],
    unit: 'rifts',
    group: 'minigames',
    scale: 'count',
  },
  { key: 'soulWarsZeal', label: 'Soul Wars Zeal', path: ['soulWarsZeal'], aliases: ['soul wars', 'zeal'], unit: 'zeal', group: 'minigames', scale: 'count' },
  { key: 'lastManStanding', label: 'LMS Rank', path: ['lastManStanding'], aliases: ['lms', 'last man standing'], group: 'minigames', scale: 'rank' },
  { key: 'pvpArena', label: 'PvP Arena Rank', path: ['pvpArena'], aliases: ['pvp arena', 'arena'], group: 'minigames', scale: 'rank' },
  {
    key: 'colosseumGlory',
    label: 'Colosseum Glory',
    path: ['colosseumGlory'],
    aliases: ['glory', 'fortis colosseum'],
    unit: 'glory',
    group: 'minigames',
    scale: 'count',
  },
  {
    key: 'collectionsLogged',
    label: 'Collection Log Slots',
    path: ['collectionsLogged'],
    aliases: ['clog', 'collection log', 'collections'],
    unit: 'slots',
    group: 'collection',
    scale: 'count',
  },

  // ── Clue scrolls ────────────────────────────────────────────────────────────────────────────
  // Each tier is its own counter, plus `all` for the total. A tile that says "50 hard clues" must
  // mean hard specifically, so the tiers are separate keys rather than one clue counter.
  { key: 'cluesAll', label: 'Clues (all)', shortLabel: 'All tiers', path: ['clues', 'all'], aliases: ['clue', 'clues', 'caskets'], unit: 'clues', group: 'clues', scale: 'count' },
  { key: 'cluesBeginner', label: 'Clues (beginner)', shortLabel: 'Beginner', path: ['clues', 'beginner'], aliases: ['beginner clues'], unit: 'clues', group: 'clues', scale: 'count' },
  { key: 'cluesEasy', label: 'Clues (easy)', shortLabel: 'Easy', path: ['clues', 'easy'], aliases: ['easy clues'], unit: 'clues', group: 'clues', scale: 'count' },
  { key: 'cluesMedium', label: 'Clues (medium)', shortLabel: 'Medium', path: ['clues', 'medium'], aliases: ['medium clues'], unit: 'clues', group: 'clues', scale: 'count' },
  { key: 'cluesHard', label: 'Clues (hard)', shortLabel: 'Hard', path: ['clues', 'hard'], aliases: ['hard clues'], unit: 'clues', group: 'clues', scale: 'count' },
  { key: 'cluesElite', label: 'Clues (elite)', shortLabel: 'Elite', path: ['clues', 'elite'], aliases: ['elite clues'], unit: 'clues', group: 'clues', scale: 'count' },
  { key: 'cluesMaster', label: 'Clues (master)', shortLabel: 'Master', path: ['clues', 'master'], aliases: ['master clues'], unit: 'clues', group: 'clues', scale: 'count' },

  // ── Bounty Hunter ───────────────────────────────────────────────────────────────────────────
  // V2 is the current game's counter; the legacy pair is kept because old accounts still carry it.
  { key: 'bhHunter', label: 'Bounty Hunter (hunter)', path: ['bountyHunter', 'hunterV2'], aliases: ['bh', 'bounty hunter'], group: 'minigames', scale: 'rank' },
  { key: 'bhRogue', label: 'Bounty Hunter (rogue)', path: ['bountyHunter', 'rogueV2'], aliases: ['bh rogue'], group: 'minigames', scale: 'rank' },
  { key: 'bhHunterLegacy', label: 'Bounty Hunter (hunter, legacy)', path: ['bountyHunter', 'hunter'], group: 'minigames', scale: 'rank' },
  { key: 'bhRogueLegacy', label: 'Bounty Hunter (rogue, legacy)', path: ['bountyHunter', 'rogue'], group: 'minigames', scale: 'rank' },
];

const BY_KEY = new Map(HISCORES_ACTIVITIES.map((a) => [a.key, a]));

/** The activity for a tracked-stat key, or null when the key isn't one (a boss or a skill). */
export function activityFor(key: string | null | undefined): ActivityOption | null {
  if (!key) return null;
  return BY_KEY.get(key.trim()) ?? null;
}

export function isActivityKey(key: string | null | undefined): boolean {
  return activityFor(key) != null;
}

/**
 * Read an activity's score out of a snapshot, following its path.
 *
 * Hiscores reports -1 for "unranked" — meaning the player has none, or too few to chart — so it
 * floors to 0. Without that, a member who hasn't touched GOTR would show a *negative* score and any
 * gain calculation against them would be off by one.
 */
export function readActivityScore(snapshot: unknown, key: string | null | undefined): number {
  const activity = activityFor(key);
  if (!activity || !snapshot || typeof snapshot !== 'object') return 0;

  let node: unknown = snapshot;
  for (const step of activity.path) {
    if (!node || typeof node !== 'object') return 0;
    node = (node as Record<string, unknown>)[step];
  }
  if (!node || typeof node !== 'object') return 0;
  const score = Number((node as { score?: unknown }).score ?? 0);
  return Number.isFinite(score) && score > 0 ? score : 0;
}

/**
 * The player's position on the hiscores for one activity, or null when unranked.
 *
 * Kept separate from the score because it means the opposite thing: a rank of 1 is the best in the
 * game, so it must never be summed, compared as "higher is better", or floored to 0 the way a score
 * is. Display-only — nothing that scores a tile reads a rank.
 */
export function readActivityRank(snapshot: unknown, key: string | null | undefined): number | null {
  const activity = activityFor(key);
  if (!activity || !snapshot || typeof snapshot !== 'object') return null;

  let node: unknown = snapshot;
  for (const step of activity.path) {
    if (!node || typeof node !== 'object') return null;
    node = (node as Record<string, unknown>)[step];
  }
  if (!node || typeof node !== 'object') return null;
  const rank = Number((node as { rank?: unknown }).rank ?? -1);
  return Number.isFinite(rank) && rank > 0 ? rank : null;
}

/** One activity's numbers as stored and displayed. `rank` is the hiscores position, not a clan one. */
export interface ActivityReading {
  score: number;
  rank: number | null;
}

/**
 * Every activity a snapshot actually has, as a compact map.
 *
 * Zero-score entries are omitted rather than stored as 0 so the blob stays a few hundred bytes for a
 * normal account — this is written per member on every sweep that changes anything, and the whole
 * point of storing it separately is that reading the roster mustn't mean parsing full snapshots.
 * A rank-scaled entry with no score (LMS, where the score IS the rating) is kept when it has a rank,
 * since "unranked" and "ranked but zero" are different facts there.
 */
export function readAllActivities(snapshot: unknown): Record<string, ActivityReading> {
  const out: Record<string, ActivityReading> = {};
  if (!snapshot || typeof snapshot !== 'object') return out;
  for (const activity of HISCORES_ACTIVITIES) {
    const score = readActivityScore(snapshot, activity.key);
    const rank = readActivityRank(snapshot, activity.key);
    if (score > 0 || rank != null) {
      out[activity.key] = { score, rank };
    }
  }
  return out;
}

/** Parse a stored activity blob. Returns {} on null/malformed so a bad row is empty, never a crash. */
export function parseActivityBlob(json: string | null | undefined): Record<string, ActivityReading> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as Record<string, ActivityReading>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

/** The activities in one display group, in declaration order. */
export function activitiesInGroup(group: ActivityGroup): ActivityOption[] {
  return HISCORES_ACTIVITIES.filter((a) => a.group === group);
}

/** The six real clue tiers, hardest last. Excludes `cluesAll`, which is their sum, not a tier. */
export const CLUE_TIER_KEYS = [
  'cluesBeginner',
  'cluesEasy',
  'cluesMedium',
  'cluesHard',
  'cluesElite',
  'cluesMaster',
] as const;

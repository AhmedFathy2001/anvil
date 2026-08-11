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
}

export const HISCORES_ACTIVITIES: ActivityOption[] = [
  // ── Skilling / minigames ────────────────────────────────────────────────────────────────────
  {
    key: 'riftsClosed',
    label: 'Guardians of the Rift',
    path: ['riftsClosed'],
    aliases: ['gotr', 'rift', 'rifts', 'guardians'],
    unit: 'rifts',
  },
  { key: 'soulWarsZeal', label: 'Soul Wars Zeal', path: ['soulWarsZeal'], aliases: ['soul wars', 'zeal'], unit: 'zeal' },
  { key: 'lastManStanding', label: 'LMS Rank', path: ['lastManStanding'], aliases: ['lms', 'last man standing'] },
  { key: 'pvpArena', label: 'PvP Arena Rank', path: ['pvpArena'], aliases: ['pvp arena', 'arena'] },
  {
    key: 'colosseumGlory',
    label: 'Colosseum Glory',
    path: ['colosseumGlory'],
    aliases: ['glory', 'fortis colosseum'],
    unit: 'glory',
  },
  {
    key: 'collectionsLogged',
    label: 'Collection Log Slots',
    path: ['collectionsLogged'],
    aliases: ['clog', 'collection log', 'collections'],
    unit: 'slots',
  },

  // ── Clue scrolls ────────────────────────────────────────────────────────────────────────────
  // Each tier is its own counter, plus `all` for the total. A tile that says "50 hard clues" must
  // mean hard specifically, so the tiers are separate keys rather than one clue counter.
  { key: 'cluesAll', label: 'Clues (all)', path: ['clues', 'all'], aliases: ['clue', 'clues', 'caskets'], unit: 'clues' },
  { key: 'cluesBeginner', label: 'Clues (beginner)', path: ['clues', 'beginner'], aliases: ['beginner clues'], unit: 'clues' },
  { key: 'cluesEasy', label: 'Clues (easy)', path: ['clues', 'easy'], aliases: ['easy clues'], unit: 'clues' },
  { key: 'cluesMedium', label: 'Clues (medium)', path: ['clues', 'medium'], aliases: ['medium clues'], unit: 'clues' },
  { key: 'cluesHard', label: 'Clues (hard)', path: ['clues', 'hard'], aliases: ['hard clues'], unit: 'clues' },
  { key: 'cluesElite', label: 'Clues (elite)', path: ['clues', 'elite'], aliases: ['elite clues'], unit: 'clues' },
  { key: 'cluesMaster', label: 'Clues (master)', path: ['clues', 'master'], aliases: ['master clues'], unit: 'clues' },

  // ── Bounty Hunter ───────────────────────────────────────────────────────────────────────────
  // V2 is the current game's counter; the legacy pair is kept because old accounts still carry it.
  { key: 'bhHunter', label: 'Bounty Hunter (hunter)', path: ['bountyHunter', 'hunterV2'], aliases: ['bh', 'bounty hunter'] },
  { key: 'bhRogue', label: 'Bounty Hunter (rogue)', path: ['bountyHunter', 'rogueV2'], aliases: ['bh rogue'] },
  { key: 'bhHunterLegacy', label: 'Bounty Hunter (hunter, legacy)', path: ['bountyHunter', 'hunter'] },
  { key: 'bhRogueLegacy', label: 'Bounty Hunter (rogue, legacy)', path: ['bountyHunter', 'rogue'] },
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

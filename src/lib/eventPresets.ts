import type { EventMode } from './eventModes';
import type { TileCsvRow } from './csvTiles';
import seed from '@/data/tileLibrarySeed.json';

// A ready-made starting point for a new event. A preset pre-fills the mode + size (and,
// later, a starter tile pack via `tileLabels`) so a non-technical officer can go from
// "make a bingo" to a configured board in one click instead of learning the mode/size
// jargon. Built-ins below; custom (save-your-own) presets reuse this same shape.
export interface EventPreset {
  key: string;
  label: string;
  blurb: string;
  emoji: string;
  mode: EventMode;
  size: number;
  /** Optional starter tiles — one blank, auto-named tile per label. */
  tileLabels?: string[];
  /** True for user-saved presets (vs the built-ins below). */
  custom?: boolean;
  /** DB id for a saved preset — enables the delete affordance. */
  id?: number;
  /** Full captured tile config for a saved preset (fed through the CSV import pipeline). */
  csv?: { rows: TileCsvRow[]; labels: string[] } | null;
}

// ── Starter boards ───────────────────────────────────────────────────────────────────────────────
// Ready-to-run boards, every tile already set up to track, picked from the seeded task library
// (src/data/tileLibrarySeed.json) by key. Writing 25 tiles from nothing was the longest part of a
// first bingo, and the "templates" here were only grid sizes. Keys must exist in the seed;
// tests/event-presets.test.ts holds them to it.

interface SeedTask {
  key: string;
  label: string;
  category?: string;
  points: number;
  config: TileCsvRow;
}
const SEED = new Map((seed as { tasks: SeedTask[] }).tasks.map((t) => [t.key, t]));

export const STARTER_BOARDS: Record<string, string[]> = {
  mixed: [
    'kc-barrows-20', 'drop-barrows-piece', 'kc-wintertodt-25', 'kc-tempoross-25', 'kc-zalcano-15',
    'drop-dragon-boots', 'drop-abyssal-whip', 'kc-zulrah-25', 'kc-vorkath-25', 'kc-cerberus-25',
    'xp-fishing-500k', 'xp-slayer-500k', 'xp-agility-300k', 'kc-gwd-50', 'drop-occult-necklace',
    'drop-dragon-pickaxe', 'drop-tanzanite-fang', 'drop-magic-fang', 'drop-serpentine-visage', 'kc-cox-5',
    'kc-toa-5', 'drop-bandos-tassets', 'drop-zenyte-shard', 'drop-armadyl-set', 'diary-any-hard',
  ],
  casual: [
    'troll-rubber-chicken', 'troll-chicken-kills', 'troll-clue-beginner', 'troll-swamp-tar', 'drop-rune-boots',
    'drop-mystic-piece', 'drop-dragon-boots', 'drop-barrows-piece', 'kc-wintertodt-25', 'kc-tempoross-25',
    'drop-dragon-med-helm', 'kc-zalcano-15', 'kc-barrows-20', 'drop-abyssal-whip', 'kc-zulrah-25',
    'xp-fishing-500k', 'diary-any-hard', 'xp-slayer-500k', 'xp-agility-300k', 'xp-any-1m',
    'xp-runecraft-250k', 'kc-gwd-50', 'kc-cerberus-25', 'kc-vorkath-25', 'drop-occult-necklace',
  ],
  endgame: [
    'kc-cox-5', 'kc-toa-5', 'kc-tob-5', 'timed-cox-sub40', 'timed-fight-caves',
    'drop-dex-prayer-scroll', 'drop-osmumtens-fang', 'drop-justiciar-piece', 'drop-bandos-chestplate', 'drop-bandos-tassets',
    'drop-bandos-hilt', 'drop-armadyl-hilt', 'drop-saradomin-hilt', 'drop-zamorak-hilt', 'drop-avernic-hilt',
    'drop-masori-piece', 'drop-zenyte-shard', 'drop-dragon-warhammer', 'drop-draconic-visage', 'drop-imbued-heart',
    'drop-eternal-gem', 'drop-elder-maul', 'drop-kodai-insignia', 'kc-hydra-25', 'kc-corp-10',
  ],
};

/**
 * A starter board's rows, laid out so easy and hard tasks are spread over the grid rather than
 * stacked in the top rows: sorted by points, then dealt out with a stride that visits every square
 * once (7 is coprime with 25), so every row, column and diagonal gets a mix.
 */
export function starterRows(name: keyof typeof STARTER_BOARDS): TileCsvRow[] {
  const tasks = STARTER_BOARDS[name]
    .map((k) => SEED.get(k))
    .filter((t): t is SeedTask => !!t)
    .sort((a, b) => a.points - b.points);
  const n = tasks.length;
  const stride = n === 25 ? 7 : 1;
  const out: TileCsvRow[] = new Array(n);
  tasks.forEach((t, i) => {
    out[(i * stride) % n] = { ...t.config, label: t.label, points: t.points, category: t.category ?? null };
  });
  return out;
}

function starterPreset(
  key: string,
  board: keyof typeof STARTER_BOARDS,
  mode: EventMode,
  label: string,
  blurb: string,
): EventPreset {
  const rows = starterRows(board);
  return { key, label, blurb, emoji: '★', mode, size: mode === 'classic' ? 5 : rows.length, csv: { rows, labels: rows.map((r) => r.label ?? '') } };
}

export const BUILTIN_PRESETS: EventPreset[] = [
  starterPreset(
    'starter-mixed',
    'mixed',
    'classic',
    'Starter board · mid-level mix',
    '25 tiles ready to go: bosses, raids, skilling and a few big drops. Fits most clans for 1–2 weeks.',
  ),
  starterPreset(
    'starter-casual',
    'casual',
    'classic',
    'Starter board · casual',
    '25 easier tiles, a few just for laughs. Good when lots of members are still mid-game.',
  ),
  starterPreset(
    'starter-endgame',
    'endgame',
    'classic',
    'Starter board · endgame PvM',
    '25 raids, hilts and megarares. For maxed-out teams with two weeks or more.',
  ),
  starterPreset(
    'starter-leagues',
    'mixed',
    'leagues',
    'Starter Leagues · 25 tasks',
    'The mid-level mix as a points list — harder tasks pay more.',
  ),
  {
    key: 'classic-5',
    label: 'Empty 5×5 grid',
    blurb: 'Write all 25 tiles yourself.',
    emoji: '▦',
    mode: 'classic',
    size: 5,
  },
  {
    key: 'classic-7',
    label: 'Empty 7×7 grid',
    blurb: '49 tiles to write, for longer, busier events.',
    emoji: '▦',
    mode: 'classic',
    size: 7,
  },
  {
    key: 'leagues-20',
    label: 'Leagues board · 20 tiles',
    blurb: 'A point-scored task list — mix easy and hard tiles by value.',
    emoji: '🏅',
    mode: 'leagues',
    size: 20,
  },
  {
    key: 'leagues-40',
    label: 'Leagues board · 40 tiles',
    blurb: 'A big point-scored board to keep a whole clan busy.',
    emoji: '🏅',
    mode: 'leagues',
    size: 40,
  },
  {
    key: 'race-10',
    label: 'Tile race · 10 tiles',
    blurb: 'An ordered sprint — the team furthest down the track wins.',
    emoji: '🏁',
    mode: 'race',
    size: 10,
  },
];

// Suggest a never-blank event name from the clan name + how many events already exist, so
// the name field is pre-filled and staff can just accept it.
export function suggestEventName(clanName: string, existingCount: number): string {
  const n = existingCount + 1;
  const prefix = clanName.trim() ? `${clanName.trim()} ` : '';
  return `${prefix}Bingo #${n}`;
}

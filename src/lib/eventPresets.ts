import type { EventMode } from './eventModes';
import type { TileCsvRow } from './csvTiles';

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

export const BUILTIN_PRESETS: EventPreset[] = [
  {
    key: 'classic-5',
    label: 'Classic 5×5 Bingo',
    blurb: 'The staple — a 25-tile square grid, every tile worth 1.',
    emoji: '▦',
    mode: 'classic',
    size: 5,
  },
  {
    key: 'classic-7',
    label: 'Big 7×7 Bingo',
    blurb: 'A larger 49-tile grid for longer, busier events.',
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

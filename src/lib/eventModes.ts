// The three event "base types", each a (format, scoringMode) pairing with its own
// boardSize semantics. Shared by the create form (EventForm) and the admin Overview
// "Change Type" editor so both offer identical choices and validation bounds.
//   • classic — square N×N bingo grid (boardSize = N, tiles = N²)
//   • leagues — points-scored task list (boardSize = tile count)
//   • race    — ordered linear track   (boardSize = tile count)
export type EventMode = 'classic' | 'leagues' | 'race';

export interface EventModeMeta {
  key: EventMode;
  label: string;
  blurb: string;
  format: 'bingo' | 'tilerace';
  scoringMode: 'tiles' | 'points';
  sizeLabel: string;
  sizeHelp: (n: number) => string;
  min: number;
  max: number;
  default: number;
  square: boolean;
}

export const EVENT_MODES: EventModeMeta[] = [
  {
    key: 'classic',
    label: 'Classic bingo',
    blurb: 'A square N×N grid — teams complete tiles in any order, each worth 1.',
    format: 'bingo',
    scoringMode: 'tiles',
    sizeLabel: 'Grid size (N)',
    sizeHelp: (n) => `${n}×${n} = ${n * n} tiles`,
    min: 2,
    max: 12,
    default: 5,
    square: true,
  },
  {
    key: 'leagues',
    label: 'Leagues bingo',
    blurb: 'A task list where each tile carries a point value — any number of tiles.',
    format: 'bingo',
    scoringMode: 'points',
    sizeLabel: 'Number of tiles',
    sizeHelp: (n) => `${n} point-scored task${n !== 1 ? 's' : ''}`,
    min: 1,
    max: 200,
    default: 20,
    square: false,
  },
  {
    key: 'race',
    label: 'Tile race',
    blurb: 'An ordered track — teams reach tiles in sequence; furthest reached wins.',
    format: 'tilerace',
    scoringMode: 'tiles',
    sizeLabel: 'Number of tiles',
    sizeHelp: (n) => `${n} tiles in sequence`,
    min: 3,
    max: 100,
    default: 10,
    square: false,
  },
];

/** Resolve the stored (format, scoringMode) pair back to its mode key. */
export function modeKeyFor(
  format: string | null | undefined,
  scoringMode: string | null | undefined,
): EventMode {
  if (format === 'tilerace') return 'race';
  if (scoringMode === 'points') return 'leagues';
  return 'classic';
}

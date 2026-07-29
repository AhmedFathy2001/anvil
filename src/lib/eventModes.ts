import { parseEventRules, type EventRules, type RevealPolicy } from '@/lib/eventRules';

// The event "base types" offered at create / change-type. Each is a (format, scoringMode)
// pairing plus an optional rules preset (lib/eventRules — the reveal-policy third axis), with
// its own boardSize semantics. Shared by the create form (EventForm) and the admin Overview
// "Change Type" editor so both offer identical choices and validation bounds.
//   • classic   — square N×N bingo grid (boardSize = N, tiles = N²)
//   • leagues   — points-scored task list (boardSize = tile count)
//   • race      — ordered linear track   (boardSize = tile count)
//   • showdown  — points list, tiles revealed on a per-tile schedule (Tiles tab sets times)
//   • luckydraw — points list, a random draw reveals tiles on an interval
//   • bounty    — points list, ONE open tile at a time; first team to finish claims it
// 'ladder' = points-scored task list rendered as an INDIVIDUAL leaderboard (teams optional); tasks
// rotate via a reveal policy sub-choice (progressive/one-at-a-time/rotating). DMM All-Stars feel.
export type EventMode = 'classic' | 'leagues' | 'race' | 'showdown' | 'luckydraw' | 'bounty' | 'ladder';

export interface EventModeMeta {
  key: EventMode;
  label: string;
  blurb: string;
  format: 'bingo' | 'tilerace' | 'ladder';
  scoringMode: 'tiles' | 'points';
  /** Rules preset this mode ships with (undefined = classic behaviour, rules column stays NULL). */
  revealPolicy?: RevealPolicy;
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
  {
    key: 'showdown',
    label: 'Showdown',
    blurb: 'Tiles stay hidden until their scheduled moment — set each reveal time on the Tiles tab. Points-scored, DMM All Stars style.',
    format: 'bingo',
    scoringMode: 'points',
    revealPolicy: 'scheduled',
    sizeLabel: 'Number of tiles',
    sizeHelp: (n) => `${n} scheduled reveal${n !== 1 ? 's' : ''}`,
    min: 1,
    max: 200,
    default: 12,
    square: false,
  },
  {
    key: 'luckydraw',
    label: 'Lucky draw',
    blurb: 'A bingo caller: hidden tiles go live in random draws on a fixed interval. Points-scored.',
    format: 'bingo',
    scoringMode: 'points',
    revealPolicy: 'interval',
    sizeLabel: 'Number of tiles',
    sizeHelp: (n) => `${n} tile${n !== 1 ? 's' : ''} in the draw pool`,
    min: 2,
    max: 200,
    default: 24,
    square: false,
  },
  {
    key: 'bounty',
    label: 'Bounty hunt',
    blurb: 'One open tile at a time — the first team to finish it claims the points and the next bounty is drawn.',
    format: 'bingo',
    scoringMode: 'points',
    revealPolicy: 'bounty',
    sizeLabel: 'Number of tiles',
    sizeHelp: (n) => `${n} bount${n !== 1 ? 'ies' : 'y'} in the rotation`,
    min: 2,
    max: 200,
    default: 15,
    square: false,
  },
  {
    key: 'ladder',
    label: 'Ladder',
    blurb: 'A points-scored task list ranked as an individual leaderboard (teams optional). Tasks rotate — progressive, one-at-a-time or a rotating window — and can decay in value. Monthly-ladder style.',
    format: 'ladder',
    scoringMode: 'points',
    // Default rotation; the reveal-policy config lets the admin switch to bounty / rotating.
    revealPolicy: 'interval',
    sizeLabel: 'Number of tasks',
    sizeHelp: (n) => `${n} task${n !== 1 ? 's' : ''} in the pool`,
    min: 2,
    max: 200,
    default: 30,
    square: false,
  },
];

/**
 * Resolve a stored (format, scoringMode, rules) triple back to its mode key. `rules` accepts the
 * raw JSON column or an already-parsed EventRules; omitting it keeps the legacy pair resolution.
 */
export function modeKeyFor(
  format: string | null | undefined,
  scoringMode: string | null | undefined,
  rules?: string | EventRules | null,
): EventMode {
  const parsed = typeof rules === 'string' || rules == null ? parseEventRules(rules ?? null) : rules;
  // Ladder is a FORMAT, and a ladder can use any rotation policy — so it wins over the reveal-policy
  // resolution below (which maps bingo+policy to showdown/luckydraw/bounty).
  if (format === 'ladder') return 'ladder';
  if (parsed.revealPolicy === 'scheduled') return 'showdown';
  if (parsed.revealPolicy === 'interval') return 'luckydraw';
  if (parsed.revealPolicy === 'bounty') return 'bounty';
  if (format === 'tilerace') return 'race';
  if (scoringMode === 'points') return 'leagues';
  return 'classic';
}

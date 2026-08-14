// Relative and extension-qualified, not '@/': this file is run directly by the node test runner
// (like eventRules and eventReadiness), which resolves neither the tsconfig path alias nor a bare
// extensionless specifier. tsconfig has allowImportingTsExtensions, so the bundler is happy too.
import { parseEventRules, type EventRules, type RevealPolicy } from './eventRules.ts';

/**
 * What an event actually IS, as five independent answers.
 *
 * The named modes — Classic, Leagues, Showdown, Lucky draw, Bounty hunt, Ladder, Tile race — are
 * not seven different systems. They are seven presets over the same engine, and the code already
 * stored them that way: a `(format, scoringMode, rules.revealPolicy)` triple. Showdown and Lucky
 * draw differ by one field. Bounty differs by one field again. Ladder is Leagues scored per player
 * that usually never ends.
 *
 * The trouble is that `format` conflates two unrelated questions. `'bingo'` and `'tilerace'` describe
 * the SHAPE of a board, but `'ladder'` describes WHO COMPETES — so `isLadderFormat()` ended up
 * scattered across a dozen files, each call site silently deciding for itself whether "ladder" meant
 * "render as a list", "rank individuals", "hide team fields" or "no missions here". Those are four
 * different questions with four different right answers, and answering them with one boolean is why
 * team-only fields showed up on individual boards.
 *
 * This is the read-side answer: storage is untouched (`format` is part of the plugin wire contract —
 * see docs/PLUGIN_WIRE.md — so changing its meaning would break every deployed plugin), and every
 * surface asks for the axis it actually cares about instead.
 *
 * Pure and dependency-free, like lib/eventRules and lib/eventReadiness, so it is directly testable.
 */

/** How the board is laid out and authored. */
export type BoardShape =
  /** A true N×N square — classic bingo, where the grid IS the format. */
  | 'grid'
  /** An ordered track completed in sequence — tile race. */
  | 'track'
  /** A flat pool of tasks in no fixed geometry — Leagues and every live-drop mode. */
  | 'list';

/** Who the standings rank. */
export type Competitors = 'teams' | 'individuals';

/** Whether the event has a finish line. */
export type RunLength =
  /** Has an end date; the whole run is the competition. */
  | 'bounded'
  /** No end date — runs until someone ends it, so it cycles (monthly boards). */
  | 'rolling';

export interface EventAxes {
  shape: BoardShape;
  scoring: 'tiles' | 'points';
  /** How tasks become playable. `'all'` = everything visible at once. */
  opening: RevealPolicy;
  competitors: Competitors;
  runLength: RunLength;
  /** Tasks open and close while you watch — anything but `'all'`. The live-board test. */
  live: boolean;
}

export interface AxesInput {
  format?: string | null;
  scoringMode?: string | null;
  rules?: string | EventRules | null;
  endDate?: string | null;
}

/** Derive an event's axes from its stored columns. */
export function eventAxes(event: AxesInput): EventAxes {
  const rules =
    typeof event.rules === 'string' || event.rules == null
      ? parseEventRules(event.rules ?? null)
      : event.rules;

  // A ladder ranks individuals but has no geometry of its own — it's a pool, like Leagues.
  const shape: BoardShape =
    event.format === 'tilerace'
      ? 'track'
      : event.format === 'ladder' || event.scoringMode === 'points'
        ? 'list'
        : 'grid';

  return {
    shape,
    scoring: event.scoringMode === 'points' ? 'points' : 'tiles',
    opening: rules.revealPolicy,
    competitors: event.format === 'ladder' ? 'individuals' : 'teams',
    runLength: event.endDate ? 'bounded' : 'rolling',
    live: rules.revealPolicy !== 'all',
  };
}

/**
 * Can this board carry missions?
 *
 * Missions exist to give a board something it doesn't otherwise have: objectives that appear
 * mid-event, announced, on their own clock. A board whose tiles ALREADY open that way — showdown,
 * lucky draw, bounty, and the ladder's rotation — has that behaviour built in, so offering to
 * "enable mission drops" there is offering a thing it already is.
 *
 * So: team boards where every tile is visible from the start (classic bingo, leagues, tile race).
 */
export function supportsMissions(axes: EventAxes): boolean {
  return axes.competitors === 'teams' && !axes.live;
}

/**
 * Can the host change how tasks open without rebuilding the board?
 *
 * Points boards only. The reveal policies were built for point-scored pools — decay, first-finisher
 * bonuses and per-task values are what make a staggered reveal interesting — and a tile-scored
 * classic grid has none of that to work with.
 */
export function supportsRevealPolicy(axes: EventAxes): boolean {
  return axes.scoring === 'points';
}

/** What to call one entry on this board, in a sentence. */
export function taskNoun(axes: EventAxes): 'tile' | 'task' {
  return axes.competitors === 'individuals' ? 'task' : 'tile';
}

// Relative and extension-qualified, not '@/', so the node test runner can load this directly —
// same reason as lib/eventAxes and lib/eventRules.
import { eventAxes, taskNoun, type AxesInput, type EventAxes } from './eventAxes.ts';

/**
 * What authoring THIS board actually involves.
 *
 * The tile editor was written for classic bingo and every format since arrived as a condition on
 * top of it. That worked while the differences were cosmetic, but they aren't: on a Showdown the
 * job that decides whether the event works at all is *when each tile opens*, and that lived one
 * tile at a time inside a drawer you had to already be in. On a Lucky draw the pool's draw order
 * is the format, and nothing showed it. Meanwhile a ladder — where nobody has ever called them
 * tiles — said "tile" in nineteen places.
 *
 * So instead of asking "is this a bingo?" at every call site, each surface asks this module what
 * the board in front of it needs. The named formats stay presets over one engine (lib/eventAxes);
 * this is the authoring-side reading of those axes.
 *
 * Pure and dependency-free, like the axes it reads, so it is directly testable.
 */

/** The authoring surfaces a board can offer. The first in `views` is where the page opens. */
export type AuthoringView =
  /** The board itself — a grid to click, or a track in running order. */
  | 'board'
  /** A card per task: the general-purpose list, with search, filters and bulk edits. */
  | 'cards'
  /** The spreadsheet-style two-pane bulk builder. */
  | 'grid'
  /** Reveal times as a timeline — the scheduled board's real job. */
  | 'schedule'
  /** The draw pool in the order the engine will pull from it. */
  | 'rotation';

/** What a task's position on the board means — which is what reordering it changes. */
export type Ordering =
  /** Position places it in the square, so it decides the lines. */
  | 'grid'
  /** Position is the running order — tile 4 comes after tile 3. */
  | 'sequence'
  /** Position is the order the engine draws in (only when the draw isn't random). */
  | 'draw-order'
  /** Position is just the order they were added; nothing plays off it. */
  | 'none';

export interface AuthoringModel {
  axes: EventAxes;
  /** 'tile' / 'task' — a ladder's entries have never been tiles. Capitalised for headings. */
  noun: string;
  nounPlural: string;
  Noun: string;
  NounPlural: string;
  /** Views this board offers, in tab order. `views[0]` is the default. */
  views: AuthoringView[];
  ordering: Ordering;
  /** One line naming the job that makes this format what it is. */
  brief: string;
  /** The reveal time is per-task and the host owns it (Showdown). */
  schedulesReveals: boolean;
  /** The engine picks what opens next, so the pool — not the plan — is what you author. */
  drawsFromPool: boolean;
  /** Tasks open and close mid-event, so reveal state is worth bulk-editing. */
  live: boolean;
}

/** Capitalise the first letter, leaving the rest alone. */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function authoringModel(event: AxesInput): AuthoringModel {
  const axes = eventAxes(event);
  const noun = taskNoun(axes);
  const nounPlural = `${noun}s`;

  const schedulesReveals = axes.opening === 'scheduled';
  // 'rotating' and 'bounty' and 'interval' all mean the engine chooses; 'scheduled' means the host
  // wrote the plan down in advance, so the pool order buys nothing there.
  const drawsFromPool = axes.live && !schedulesReveals;

  // Content first, always: you cannot schedule a reveal for a task nobody has written yet. The
  // format's own view sits next to it rather than behind a drawer, and the page nudges you to it
  // once there's something to schedule (see TilesClient's unfinished-job banner).
  const views: AuthoringView[] = axes.shape === 'list' ? ['cards'] : ['board', 'cards'];
  if (schedulesReveals) views.push('schedule');
  if (drawsFromPool) views.push('rotation');
  views.push('grid');

  const ordering: Ordering =
    axes.shape === 'grid'
      ? 'grid'
      : axes.shape === 'track'
        ? 'sequence'
        : drawsFromPool
          ? 'draw-order'
          : 'none';

  return {
    axes,
    noun,
    nounPlural,
    Noun: cap(noun),
    NounPlural: cap(nounPlural),
    views,
    ordering,
    brief: brief(axes, noun, nounPlural),
    schedulesReveals,
    drawsFromPool,
    live: axes.live,
  };
}

/** The sentence at the top of the page: what this board wants from you, in its own terms. */
function brief(axes: EventAxes, noun: string, nounPlural: string): string {
  if (axes.opening === 'scheduled') {
    return `Every ${noun} stays hidden until the time you give it — set those on Schedule.`;
  }
  if (axes.opening === 'bounty') {
    return `One ${noun} is open at a time. The engine draws the next one the moment it's claimed.`;
  }
  if (axes.opening === 'rotating') {
    return `A rolling window of ${nounPlural} stays open — each draw opens new ones and expires the oldest.`;
  }
  if (axes.opening === 'interval') {
    return `${cap(nounPlural)} are drawn from the pool on a timer, and everything drawn stays open.`;
  }
  if (axes.shape === 'track') {
    return `${cap(nounPlural)} are reached in this order — the order is the race, so put them in it deliberately.`;
  }
  if (axes.shape === 'grid') {
    return `A square everyone sees from the start. Where a ${noun} sits decides which lines it's on.`;
  }
  return `A flat pool — every ${noun} is open from the start and worth what you set it to.`;
}

/**
 * What's still missing for this board to play the way its format promises.
 *
 * Not general board validation (lib/boardMisconfig already checks whether a task can credit) — this
 * is the format's own unfinished business, the thing that is fine on a classic bingo and fatal on a
 * Showdown. Returns null when there's nothing to chase.
 */
export function unfinishedFormatJob(
  model: AuthoringModel,
  tasks: { revealAt?: string | null; revealedAt?: string | null }[],
): { count: number; message: string; view: AuthoringView } | null {
  if (!model.schedulesReveals) return null;
  // A revealed task doesn't need a plan any more — it already happened.
  const unscheduled = tasks.filter((t) => !t.revealAt && !t.revealedAt).length;
  if (unscheduled === 0) return null;
  return {
    count: unscheduled,
    message:
      unscheduled === tasks.length
        ? `No ${model.noun} has a reveal time yet, so none of them will ever open.`
        : `${unscheduled} ${unscheduled === 1 ? model.noun : model.nounPlural} ${
            unscheduled === 1 ? 'has' : 'have'
          } no reveal time, so ${unscheduled === 1 ? 'it stays' : 'they stay'} hidden all event.`,
    view: 'schedule',
  };
}

/** Evenly spaced reveal times: the plan a Showdown host actually has in mind. */
export function staggeredTimes(startIso: string, intervalMinutes: number, count: number): string[] {
  const start = new Date(startIso).getTime();
  if (!Number.isFinite(start)) return [];
  const step = Math.max(1, Math.round(intervalMinutes)) * 60_000;
  return Array.from({ length: Math.max(0, count) }, (_, i) => new Date(start + i * step).toISOString());
}

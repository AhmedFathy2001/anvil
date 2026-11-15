/**
 * What a board tile's hover/focus card says (components/TileHoverCard). Pure: it reads only what the
 * board already holds for the tile, so showing the card never costs a request.
 */

export type TileHoverState = 'done' | 'open' | 'locked' | 'needs_proof';

export interface TileHoverInput {
  label: string;
  /** Teams that finished the tile, in the view being drawn. */
  doneBy?: { name: string }[];
  /** Not reachable yet (a race tile ahead of the team). */
  locked?: boolean;
  /** Counted from a screenshot, not by the plugin. */
  manualOnly?: boolean;
  /** Count progress; `text` is a COMBO's own short wording. */
  progress?: { current: number; required: number; text?: string } | null;
  stat?: { current: number; goal: number } | null;
  /** Progress already worded by the board ("12/50"). Used when no numbers are held. */
  progressText?: string | null;
  /** Teammates planning to go for it. */
  claimedBy?: { name: string; mine?: boolean }[];
  points?: number;
}

export interface TileHoverView {
  title: string;
  state: TileHoverState;
  stateLabel: string;
  /** "12 of 50", or null when nothing is counted. */
  progress: string | null;
  /** "Going for it: you, Alice". */
  who: string | null;
  points: string | null;
}

const num = (n: number) => n.toLocaleString('en-US');

export function tileHoverView(i: TileHoverInput): TileHoverView {
  const done = i.doneBy ?? [];
  let state: TileHoverState = 'open';
  let stateLabel = 'Open';
  if (done.length > 0) {
    state = 'done';
    const names = done.map((d) => d.name).filter(Boolean);
    stateLabel = names.length === 0 ? 'Done' : done.length <= 2 ? `Done by ${names.join(', ')}` : `Done by ${done.length} teams`;
  } else if (i.locked) {
    state = 'locked';
    stateLabel = 'Locked';
  } else if (i.manualOnly) {
    state = 'needs_proof';
    stateLabel = 'Needs a screenshot';
  }
  let progress: string | null = null;
  if (done.length === 0) {
    if (i.progress && i.progress.required > 0) progress = i.progress.text ?? `${num(i.progress.current)} of ${num(i.progress.required)}`;
    else if (i.stat && i.stat.goal > 0) progress = `${num(i.stat.current)} of ${num(i.stat.goal)}`;
  }
  if (progress === null && done.length === 0 && i.progressText) progress = i.progressText;
  const claims = i.claimedBy ?? [];
  const who = claims.length > 0 && done.length === 0 ? `Going for it: ${claims.map((c) => (c.mine ? 'you' : c.name)).join(', ')}` : null;
  const points = i.points !== undefined ? `${i.points} point${i.points === 1 ? '' : 's'}` : null;
  return { title: i.label, state, stateLabel, progress, who, points };
}

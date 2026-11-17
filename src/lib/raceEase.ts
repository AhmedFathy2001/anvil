/**
 * Easier options on a Tile race (format 'tilerace'), and the two ways one goes live.
 *
 * An EASIER OPTION is a tile the host wrote under a board tile: a child row (`parentTileId` = the
 * board tile, `easeLevel` = 1, 2, …) of any kind except a combo. Until it is LIVE for a team it is
 * hidden from that team and can't credit. Once live, the board tile reads "this, or the easier
 * option": finishing either finishes the board tile, so what a team already did on the hard version
 * still counts. A tile may carry several, each one level easier; most carry one.
 *
 * Two switches turn one on, both off by default and independent of each other:
 *
 *   TIMED EASING (events.rules.raceEase = { hours }). On the event clock, for everyone: every `hours`
 *   after the start is a TICK. Tick 1 opens step 1's first easier option, tick 2 opens step 2's first
 *   and step 1's second, and so on: a step's live level is `tick - step` (step counted from 0).
 *
 *   LIFELINES (events.rules.raceLifelines = { count, afterHours, opens }). Per team: `count` for the
 *   whole race. One spent on a tile the team is playing opens that tile's first easier option (or all
 *   of them, `opens: 'all'`) for that team only. A tile takes a lifeline only once it has been open
 *   to the team for `afterHours`.
 *
 * Pure (no `@/db`): lib/raceEaseDb loads the inputs; the gate, the boards, the plugin and the tests
 * call this.
 */

import type { RaceEaseRule, RaceLifelinesRule } from '@/lib/eventRules';
import type { RaceGraph } from '@/lib/raceRoutes';

const HOUR_MS = 3_600_000;

/** Easier options one board tile may carry. */
export const MAX_EASE_OPTIONS = 5;

export interface EaseOptionIn {
  id: number;
  parentTileId?: number | null;
  easeLevel?: number | null;
}

/** Is this row an easier option (not a board tile, not a combo's part)? */
export function isEaseOption(t: { parentTileId?: number | null; easeLevel?: number | null }): boolean {
  return t.parentTileId != null && t.easeLevel != null;
}

/** Is this row a combo's part (a child that is not an easier option)? */
export function isComboPartRow(t: { parentTileId?: number | null; easeLevel?: number | null }): boolean {
  return t.parentTileId != null && t.easeLevel == null;
}

/** Board tile id → its easier options, easiest last (by level, then id). */
export function easeOptionsByTile<T extends EaseOptionIn>(tiles: readonly T[]): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const t of tiles) {
    if (!isEaseOption(t)) continue;
    out.set(t.parentTileId as number, [...(out.get(t.parentTileId as number) ?? []), t]);
  }
  for (const list of out.values()) list.sort((a, b) => (a.easeLevel as number) - (b.easeLevel as number) || a.id - b.id);
  return out;
}

/**
 * Each easier option's RANK under its tile: 1 for the first, 2 for the next. Levels are whatever the
 * host stored; the rank is what the clock and a lifeline count in, so a gap (1, 3) changes nothing.
 */
export function easeRanks(tiles: readonly EaseOptionIn[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const list of easeOptionsByTile(tiles).values()) list.forEach((t, i) => out.set(t.id, i + 1));
  return out;
}

/** How many easing ticks have passed. 0 until the first interval is up, or with no start. */
export function easeTick(rule: RaceEaseRule | null, startMs: number | null, now: number): number {
  if (!rule || startMs == null || now < startMs) return 0;
  return Math.floor((now - startMs) / (rule.hours * HOUR_MS));
}

/** The level timed easing has opened on a step (0-based) at a tick: none, then one more per tick. */
export function timedEaseLevel(step: number | null | undefined, tick: number): number {
  if (step == null) return 0;
  return Math.max(0, tick - step);
}

/** When timed easing opens `rank` on a step (0-based): `step + rank` intervals after the start. */
export function timedEaseAt(rule: RaceEaseRule | null, startMs: number | null, step: number | null | undefined, rank: number): number | null {
  if (!rule || startMs == null || step == null) return null;
  return startMs + (step + rank) * rule.hours * HOUR_MS;
}

/** The level a spent lifeline opens on its tile. */
export function lifelineLevel(rule: RaceLifelinesRule | null, spent: boolean): number {
  if (!rule || !spent) return 0;
  return rule.opens === 'all' ? Number.POSITIVE_INFINITY : 1;
}

export interface EaseClock {
  ease: RaceEaseRule | null;
  lifelines: RaceLifelinesRule | null;
  /** The event's start, or null before it has one. */
  startMs: number | null;
  now: number;
}

/**
 * The easier options live for one team: those whose rank is within what the clock has opened on
 * their tile's step, or what a lifeline the team spent on that tile opens. `lifelineTiles` = the
 * board tiles this team spent a lifeline on. A tile that isn't on the route gets no timed easing.
 */
export function liveEaseIds(
  clock: EaseClock,
  graph: RaceGraph,
  options: readonly EaseOptionIn[],
  lifelineTiles: ReadonlySet<number> | null,
): Set<number> {
  const out = new Set<number>();
  const tick = easeTick(clock.ease, clock.startMs, clock.now);
  for (const [tileId, list] of easeOptionsByTile(options)) {
    const level = Math.max(
      timedEaseLevel(graph.byId.get(tileId)?.step, tick),
      lifelineLevel(clock.lifelines, lifelineTiles?.has(tileId) === true),
    );
    list.forEach((t, i) => {
      if (i + 1 <= level) out.add(t.id);
    });
  }
  return out;
}

/** The easier options timed easing alone has opened: what everyone, the public included, may see. */
export function timedLiveEaseIds(clock: EaseClock, graph: RaceGraph, options: readonly EaseOptionIn[]): Set<number> {
  return liveEaseIds({ ...clock, lifelines: null }, graph, options, null);
}

/**
 * When a route tile opened for a team: the race's start for a start tile, otherwise the moment the
 * team finished the tile that led to it (the earliest finished link into it; on a route an admin
 * edited, the latest finish on the step before). A road pick made later than that moves it to the
 * pick. Null when it hasn't opened (nothing before it is finished).
 */
export function tileOpenedAt(
  graph: RaceGraph,
  tileId: number,
  doneAt: ReadonlyMap<number, number>,
  startMs: number | null,
  pickedAt?: number | null,
): number | null {
  const node = graph.byId.get(tileId);
  if (!node) return null;
  let at: number | null;
  if (node.step === 0) at = startMs;
  else {
    const linked = (graph.prev.get(tileId) ?? []).map((id) => doneAt.get(id)).filter((t): t is number => t != null);
    if (linked.length) at = Math.min(...linked);
    else {
      const before = (graph.steps[node.step - 1] ?? []).map((id) => doneAt.get(id)).filter((t): t is number => t != null);
      at = before.length ? Math.max(...before) : null;
    }
  }
  if (at == null) return null;
  return pickedAt != null && pickedAt > at ? pickedAt : at;
}

export type LifelineState =
  /** The race has no lifelines. */
  | 'off'
  /** This tile has no easier option a lifeline would open (none written, or already live). */
  | 'nothing'
  /** The team already spent one here. */
  | 'spent'
  /** The team has none left. */
  | 'none-left'
  /** The tile isn't one the team is playing right now. */
  | 'not-open'
  /** Open, but not for long enough yet: usable at `readyAt`. */
  | 'wait'
  | 'ready';

export interface LifelineStatus {
  state: LifelineState;
  /** Lifelines the team still holds. */
  left: number;
  total: number;
  /** 'wait' only: when the tile takes a lifeline. */
  readyAt: number | null;
}

/**
 * Can this team spend a lifeline on this tile now? `spentTiles` = every tile it spent one on,
 * `wouldOpen` = how many of the tile's easier options a lifeline would newly turn on.
 */
export function lifelineStatus(args: {
  rule: RaceLifelinesRule | null;
  tileId: number;
  spentTiles: ReadonlySet<number>;
  wouldOpen: number;
  open: boolean;
  openedAt: number | null;
  now: number;
}): LifelineStatus {
  const { rule, tileId, spentTiles, wouldOpen, open, openedAt, now } = args;
  if (!rule) return { state: 'off', left: 0, total: 0, readyAt: null };
  const left = Math.max(0, rule.count - spentTiles.size);
  const base = { left, total: rule.count, readyAt: null as number | null };
  if (spentTiles.has(tileId)) return { ...base, state: 'spent' };
  if (wouldOpen <= 0) return { ...base, state: 'nothing' };
  if (left <= 0) return { ...base, state: 'none-left' };
  if (!open || openedAt == null) return { ...base, state: 'not-open' };
  const readyAt = openedAt + rule.afterHours * HOUR_MS;
  if (now < readyAt) return { ...base, state: 'wait', readyAt };
  return { ...base, state: 'ready' };
}

/** How many of a tile's easier options a lifeline would newly open, given what is live already. */
export function lifelineWouldOpen(rule: RaceLifelinesRule | null, options: readonly EaseOptionIn[], live: ReadonlySet<number>): number {
  if (!rule) return 0;
  const level = lifelineLevel(rule, true);
  return options.filter((t, i) => i + 1 <= level && !live.has(t.id)).length;
}

/** "in 5h 20m" / "in 12m" / "in under a minute": how long until a moment, in the players' words. */
export function easeWaitText(at: number, now: number): string {
  const mins = Math.ceil((at - now) / 60_000);
  if (mins <= 1) return 'in under a minute';
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 48) return `in ${Math.round(mins / 1440)} days`;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

// ---- One team's view (the web board and the plugin panel draw the same thing) --------------------

/** One board tile's easing, as one team sees it (lib/raceEaseDb teamEaseView). */
export interface TeamEaseTile {
  /** Live easier options on this tile for the team, first level first. */
  live: { id: number; label: string; rank: number }[];
  /** Easier options written on the tile but not live for the team (the count only: what they are stays hidden). */
  locked: number;
  /** When the clock opens the next locked one, if timed easing is on. */
  nextTimedAt: number | null;
  lifeline: LifelineStatus;
}

/** What a client is handed: per board tile with easier options, plus the team's lifelines. */
export interface TeamEasePayload {
  tiles: Record<string, TeamEaseTile>;
  lifelines: { left: number; total: number } | null;
  /** The viewer may spend a lifeline for the team (captain / team staff, or any member with neither). */
  canSpend: boolean;
  /** The server's clock when it answered: every "opens in…" is counted from it. */
  now: number;
  /** The viewer is an admin: may give a spent lifeline back. */
  canRefund?: boolean;
}

export const lifelineCount = (n: number): string => `${n} ${n === 1 ? 'lifeline' : 'lifelines'}`;

/** What to say about lifelines on one tile, in the players' words. Null = nothing to say. */
export function lifelineLine(view: TeamEasePayload, tile: TeamEaseTile | undefined): string | null {
  if (!view.lifelines) return null;
  const { left, total } = view.lifelines;
  const of = `${lifelineCount(left)} of ${total} left`;
  const life = tile?.lifeline;
  if (!tile || !life || life.state === 'nothing' || life.state === 'off') return tile?.live.length ? null : `No easier option on this tile. Your team has ${of}.`;
  if (life.state === 'spent') return `Your team used a lifeline here. ${of[0].toUpperCase()}${of.slice(1)}.`;
  if (life.state === 'none-left') return 'This tile has an easier option, but your team has no lifelines left.';
  if (life.state === 'not-open') return `This tile has an easier option. A lifeline works on it once your team is playing it (${of}).`;
  if (life.state === 'wait' && life.readyAt != null) return `This tile has an easier option. A lifeline works here ${easeWaitText(life.readyAt, view.now)} (${of}).`;
  if (life.state === 'ready' && !view.canSpend) return `This tile has an easier option. Your captain can use a lifeline to open it (${of}).`;
  if (life.state === 'ready') return `Opens this tile’s easier option for your team. ${of[0].toUpperCase()}${of.slice(1)}.`;
  return null;
}

/** May the viewer press "Use a lifeline" on this tile right now? */
export function lifelineSpendable(view: TeamEasePayload, tile: TeamEaseTile | undefined): boolean {
  return !!view.lifelines && view.canSpend && tile?.lifeline.state === 'ready';
}

/** "An easier option opens for everyone in 8h 23m", while the clock still has one to open. Null otherwise. */
export function nextTimedLine(view: TeamEasePayload, tile: TeamEaseTile | undefined): string | null {
  if (!tile || tile.locked <= 0 || tile.nextTimedAt == null || tile.nextTimedAt <= view.now) return null;
  return `${tile.live.length ? 'An easier one still' : 'An easier option'} opens for everyone ${easeWaitText(tile.nextTimedAt, view.now)}.`;
}

/** What spending asks first, on either surface. */
export const lifelineConfirmText = (left: number): string =>
  `Use one of your team’s ${lifelineCount(left)} on this tile? You’ll see the easier option once it’s spent, and it can’t be taken back.`;

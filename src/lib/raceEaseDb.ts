// The database half of lib/raceEase: which easier options are live for whom, spending a lifeline,
// and finishing a board tile when one of its live easier options is finished.
//
// Cheap when unused: everything starts from loadEaseContext, which is null off a race and on a race
// with no easier options written, and is memoised for a moment per event.

import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { completions, events, raceLifelines, raceRoadPicks, teams, tiles } from '@/db/schema';
import { parseStamp } from '@/lib/dbTime';
import { isEventOver } from '@/lib/eventLock';
import { parseEventRules } from '@/lib/eventRules';
import {
  easeOptionsByTile,
  easeTick,
  lifelineStatus,
  lifelineWouldOpen,
  liveEaseIds,
  tileOpenedAt,
  timedEaseAt,
  timedLiveEaseIds,
  type EaseClock,
  type LifelineStatus,
  type TeamEasePayload,
  type TeamEaseTile,
} from '@/lib/raceEase';
import { raceGraph, teamRoute, type RaceGraph } from '@/lib/raceRoutes';
import { eventRaceOpts, loadRacePicks } from '@/lib/raceRoutePicks';
import { ttlMemo } from '@/lib/ttlMemo';
import { log } from '@/lib/logger';
import { eventLink } from '@/lib/eventLinks';

export interface EaseEvent {
  id: number;
  format: string | null;
  rules: string | null;
  startDate?: string | null;
  endDate?: string | null;
  forceEndedAt?: string | null;
}

interface EaseOptionRow {
  id: number;
  parentTileId: number;
  easeLevel: number;
  label: string;
}

export interface EaseContext {
  clock: EaseClock;
  graph: RaceGraph;
  options: EaseOptionRow[];
  optionIds: Set<number>;
  byTile: Map<number, EaseOptionRow[]>;
  /** Team id → the board tiles it spent a lifeline on. */
  spentByTeam: Map<number, Set<number>>;
  /** What timed easing alone has opened: live for everyone. */
  timedLive: Set<number>;
  /** The race is over: nothing is hidden any more. */
  over: boolean;
}

async function loadEaseContextFresh(event: EaseEvent): Promise<EaseContext | null> {
  // clan-scope: global -- the event row came from a caller that already scoped it.
  const options = (await db
    .select({ id: tiles.id, parentTileId: tiles.parentTileId, easeLevel: tiles.easeLevel, label: tiles.label })
    .from(tiles)
    .where(and(eq(tiles.eventId, event.id), isNotNull(tiles.parentTileId), isNotNull(tiles.easeLevel)))) as EaseOptionRow[];
  if (!options.length) return null;
  const rules = parseEventRules(event.rules);
  const board = await db
    .select({ id: tiles.id, position: tiles.position, raceStep: tiles.raceStep, raceNext: tiles.raceNext, parentTileId: tiles.parentTileId, mission: tiles.mission })
    .from(tiles)
    .where(and(eq(tiles.eventId, event.id), isNull(tiles.parentTileId)));
  const graph = raceGraph(board);
  const spentByTeam = new Map<number, Set<number>>();
  if (rules.raceLifelines) {
    const spent = await db
      .select({ teamId: raceLifelines.teamId, tileId: raceLifelines.tileId })
      .from(raceLifelines)
      .innerJoin(teams, eq(teams.id, raceLifelines.teamId))
      .where(eq(teams.eventId, event.id));
    for (const r of spent) spentByTeam.set(r.teamId, new Set([...(spentByTeam.get(r.teamId) ?? []), r.tileId]));
  }
  const clock: EaseClock = { ease: rules.raceEase, lifelines: rules.raceLifelines, startMs: parseStamp(event.startDate), now: Date.now() };
  return {
    clock,
    graph,
    options,
    optionIds: new Set(options.map((o) => o.id)),
    byTile: easeOptionsByTile(options),
    spentByTeam,
    timedLive: timedLiveEaseIds(clock, graph, options),
    over: isEventOver(event),
  };
}

/** Forget the memoised context (after a lifeline is spent, or an easier option is added or removed). */
const easeEpoch = new Map<number, number>();
export function bumpEaseContext(eventId: number): void {
  easeEpoch.set(eventId, (easeEpoch.get(eventId) ?? 0) + 1);
}

/** The race's easier options and who they're live for. Null off a race, or with none written. */
/**
 * Easier options, or the switches that open them, changed on a race: drop the memo and have every
 * team's plugin refetch, so a panel left open doesn't keep saying what was true before the save.
 */
export async function easeChanged(eventId: number): Promise<void> {
  bumpEaseContext(eventId);
  try {
    const [{ notifyTeamTiles }, rows] = await Promise.all([
      import('@/lib/pushNotify'),
      db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, eventId)),
    ]);
    for (const t of rows) notifyTeamTiles(eventId, t.id, []);
  } catch (error) {
    log.warn('race-ease.notify-fail', { eventId }, error);
  }
}

export async function loadEaseContext(event: EaseEvent): Promise<EaseContext | null> {
  if (event.format !== 'tilerace') return null;
  return ttlMemo(`race-ease:${event.id}:${easeEpoch.get(event.id) ?? 0}:${event.rules ?? ''}:${event.startDate ?? ''}`, () => loadEaseContextFresh(event), 3_000);
}

/** The easier options live for one team (the clock's, plus its lifelines'). */
export function easeLiveForTeam(ctx: EaseContext, teamId: number): Set<number> {
  return liveEaseIds(ctx.clock, ctx.graph, ctx.options, ctx.spentByTeam.get(teamId) ?? null);
}

/**
 * The easier options a viewer may read: null = every one (staff who see through, or the race is
 * over). 'staff' under "Also hide from event staff" reads what any team has live; a team reads its
 * own; the public reads what the clock opened for everyone.
 */
export function easeVisibleFor(ctx: EaseContext, viewer: 'all' | 'staff' | { teamIds: number[] }): Set<number> | null {
  if (viewer === 'all' || ctx.over) return null;
  const out = new Set<number>(ctx.timedLive);
  const teamIds = viewer === 'staff' ? [...ctx.spentByTeam.keys()] : viewer.teamIds;
  for (const teamId of teamIds) for (const id of easeLiveForTeam(ctx, teamId)) out.add(id);
  return out;
}

/**
 * Drop the easier options this viewer may not read: as rows of their own, and nested on their tile
 * (lib/combo nestParts' `easier`). Rows that aren't easier options pass through.
 */
export function dropHiddenEase<T extends { id: number }>(ctx: EaseContext | null, visible: Set<number> | null, list: T[]): T[] {
  if (!ctx || visible == null) return list;
  const out: T[] = [];
  for (const t of list) {
    if (ctx.optionIds.has(t.id) && !visible.has(t.id)) continue;
    const nested = (t as { easier?: { id: number }[] }).easier;
    if (!Array.isArray(nested)) {
      out.push(t);
      continue;
    }
    const kept = nested.filter((o) => visible.has(o.id));
    const copy = { ...t } as T & { easier?: unknown };
    if (kept.length) copy.easier = kept;
    else delete copy.easier;
    out.push(copy);
  }
  return out;
}

/** Is this easier option live for this team right now? False for a row that isn't one. */
export async function easeOptionLiveForTeam(event: EaseEvent, optionId: number, teamId: number): Promise<boolean> {
  const ctx = await loadEaseContext(event);
  if (!ctx || !ctx.optionIds.has(optionId)) return false;
  return easeLiveForTeam(ctx, teamId).has(optionId);
}

/** Is this row an easier option no team but (maybe) `teamId` can read yet? Then a post naming it stays in-team. */
export async function easeHiddenFromOthers(event: EaseEvent, tileId: number): Promise<boolean> {
  const ctx = await loadEaseContext(event);
  if (!ctx || ctx.over || !ctx.optionIds.has(tileId)) return false;
  return !ctx.timedLive.has(tileId);
}

// ---- One team's view of a tile ----------------------------------------------------------------

export interface TeamEaseView {
  /** Per board tile that has easier options. */
  tiles: Map<number, TeamEaseTile>;
  lifelines: { left: number; total: number } | null;
}

/**
 * Everything one team's board shows about easing: per tile, what is live, how many are still locked,
 * when the clock opens the next, and whether a lifeline can be spent there. Null when the race has
 * no easier options.
 */
export async function teamEaseView(event: EaseEvent, teamId: number): Promise<TeamEaseView | null> {
  const ctx = await loadEaseContext(event);
  if (!ctx) return null;
  const rule = ctx.clock.lifelines;
  const live = easeLiveForTeam(ctx, teamId);
  const spent = ctx.spentByTeam.get(teamId) ?? new Set<number>();
  const doneRows = await db
    .select({ tileId: completions.tileId, completedAt: completions.completedAt })
    .from(completions)
    .where(eq(completions.teamId, teamId));
  const doneAt = new Map<number, number>();
  for (const r of doneRows) doneAt.set(r.tileId, parseStamp(r.completedAt) ?? ctx.clock.now);
  const picks = await loadRacePicks(event, teamId);
  const route = teamRoute(ctx.graph, doneAt.keys(), picks, eventRaceOpts(event));
  const pickedAt = new Map<number, number>();
  if (picks) {
    const rows = await db.select({ tileId: raceRoadPicks.tileId, pickedAt: raceRoadPicks.pickedAt }).from(raceRoadPicks).where(eq(raceRoadPicks.teamId, teamId));
    for (const r of rows) pickedAt.set(r.tileId, parseStamp(r.pickedAt) ?? ctx.clock.now);
  }
  const out = new Map<number, TeamEaseTile>();
  for (const [tileId, list] of ctx.byTile) {
    const step = ctx.graph.byId.get(tileId)?.step;
    const firstLocked = list.findIndex((o) => !live.has(o.id));
    out.set(tileId, {
      live: list.map((o, i) => ({ id: o.id, label: o.label, rank: i + 1 })).filter((o) => live.has(o.id)),
      locked: list.filter((o) => !live.has(o.id)).length,
      nextTimedAt: firstLocked < 0 ? null : timedEaseAt(ctx.clock.ease, ctx.clock.startMs, step, firstLocked + 1),
      lifeline: lifelineStatus({
        rule,
        tileId,
        spentTiles: spent,
        wouldOpen: lifelineWouldOpen(rule, list, live),
        open: route.open.includes(tileId),
        openedAt: tileOpenedAt(ctx.graph, tileId, doneAt, ctx.clock.startMs, pickedAt.get(tileId)),
        now: ctx.clock.now,
      }),
    });
  }
  return { tiles: out, lifelines: rule ? { left: Math.max(0, rule.count - spent.size), total: rule.count } : null };
}

/** teamEaseView as a client takes it (the site's GET and the plugin panel). Null with nothing to show. */
export async function teamEasePayload(event: EaseEvent, teamId: number, canSpend: boolean): Promise<TeamEasePayload | null> {
  const view = await teamEaseView(event, teamId);
  if (!view) return null;
  return { tiles: Object.fromEntries(view.tiles), lifelines: view.lifelines, canSpend, now: Date.now() };
}

// ---- Spending a lifeline ----------------------------------------------------------------------

const LIFELINE_REFUSAL: Record<Exclude<LifelineStatus['state'], 'ready'>, string> = {
  off: 'This race has no lifelines.',
  nothing: 'This tile has no easier option to open.',
  spent: 'Your team already used a lifeline on this tile.',
  'none-left': 'Your team has no lifelines left.',
  'not-open': 'Your team can only use a lifeline on a tile it is playing right now.',
  wait: 'This tile hasn’t been open to your team for long enough yet.',
};

/**
 * Spend one of a team's lifelines on a board tile. The caller has checked who may (the same people
 * who pick a road, lib/raceRoutesDb mayPickRoad). Final: only an admin gives one back.
 */
export async function spendLifeline(
  event: EaseEvent,
  teamId: number,
  tileId: number,
  userId: number | null,
): Promise<{ ok: true; opened: { id: number; label: string }[] } | { ok: false; error: string }> {
  bumpEaseContext(event.id);
  const view = await teamEaseView(event, teamId);
  const tile = view?.tiles.get(tileId);
  if (!view || !tile) return { ok: false, error: LIFELINE_REFUSAL[parseEventRules(event.rules).raceLifelines ? 'nothing' : 'off'] };
  if (tile.lifeline.state !== 'ready') return { ok: false, error: LIFELINE_REFUSAL[tile.lifeline.state] };
  const inserted = await db
    .insert(raceLifelines)
    .values({ teamId, tileId, usedByUserId: userId, usedAt: new Date().toISOString() })
    .onConflictDoNothing()
    .returning({ id: raceLifelines.id });
  if (!inserted.length) return { ok: false, error: LIFELINE_REFUSAL.spent };
  // Two members pressing at once on different tiles could overspend; the count is re-read and the
  // extra one taken back.
  const rule = parseEventRules(event.rules).raceLifelines;
  const mine = await db
    .select({ id: raceLifelines.id })
    .from(raceLifelines)
    .innerJoin(tiles, eq(tiles.id, raceLifelines.tileId))
    .where(and(eq(raceLifelines.teamId, teamId), eq(tiles.eventId, event.id)));
  if (rule && mine.length > rule.count) {
    await db.delete(raceLifelines).where(eq(raceLifelines.id, inserted[0].id));
    return { ok: false, error: LIFELINE_REFUSAL['none-left'] };
  }
  bumpEaseContext(event.id);
  const after = await teamEaseView(event, teamId);
  const before = new Set(tile.live.map((o) => o.id));
  const opened = (after?.tiles.get(tileId)?.live ?? []).filter((o) => !before.has(o.id)).map((o) => ({ id: o.id, label: o.label }));
  // What the team already did on the easier option counts from when the tile opened: settle it now,
  // before answering, so the board the spender sees next already shows a tile this finished.
  await settleEasedTiles(event.id, [teamId]).catch(() => 0);
  // The team's plugins refetch (a new tile to watch), and Discord hears that a lifeline went.
  void announceLifeline(event, teamId, tileId, rule ? Math.max(0, rule.count - mine.length) : 0, rule?.count ?? 0).catch(() => {});
  return { ok: true, opened };
}

/**
 * A lifeline was spent: the team's plugins are told to refetch, and one post goes to the event's
 * Discord. The post names the team and the step, never the tile or what opened: other teams may not
 * see either yet. While standings are hidden it doesn't name the step either.
 */
async function announceLifeline(event: EaseEvent, teamId: number, tileId: number, left: number, total: number): Promise<void> {
  const [{ notifyTeamTiles }, { sendEventBingoWebhook }, { standingsHidden }, { teamColorToDecimal }, { stepTitle }] = await Promise.all([
    import('@/lib/pushNotify'),
    import('@/lib/discord'),
    import('@/lib/standingsVisibility'),
    import('@/lib/discordEmbeds'),
    import('@/lib/raceRoutes'),
  ]);
  notifyTeamTiles(event.id, teamId, []);
  // clan-scope: global -- the event row came from a caller that already scoped it.
  const full = await db.query.events.findFirst({ where: eq(events.id, event.id) });
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId), columns: { name: true, color: true } });
  if (!full || !team) return;
  const ctx = await loadEaseContext(event);
  const step = ctx?.graph.byId.get(tileId)?.step;
  // "on step 3", "at the start", "at the finish" (lib/raceRoutes stepTitle's own names for a step).
  const named = step != null && ctx && !standingsHidden(full) ? stepTitle(ctx.graph, step) : '';
  const where = named.startsWith('Step') ? ` on ${named.toLowerCase()}` : named === 'Start' ? ' at the start' : named === 'Finish' ? ' at the finish' : '';
  await sendEventBingoWebhook(
    full.clanId,
    full.id,
    {
      embeds: [
        {
          title: `${team.name} used a lifeline${where}`,
          ...eventLink(full.id),
          description: `That tile now has an easier option for them. ${left} of ${total} ${total === 1 ? 'lifeline' : 'lifelines'} left.`,
          color: teamColorToDecimal(team.color),
        },
      ],
    },
    { post: 'reveals' },
  );
}

/** Admin: take back a lifeline a team spent on a tile (the team gets it back). */
export async function refundLifeline(eventId: number, teamId: number, tileId: number): Promise<boolean> {
  const removed = await db
    .delete(raceLifelines)
    .where(and(eq(raceLifelines.teamId, teamId), eq(raceLifelines.tileId, tileId)))
    .returning({ id: raceLifelines.id });
  bumpEaseContext(eventId);
  return removed.length > 0;
}

// ---- Finishing the board tile -----------------------------------------------------------------

/**
 * A team finished an easier option: finish its board tile, when the option is live for the team and
 * the tile is one the team may finish (its own race and rules gate). Returns whether THIS call
 * inserted the board tile's completion. Fire-safe: a hiccup here never fails the option's own credit.
 */
export async function syncEasedTile(
  optionId: number,
  teamId: number,
  opts: { silent?: boolean; held?: boolean; notifyClanId?: number } = {},
): Promise<{ inserted: boolean; parentId: number } | null> {
  try {
    const option = await db.query.tiles.findFirst({ where: eq(tiles.id, optionId) });
    if (!option || option.parentTileId == null || option.easeLevel == null) return null;
    const parent = await db.query.tiles.findFirst({ where: eq(tiles.id, option.parentTileId) });
    if (!parent || parent.autoTrackDisabled) return null;
    // clan-scope: global -- the tile rows came from an id the caller already scoped.
    const event = await db.query.events.findFirst({ where: eq(events.id, parent.eventId) });
    if (!event || !(await easeOptionLiveForTeam(event, optionId, teamId))) return null;
    const rows = await db
      .select({ tileId: completions.tileId, creditPlayerId: completions.creditPlayerId })
      .from(completions)
      .where(and(eq(completions.teamId, teamId), inArray(completions.tileId, [optionId, parent.id])));
    const mine = rows.find((r) => r.tileId === optionId);
    if (!mine) return null;
    if (rows.some((r) => r.tileId === parent.id)) return { inserted: false, parentId: parent.id };

    const { evaluateCompletionGate } = await import('@/lib/completionGate');
    const gate = await evaluateCompletionGate({ event, tile: parent, teamId });
    if (!gate.allowed) return { inserted: false, parentId: parent.id };
    const [inserted] = await db
      .insert(completions)
      .values({ teamId, tileId: parent.id, creditPlayerId: mine.creditPlayerId, awardedPoints: gate.awardedPoints })
      .onConflictDoNothing()
      .returning({ id: completions.id });
    if (!inserted) return { inserted: false, parentId: parent.id };
    const [{ emitCompletionRow }, { afterRaceCompletion }, { queueTileHighlight }, { announceCombo }, { handleBountyClaim }] = await Promise.all([
      import('@/lib/panelRows'),
      import('@/lib/raceRoutesDb'),
      import('@/lib/highlights/store'),
      import('@/lib/comboCompletion'),
      import('@/lib/revealEngine'),
    ]);
    if (!opts.held) {
      emitCompletionRow(parent.id, teamId);
      afterRaceCompletion(event, teamId);
    }
    if (!opts.silent && !opts.held) queueTileHighlight(parent.id, teamId);
    if (gate.bounty) handleBountyClaim(parent.eventId, parent.id).catch(() => {});
    if (!opts.silent && !opts.held) await announceCombo(parent, teamId, event, opts.notifyClanId, mine.creditPlayerId).catch(() => {});
    return { inserted: true, parentId: parent.id };
  } catch (error) {
    log.warn('race-ease.sync-fail', { optionId, teamId }, error);
    return null;
  }
}

/**
 * Settle a race after easier options went live (a tick, a lifeline): any live option a team has
 * already finished finishes its tile, and stat (kills / XP) options are re-checked so what the team
 * gained since the tile opened counts straight away rather than at the next sweep.
 */
export async function settleEasedTiles(eventId: number, teamIds?: number[]): Promise<number> {
  // clan-scope: global -- reached from an already-scoped event id.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return 0;
  bumpEaseContext(eventId);
  const ctx = await loadEaseContext(event);
  if (!ctx || ctx.over) return 0;
  const ids = teamIds ?? (await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, eventId))).map((t) => t.id);
  let finished = 0;
  for (const teamId of ids) {
    const live = [...easeLiveForTeam(ctx, teamId)];
    if (!live.length) continue;
    const done = await db
      .select({ tileId: completions.tileId })
      .from(completions)
      .where(and(eq(completions.teamId, teamId), inArray(completions.tileId, live)));
    for (const d of done) {
      const res = await syncEasedTile(d.tileId, teamId);
      if (res?.inserted) finished++;
    }
    // Not finished yet: re-check each against what the team already holds. Both paths finish the
    // option through the ordinary writers, which call back into syncEasedTile.
    const doneIds = new Set(done.map((d) => d.tileId));
    const pending = (await db.select().from(tiles).where(inArray(tiles.id, live))).filter((t) => !doneIds.has(t.id) && !t.autoTrackDisabled);
    const stat = pending.filter((t) => t.trackedStat && t.statType);
    try {
      if (stat.length) {
        const { creditStatTilesForTeam } = await import('@/lib/statTileCredit');
        finished += (await creditStatTilesForTeam({ eventId, teamId, statTiles: stat })).length;
      }
      const rest = pending.filter((t) => !(t.trackedStat && t.statType));
      if (rest.length) {
        const { syncDropTileCompletion } = await import('@/lib/submissions');
        for (const t of rest) await syncDropTileCompletion(t.id, teamId);
      }
    } catch (error) {
      log.warn('race-ease.settle-fail', { eventId, teamId }, error);
    }
  }
  return finished;
}

/** The easing tick the race is on now (0 with timed easing off or before the first interval). */
export function currentEaseTick(event: EaseEvent): number {
  if (event.format !== 'tilerace') return 0;
  return easeTick(parseEventRules(event.rules).raceEase, parseStamp(event.startDate), Date.now());
}

/**
 * An easier option was created or edited. When what it tracks changed, the baseline taken for the
 * old stat is dropped; on a race that is running, a fresh one is taken for every team playing its
 * tile (so it counts from now, not from before it existed) and anything already finished is settled.
 */
export async function afterEaseOptionSaved(
  eventId: number,
  before: { id: number; trackedStat: string | null; statType: string | null },
): Promise<void> {
  bumpEaseContext(eventId);
  try {
    const now = await db.query.tiles.findFirst({ where: eq(tiles.id, before.id), columns: { trackedStat: true, statType: true } });
    if (now && (now.trackedStat !== before.trackedStat || now.statType !== before.statType)) {
      await db.update(tiles).set({ revealStats: null }).where(eq(tiles.id, before.id));
    }
    const { ensureRaceBaselines } = await import('@/lib/raceRoutesDb');
    await ensureRaceBaselines(eventId);
    void settleEasedTiles(eventId).catch(() => {});
    await easeChanged(eventId);
  } catch (error) {
    log.warn('race-ease.after-save-fail', { eventId, optionId: before.id }, error);
  }
}

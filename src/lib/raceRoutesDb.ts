import { db } from '@/db';
import { completions, events, eventParticipants, raceBankedCredits, raceRoadPicks, teams, tiles, tileAuditLog, userNotices } from '@/db/schema';
import { and, eq, gte, inArray, isNull } from 'drizzle-orm';
import { raceGraph, rankRaceTeams, teamRoute, canPickRaceTile, raceTileNeedsBaseline, routeEditImpact } from '@/lib/raceRoutes';
import { notifyTeamTiles } from '@/lib/pushNotify';
import { teamUserIds } from '@/lib/panelRows';
import { captureRaceOpenStats, clearRaceOpenStats } from '@/lib/revealStatsCapture';
import { teamManagerIds } from '@/lib/teamStaff';
import { parseEventRules, visibleTiles } from '@/lib/eventRules';
import { loadRacePicks } from '@/lib/raceRoutePicks';
import { evaluateCompletionGate } from '@/lib/completionGate';
import { emitCompletionRow } from '@/lib/panelRows';
import { notifyTileCompletion, notifyTeamWin, sendEventBingoWebhook } from '@/lib/discord';

/**
 * The win check on a BRANCHING tile race (lib/raceRoutes): the first team to finish an end tile wins
 * — not "every tile done", which no team on a branching board ever does. Null when the event isn't a
 * race with steps laid out, so callers keep their blackout check (a straight line is unchanged).
 * `steps` stands in for the board's tile count in the win post.
 */
export async function branchingRaceWin(
  event: { id: number; format: string | null },
  teamId: number,
): Promise<{ won: boolean; steps: number } | null> {
  if (event.format !== 'tilerace') return null;
  // clan-scope: global -- the event row came from a caller that already scoped it.
  const board = await db.select().from(tiles).where(and(eq(tiles.eventId, event.id), isNull(tiles.parentTileId)));
  const graph = raceGraph(board);
  if (!graph.branching) return null;
  const ids = graph.nodes.map((n) => n.id);
  const done = ids.length
    ? await db
        .select({ teamId: completions.teamId, tileId: completions.tileId, completedAt: completions.completedAt })
        .from(completions)
        .where(inArray(completions.tileId, ids))
    : [];
  const eventTeams = await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.eventId, event.id));
  const me = rankRaceTeams(graph, eventTeams, done).find((s) => s.teamId === teamId);
  return { won: !!me && me.finished && me.rank === 1, steps: graph.lastStep + 1 };
}

type EventRow = typeof events.$inferSelect;

/**
 * "Bank early finishes" (events.rules.raceBank): keep a VALID finish on a race tile the team hasn't
 * reached yet. Callers bank only what would otherwise have completed (proof and rules checks done)
 * and was refused solely by the route (gate.raceLocked). A tile already closed for the team — an
 * alternative it passed up — is never banked: it can't be reached again. No-op with the rule off.
 */
export async function bankRaceCredit(event: EventRow, tileId: number, teamId: number, creditPlayerId: number | null): Promise<boolean> {
  if (event.format !== 'tilerace' || !parseEventRules(event.rules).raceBank) return false;
  // clan-scope: global -- the event row came from a caller that already scoped it.
  const board = await db.select().from(tiles).where(and(eq(tiles.eventId, event.id), isNull(tiles.parentTileId)));
  const done = (await db.select({ tileId: completions.tileId }).from(completions).where(eq(completions.teamId, teamId))).map((r) => r.tileId);
  const route = teamRoute(raceGraph(board), done, await loadRacePicks(event, teamId));
  if (route.state.get(tileId) !== 'ahead') return false;
  const inserted = await db
    .insert(raceBankedCredits)
    .values({ teamId, tileId, creditPlayerId, bankedAt: new Date().toISOString() })
    .onConflictDoNothing()
    .returning({ id: raceBankedCredits.id });
  return inserted.length > 0;
}

/**
 * Turn banked finishes into completions once the team's route reaches them. Run after any race
 * completion lands. One step at a time: each released tile commits the route, so the next banked
 * tile must be open from THAT tile — a bank never skips ahead or opens anything early. When two
 * banked tiles are open at once (a split), the one banked first wins and the other closes. Banks on
 * tiles that closed are dropped. Best-effort; callers fire and forget.
 */
export async function releaseBankedRaceCredits(eventId: number, teamId: number): Promise<number> {
  const banked = await db.select().from(raceBankedCredits).where(eq(raceBankedCredits.teamId, teamId));
  if (!banked.length) return 0;
  // clan-scope: global -- reached only from a completion insert on an already-scoped event.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event || event.format !== 'tilerace' || !parseEventRules(event.rules).raceBank) return 0;
  const board = await db.select().from(tiles).where(and(eq(tiles.eventId, event.id), isNull(tiles.parentTileId)));
  const graph = raceGraph(board);
  const picks = await loadRacePicks(event, teamId);
  const pending = banked.filter((b) => graph.byId.has(b.tileId)).sort((a, b) => a.bankedAt.localeCompare(b.bankedAt));
  let released = 0;
  for (let guard = 0; guard <= graph.lastStep + 1 && pending.length; guard++) {
    const done = (await db.select({ tileId: completions.tileId }).from(completions).where(eq(completions.teamId, teamId))).map((r) => r.tileId);
    const route = teamRoute(graph, done, picks);
    // Drop what can never land: done already, or closed off by the route the team took.
    const dead = pending.filter((b) => route.state.get(b.tileId) === 'done' || route.state.get(b.tileId) === 'closed');
    if (dead.length) {
      await db.delete(raceBankedCredits).where(inArray(raceBankedCredits.id, dead.map((b) => b.id)));
      for (const d of dead) pending.splice(pending.indexOf(d), 1);
    }
    const next = pending.find((b) => route.open.includes(b.tileId));
    if (!next) break;
    const tile = board.find((t) => t.id === next.tileId)!;
    const gate = await evaluateCompletionGate({ event, tile, teamId });
    if (!gate.allowed) break;
    const [row] = await db
      .insert(completions)
      .values({ teamId, tileId: tile.id, creditPlayerId: next.creditPlayerId, awardedPoints: gate.awardedPoints })
      .onConflictDoNothing()
      .returning({ id: completions.id });
    await db.delete(raceBankedCredits).where(eq(raceBankedCredits.id, next.id));
    pending.splice(pending.indexOf(next), 1);
    if (!row) continue;
    released++;
    emitCompletionRow(tile.id, teamId);
    const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
    const finisher = next.creditPlayerId != null
      ? (await db.query.eventParticipants.findFirst({ where: eq(eventParticipants.id, next.creditPlayerId) }))?.name ?? null
      : null;
    if (team) {
      notifyTileCompletion({
        clanId: event.clanId,
        teamId,
        eventName: event.name,
        tileLabel: tile.label,
        teamName: team.name,
        teamColor: team.color,
        tileType: tile.tileType,
        trackedStat: tile.trackedStat,
        statType: tile.statType,
        eventId: event.id,
        tile,
        finisher,
      }).catch(() => {});
    }
  }
  if (released > 0) {
    const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
    const race = await branchingRaceWin(event, teamId);
    const done = (await db.select({ tileId: completions.tileId }).from(completions).where(eq(completions.teamId, teamId))).map((r) => r.tileId);
    const won = race ? race.won : teamRoute(graph, done).finished;
    if (team && won) {
      notifyTeamWin({
        clanId: event.clanId,
        eventName: event.name,
        teamName: team.name,
        teamId: team.id,
        teamColor: team.color,
        totalTiles: race ? race.steps : graph.nodes.length,
        eventId: event.id,
      }).catch(() => {});
    }
  }
  return released;
}

/** After a completion lands on a race board: release any banked finishes it unlocked. */
export function afterRaceCompletion(event: { id: number; format: string | null }, teamId: number): void {
  if (event.format !== 'tilerace') return;
  // Baselines first (the tiles that just opened count from now), then any banked finishes.
  ensureRaceBaselines(event.id, [teamId])
    .catch(() => 0)
    .then(() => releaseBankedRaceCredits(event.id, teamId))
    .catch(() => {});
}

/**
 * STRICT STAT COUNTING ON RACES: capture a baseline (lib/revealStatsCapture captureRaceOpenStats) for
 * every stat tile open for each team that doesn't have one yet — the tiles that just opened, and,
 * the first time this runs on a race already under way, the ones open at that moment (so nothing
 * jumps retroactively). Parts of an open combo are captured with it. Returns tiles captured.
 */
export async function ensureRaceBaselines(eventId: number, teamIds?: number[]): Promise<number> {
  // clan-scope: global -- reached from an already-scoped event id.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event || event.format !== 'tilerace') return 0;
  const all = await db.select().from(tiles).where(eq(tiles.eventId, eventId));
  const graph = raceGraph(all.filter((t) => t.parentTileId == null));
  const mode = parseEventRules(event.rules).raceRoad;
  const statIds = new Set(all.filter((t) => t.trackedStat && t.statType).map((t) => t.id));
  if (!statIds.size) return 0;
  const partsOf = new Map<number, number[]>();
  for (const t of all) if (t.parentTileId != null && statIds.has(t.id)) partsOf.set(t.parentTileId, [...(partsOf.get(t.parentTileId) ?? []), t.id]);
  const ids = teamIds ?? (await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, eventId))).map((t) => t.id);
  let captured = 0;
  for (const teamId of ids) {
    const done = (await db.select({ tileId: completions.tileId }).from(completions).where(eq(completions.teamId, teamId))).map((r) => r.tileId);
    const route = teamRoute(graph, done, await loadRacePicks(event, teamId));
    const want = route.open
      .filter((id) => raceTileNeedsBaseline(graph, id, mode))
      .flatMap((id) => [...(statIds.has(id) ? [id] : []), ...(partsOf.get(id) ?? [])]);
    if (want.length) captured += await captureRaceOpenStats(eventId, teamId, want);
  }
  return captured;
}

/**
 * Who may pick a team's road ("Choose and lock in"): its captain or a team staff seat; on a team
 * with neither, any member. `isMember` = the caller plays on the team.
 */
export async function mayPickRoad(teamId: number, userId: number, isMember: boolean): Promise<boolean> {
  const managers = await teamManagerIds(teamId);
  return managers.has(userId) || (managers.size === 0 && isMember);
}

/**
 * Record a team's pick at its current fork. Final: a second pick at the same step is refused (only
 * an admin clears one, see clearRaceRoadPick). The caller has already checked who may pick.
 */
export async function pickRaceRoad(
  event: EventRow,
  teamId: number,
  tileId: number,
  userId: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (event.format !== 'tilerace' || parseEventRules(event.rules).raceRoad !== 'choose') {
    return { ok: false, error: 'This race doesn’t use road picks.' };
  }
  // clan-scope: global -- the event row came from a caller that already scoped it.
  const board = await db.select().from(tiles).where(and(eq(tiles.eventId, event.id), isNull(tiles.parentTileId)));
  const graph = raceGraph(board);
  const done = (await db.select({ tileId: completions.tileId }).from(completions).where(eq(completions.teamId, teamId))).map((r) => r.tileId);
  const picks = (await loadRacePicks(event, teamId)) ?? new Map<number, number>();
  if (!canPickRaceTile(graph, done, picks, tileId)) {
    return { ok: false, error: 'That tile isn’t one of your team’s choices right now.' };
  }
  const step = graph.byId.get(tileId)!.step;
  const inserted = await db
    .insert(raceRoadPicks)
    .values({ teamId, step, tileId, pickedByUserId: userId, pickedAt: new Date().toISOString() })
    .onConflictDoNothing()
    .returning({ id: raceRoadPicks.id });
  if (!inserted.length) return { ok: false, error: 'Your team already picked its road here.' };
  // A banked finish on the picked tile can land now.
  afterRaceCompletion(event, teamId);
  return { ok: true };
}

/** Admin: undo a team's pick at a step. */
export async function clearRaceRoadPick(teamId: number, step: number): Promise<boolean> {
  const removed = await db
    .delete(raceRoadPicks)
    .where(and(eq(raceRoadPicks.teamId, teamId), eq(raceRoadPicks.step, step)))
    .returning({ id: raceRoadPicks.id });
  return removed.length > 0;
}

// ---- Mid-race route edits ---------------------------------------------------------------------

export type RouteEditPolicy = 'keep' | 'rollback';
export type RouteEditDiscord = 'keep' | 'correct';

export interface RouteEditPreview {
  teams: { teamId: number; teamName: string; tiles: { id: number; label: string; step: number }[] }[];
  totalTiles: number;
}

type RouteEntryIn = { id: number; step: number | null; next: number[] };

async function loadRouteState(eventId: number) {
  const all = await db.select().from(tiles).where(and(eq(tiles.eventId, eventId), isNull(tiles.parentTileId)));
  const board = all.filter((t) => !(t.mission === 1));
  const ids = board.map((t) => t.id);
  const done = ids.length
    ? await db.select({ teamId: completions.teamId, tileId: completions.tileId }).from(completions).where(inArray(completions.tileId, ids))
    : [];
  const eventTeams = await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.eventId, eventId));
  const doneByTeam = new Map<number, number[]>(eventTeams.map((t) => [t.id, []]));
  for (const c of done) doneByTeam.get(c.teamId)?.push(c.tileId);
  return { board, doneByTeam, eventTeams };
}

/**
 * What saving this route mid-race would do to progress already made (lib/raceRoutes
 * routeEditImpact): every team with finishes that no longer follow, and those tiles. Empty teams =
 * the edit touches nobody, and saving needs no decision.
 */
export async function previewRouteEdit(eventId: number, entries: RouteEntryIn[]): Promise<RouteEditPreview> {
  const { board, doneByTeam, eventTeams } = await loadRouteState(eventId);
  const oldGraph = raceGraph(board);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const newGraph = raceGraph(board.map((t) => ({ ...t, raceStep: byId.get(t.id)?.step ?? null, raceNext: byId.get(t.id)?.next ?? [] })));
  const impact = routeEditImpact(oldGraph, newGraph, doneByTeam);
  const label = new Map(board.map((t) => [t.id, t.label]));
  const teamsOut = impact.map((i) => ({
    teamId: i.teamId,
    teamName: eventTeams.find((t) => t.id === i.teamId)?.name ?? `Team ${i.teamId}`,
    tiles: i.invalid.map((id) => ({ id, label: label.get(id) ?? `Tile ${id}`, step: (newGraph.byId.get(id) ?? oldGraph.byId.get(id))?.step ?? 0 })),
  }));
  return { teams: teamsOut, totalTiles: teamsOut.reduce((n, t) => n + t.tiles.length, 0) };
}

/**
 * Save a route on a race that's under way (admin only — the route caller checks). One transaction:
 * the new steps / links / board order, the chosen policy for invalidated progress, and the tile
 * history rows naming it.
 *   keep     — whoever got it, got it: completions stay (they still hold their steps) and the route
 *              applies from now on.
 *   rollback — the invalidated finishes go, with every later finish that hung off them; road picks
 *              from that step on and the team's baselines past it are cleared, so those tiles count
 *              afresh when they reopen.
 * After the commit (best-effort): baselines for what is open now, a plugin push so counts drop,
 * in-site notices to the affected teams, and — `discord: 'correct'` — a "rolled back by an admin"
 * post in the board's channel. Tile-complete posts aren't stored with their message ids, so the
 * original posts can't be edited or deleted; the correction is posted next to them instead.
 */
export async function applyLiveRouteEdit(args: {
  event: EventRow;
  entries: RouteEntryIn[];
  order: number[];
  policy: RouteEditPolicy;
  discord: RouteEditDiscord;
  actorUserId: number | null;
}): Promise<RouteEditPreview> {
  const { event, entries, order, policy, discord, actorUserId } = args;
  const preview = await previewRouteEdit(event.id, entries);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    for (let i = 0; i < order.length; i++) {
      const e = byId.get(order[i])!;
      await tx.update(tiles).set({ raceStep: e.step, raceNext: e.next, position: i }).where(eq(tiles.id, e.id));
      await tx.update(tiles).set({ position: i }).where(eq(tiles.parentTileId, e.id));
    }
    if (policy === 'rollback') {
      for (const t of preview.teams) {
        const ids = t.tiles.map((x) => x.id);
        await tx.delete(completions).where(and(eq(completions.teamId, t.teamId), inArray(completions.tileId, ids)));
        const fromStep = Math.min(...t.tiles.map((x) => x.step));
        await tx.delete(raceRoadPicks).where(and(eq(raceRoadPicks.teamId, t.teamId), gte(raceRoadPicks.step, fromStep)));
      }
    }
    await tx.insert(tileAuditLog).values({
      eventId: event.id,
      action: 'reordered',
      newValue: JSON.stringify({ raceRoute: 'steps', live: true, policy, discord: policy === 'rollback' ? discord : 'keep', teams: preview.teams.length, tiles: preview.totalTiles }),
      actorUserId,
    });
    for (const t of preview.teams) {
      for (const x of t.tiles) {
        await tx.insert(tileAuditLog).values({
          eventId: event.id,
          tileId: x.id,
          tileLabel: x.label,
          action: 'updated',
          changedFields: JSON.stringify([{ field: 'raceRoute', label: 'Race route (live edit)', from: `${t.teamName}: finished`, to: policy === 'rollback' ? 'rolled back by an admin' : 'kept (whoever got it, got it)' }]),
          newValue: JSON.stringify({ liveOverride: true, policy, teamId: t.teamId }),
          actorUserId,
        });
      }
    }
  });

  if (policy === 'rollback' && preview.teams.length) {
    // Locked again: forget the baselines past the cut so those tiles count afresh when they reopen.
    const graph = raceGraph(await db.select().from(tiles).where(and(eq(tiles.eventId, event.id), isNull(tiles.parentTileId))));
    for (const t of preview.teams) {
      const fromStep = Math.min(...t.tiles.map((x) => x.step));
      const later = graph.nodes.filter((n) => n.step >= fromStep).map((n) => n.id);
      await clearRaceOpenStats(event.id, t.teamId, later).catch(() => {});
      notifyTeamTiles(event.id, t.teamId, t.tiles.map((x) => x.id));
      const lines = t.tiles.map((x) => x.label).join(', ');
      for (const userId of await teamUserIds(t.teamId).catch(() => [] as number[])) {
        await db.insert(userNotices).values({
          userId,
          kind: 'race-rollback',
          refId: event.id,
          title: `${event.name}: route changed`,
          body: `An admin changed the race route and rolled back ${t.tiles.length === 1 ? 'a finish' : `${t.tiles.length} finishes`} for ${t.teamName}: ${lines}.`,
          createdAt: now,
        }).catch(() => {});
      }
      if (discord === 'correct') {
        sendEventBingoWebhook(event.clanId, event.id, {
          embeds: [{ title: 'Rolled back by an admin', description: `The race route for **${event.name}** changed. ${t.teamName}: ${lines} no longer count${t.tiles.length === 1 ? 's' : ''}.`, color: 0x7a5f18 }],
        }, { post: 'tileComplete', teamId: t.teamId }).catch(() => false);
      }
    }
  }
  await ensureRaceBaselines(event.id).catch(() => 0);
  return preview;
}

/**
 * A race's standings, computed ONCE on the server from what this viewer may see — visible board
 * tiles only, completions on them with their times — so the event page, the plugin panel and the
 * plugin roster rank the same way: first to an end tile, then steps done, then who reached that
 * step count first (lib/raceRoutes rankRaceTeams); identical steps and time share a rank. Null off
 * a race. `teamIds` narrows to the teams the viewer may see (hidden standings).
 */
export async function raceStandingsForEvent(
  event: { id: number; format: string | null; rules: string | null },
  teamIds?: number[],
): Promise<{ standings: import('@/lib/raceRoutes').RaceStanding[]; steps: number } | null> {
  if (event.format !== 'tilerace') return null;
  // clan-scope: global -- the event row came from a caller that already scoped it.
  const board = visibleTiles(parseEventRules(event.rules), await db.select().from(tiles).where(and(eq(tiles.eventId, event.id), isNull(tiles.parentTileId))));
  const graph = raceGraph(board);
  const ids = graph.nodes.map((n) => n.id);
  const done = ids.length
    ? await db.select({ teamId: completions.teamId, tileId: completions.tileId, completedAt: completions.completedAt }).from(completions).where(inArray(completions.tileId, ids))
    : [];
  let eventTeams = await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.eventId, event.id));
  if (teamIds) eventTeams = eventTeams.filter((t) => teamIds.includes(t.id));
  return { standings: rankRaceTeams(graph, eventTeams, done), steps: graph.lastStep + 1 };
}

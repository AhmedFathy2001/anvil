import { db } from '@/db';
import { completions, events, eventParticipants, raceBankedCredits, teams, tiles } from '@/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { raceGraph, rankRaceTeams, teamRoute } from '@/lib/raceRoutes';
import { parseEventRules } from '@/lib/eventRules';
import { evaluateCompletionGate } from '@/lib/completionGate';
import { emitCompletionRow } from '@/lib/panelRows';
import { notifyTileCompletion, notifyTeamWin } from '@/lib/discord';

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
  const route = teamRoute(raceGraph(board), done);
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
  const pending = banked.filter((b) => graph.byId.has(b.tileId)).sort((a, b) => a.bankedAt.localeCompare(b.bankedAt));
  let released = 0;
  for (let guard = 0; guard <= graph.lastStep + 1 && pending.length; guard++) {
    const done = (await db.select({ tileId: completions.tileId }).from(completions).where(eq(completions.teamId, teamId))).map((r) => r.tileId);
    const route = teamRoute(graph, done);
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
  releaseBankedRaceCredits(event.id, teamId).catch(() => {});
}

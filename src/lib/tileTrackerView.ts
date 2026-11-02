import { and, eq, inArray } from 'drizzle-orm';
import { clogTileSpec } from '@/lib/clogTiles';
import { clogPagesProgress } from '@/lib/clogTileCredit';

import { db } from '@/db';
import { completions, eventParticipants, submissions, teams, tiles as tilesTable, type events, type tiles } from '@/db/schema';
import { comboNeeded, isComboTile, parseComboRule } from '@/lib/combo';
import { parseCapBy } from '@/lib/tileCaps';
import { teamComboView } from '@/lib/comboCompletion';
import { parseStamp } from '@/lib/dbTime';
import { eventTimeState } from '@/lib/eventTime';
import { getStatStandings } from '@/lib/statStandings';
import { isMilestoneBasis } from '@/lib/statTracking';
import { parseJsonArray } from '@/lib/tileKinds';
import { collectionTileTeams, countTileTeams, statTileTeams, type TrackerInput, type TrackerRequirement } from '@/lib/tileTracker';

/**
 * One tile's progress for every team (lib/tileTracker) — what the pinned in-game tracker draws. The
 * route answers it for one caller (`mine` marks their team and themselves); the live push sends it
 * with `mine` null to everyone on the board, and each plugin marks its own by team and member id.
 */
export async function tileProgressView(
  event: typeof events.$inferSelect,
  tile: typeof tiles.$inferSelect,
  mine: { teamId: number; playerId: number } | null,
) {
  const [teamRows, people, done] = await Promise.all([
    db.select({ teamId: teams.id, name: teams.name, color: teams.color }).from(teams).where(eq(teams.eventId, event.id)),
    db.select({ id: eventParticipants.id, name: eventParticipants.name }).from(eventParticipants).where(eq(eventParticipants.eventId, event.id)),
    db.select({ teamId: completions.teamId }).from(completions).where(eq(completions.tileId, tile.id)),
  ]);
  const input: TrackerInput = {
    teams: teamRows,
    trackingMode: tile.trackingMode,
    completedTeamIds: new Set(done.map((d) => d.teamId)),
    viewerTeamId: mine?.teamId ?? null,
    viewerPlayerId: mine?.playerId ?? null,
    names: new Map(people.map((p) => [p.id, p.name])),
  };

  const isStat = !!tile.trackedStat && !!tile.statType && !!tile.statGoal;
  let goal: number;
  let teamProgress;
  if (isComboTile(tile)) {
    // A COMBO (lib/combo): each team's bar is its parts done against what the rule needs. Fed through
    // the count tracker as one credit per finished part (to whoever finished it), in team mode.
    const parts = await db.select({ id: tilesTable.id }).from(tilesTable).where(eq(tilesTable.parentTileId, tile.id));
    goal = comboNeeded(parseComboRule(tile.comboRule), parts.length);
    if (parseComboRule(tile.comboRule).mode === 'mix') {
      // A MIX: each team's combined share in percent (lib/comboProgress), the bar out of 100.
      goal = 100;
      const shares = await Promise.all(teamRows.map(async (t) => ({ teamId: t.teamId, amount: (await teamComboView(tile, t.teamId)).view.done })));
      teamProgress = countTileTeams({ ...input, trackingMode: 'team' }, shares.map((r) => ({ ...r, creditPlayerId: null })));
    } else {
    const partDone = parts.length
      ? await db
          .select({ teamId: completions.teamId, creditPlayerId: completions.creditPlayerId })
          .from(completions)
          .where(inArray(completions.tileId, parts.map((p) => p.id)))
      : [];
    teamProgress = countTileTeams({ ...input, trackingMode: 'team' }, partDone.map((c) => ({ ...c, amount: 1 })));
    }
  } else if (isStat) {
    goal = tile.statGoal!;
    const standing = (await getStatStandings(event.id, [tile.id]))[0];
    // A milestone tile ("reach 99") measures each member's lifetime against the goal, never a sum.
    const milestone = isMilestoneBasis(tile.statBasis);
    const players = (standing?.players ?? []).map((p) => ({
      playerId: p.playerId,
      teamId: p.teamId,
      gained: milestone ? Math.min(p.current, goal) : p.gained,
    }));
    teamProgress = statTileTeams(milestone ? { ...input, trackingMode: 'solo' } : input, players);
  } else {
    goal = tile.requiredAmount ?? 1;
    const subs = await db
      .select({
        teamId: submissions.teamId,
        playerId: submissions.playerId,
        creditPlayerId: submissions.creditPlayerId,
        amount: submissions.amount,
        itemId: submissions.itemId,
        goal: submissions.goal,
      })
      .from(submissions)
      // Every row: a capped counter's cap rows (lib/tileCaps) limit its count; the trackers below
      // only ever add the tile's own credits.
      .where(eq(submissions.tileId, tile.id));
    const reqs = parseJsonArray<TrackerRequirement>(tile.itemRequirements);
    if (tile.tileType === 'clog' && clogTileSpec(tile).mode === 'complete') {
      // Whole collection-log pages (lib/clogTiles): pages finished, read off each member's own log.
      // One row per finished page, credited to whoever finished it, folds through the count path.
      goal = clogTileSpec(tile).required;
      const pageRows: (typeof subs)[number][] = [];
      for (const t of input.teams) {
        const progress = await clogPagesProgress(tile, t.teamId);
        for (const page of progress.pages) {
          if (page.doneBy.length > 0) pageRows.push({ teamId: t.teamId, playerId: page.doneBy[0], creditPlayerId: null, amount: 1, itemId: null, goal: null });
        }
      }
      teamProgress = countTileTeams(input, pageRows, null);
    } else if (reqs.length > 0) {
      ({ goal, teams: teamProgress } = collectionTileTeams(input, subs, reqs, tile.groupMode, tile.setsRequired ?? 1));
    } else {
      teamProgress = countTileTeams(input, subs, tile.countMode, parseCapBy(tile.capBy));
    }
  }

  // The widget counts down to the start itself and drops its pins once the event is over. Both are
  // stable values, so the ETag still only moves when a phase or a number does.
  const time = eventTimeState({ startDate: event.startDate, endDate: event.endDate, forceEndedAt: event.forceEndedAt });
  const startMs = parseStamp(event.startDate);
  return {
    phase: time.phase,
    startsAt: startMs != null ? new Date(startMs).toISOString() : null,
    tileId: tile.id,
    label: tile.label,
    points: tile.points ?? 0,
    goal,
    statType: isStat ? tile.statType : null,
    teams: teamProgress,
  };
}

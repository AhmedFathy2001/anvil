import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { completions, eventParticipants, submissions, teams, type events, type tiles } from '@/db/schema';
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
  if (isStat) {
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
      })
      .from(submissions)
      .where(eq(submissions.tileId, tile.id));
    const reqs = parseJsonArray<TrackerRequirement>(tile.itemRequirements);
    if (reqs.length > 0) {
      ({ goal, teams: teamProgress } = collectionTileTeams(input, subs, reqs, tile.groupMode, tile.setsRequired ?? 1));
    } else {
      teamProgress = countTileTeams(input, subs, tile.countMode);
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

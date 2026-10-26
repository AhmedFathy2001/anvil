import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, eventParticipants, teams, users } from '@/db/schema';
import { verifyPluginTokenUser } from '@/lib/auth';
import { formatScore } from '@/lib/boardScoring';
import { canSeeEvent } from '@/lib/eventAccess';
import { eventAxes } from '@/lib/eventAxes';
import { rosterOverview, rosterSearch, rosterTeam, type RosterInput, type RosterOverview, type RosterSearchPage, type RosterTeamPage } from '@/lib/eventRoster';
import { eventForPluginRequest } from '@/lib/eventScope';
import { getLadderBoards } from '@/lib/ladderStandings';
import { getTeamStandings } from '@/lib/statStandings';
import { teamMemberPoints } from '@/lib/teamMemberPoints';
import { isPointsMode } from '@/lib/utils';

/**
 * One page of an event's roster for a plugin (lib/eventRoster): the teams ranked (or the players, when
 * every team is one person), one team's members, or players found by name. Null for an event the
 * caller may not see — the same answer as one that doesn't exist, so it can't probe for ids.
 *
 * WHO MAY READ IT is who may read the event's team pages on the website: canSeeEvent, with the plugin
 * token standing in for the cookie. Character names only — never Discord handles.
 */
export async function pluginRoster(
  request: Request,
  eventId: number,
  opts: { query: string; team: number | null; page: number; pageSize: number },
): Promise<RosterOverview | RosterTeamPage | RosterSearchPage | null> {
  const { query, page, pageSize } = opts;
  const event = (await eventForPluginRequest(request, eventId))?.event;
  if (!event) return null;

  const viewer = await verifyPluginTokenUser(request);
  const viewerPlayerId = viewer
    ? ((await db.query.users.findFirst({ where: eq(users.id, viewer.userId), columns: { playerId: true } }))?.playerId ?? null)
    : null;
  if (!(await canSeeEvent({ eventId, playerId: viewerPlayerId }))) return null;

  const individuals = eventAxes(event).competitors === 'individuals';

  const [teamRows, people] = await Promise.all([
    db
      .select({ id: teams.id, name: teams.name, color: teams.color, captainPlayerId: users.playerId })
      .from(teams)
      .leftJoin(users, eq(users.id, teams.captainUserId))
      .where(eq(teams.eventId, eventId)),
    db
      .select({
        participantId: eventParticipants.id,
        name: eventParticipants.name,
        teamId: eventParticipants.teamId,
        playerId: accounts.playerId,
      })
      .from(eventParticipants)
      .leftJoin(accounts, eq(accounts.id, eventParticipants.accountId))
      .where(eq(eventParticipants.eventId, eventId)),
  ]);

  // Scores only once there is a board to score: before the reveal every team is on nothing.
  const scoreByTeam = new Map<number, { score: number; text: string }>();
  if (event.tilesRevealed && !individuals && teamRows.length > 0) {
    for (const s of await getTeamStandings(eventId, event.scoringMode)) {
      scoreByTeam.set(s.teamId, { score: s.score, text: formatScore({ ...s, unit: s.unit as 'pts' | 'tiles' }) });
    }
  }

  const input: RosterInput = {
    teams: teamRows.map((t) => ({
      teamId: t.id,
      name: t.name,
      color: t.color,
      score: scoreByTeam.get(t.id)?.score ?? null,
      scoreText: scoreByTeam.get(t.id)?.text ?? null,
      captainPlayerId: t.captainPlayerId ?? null,
    })),
    people,
    viewerPlayerId,
    individuals,
  };

  if (query.trim()) return rosterSearch(input, query.slice(0, 40), page, pageSize);

  if (opts.team != null) {
    // Each member's share of the team's score, so the team's page reads best first.
    if (event.tilesRevealed && !individuals) {
      input.memberPoints = await teamMemberPoints(eventId, opts.team);
      input.pointsUnit = isPointsMode(event.scoringMode) ? 'pts' : 'tiles';
    }
    return rosterTeam(input, opts.team, page, pageSize);
  }

  if (individuals && event.tilesRevealed && people.length > 0) {
    const { allTime } = await getLadderBoards(event);
    input.individualPoints = allTime.map((s) => ({ participantId: s.playerId, name: s.name, points: s.points }));
  }
  return rosterOverview(input, page, pageSize);
}

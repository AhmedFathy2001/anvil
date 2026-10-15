import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, eventParticipants, teams, users } from '@/db/schema';
import { verifyPluginTokenUser } from '@/lib/auth';
import { canSeeEvent } from '@/lib/eventAccess';
import { eventAxes } from '@/lib/eventAxes';
import { eventForPluginRequest } from '@/lib/eventScope';
import { formatScore } from '@/lib/boardScoring';
import { getLadderBoards } from '@/lib/ladderStandings';
import { getTeamStandings } from '@/lib/statStandings';
import { jsonWithEtag } from '@/lib/httpEtag';
import { teamMemberPoints } from '@/lib/teamMemberPoints';
import { isPointsMode } from '@/lib/utils';
import {
  pageParams,
  rosterOverview,
  rosterSearch,
  rosterTeam,
  type RosterInput,
} from '@/lib/eventRoster';

// GET /api/plugin/event/[id]/roster — the plugin's Teams page, a page at a time (lib/eventRoster).
//
//   (nothing)   the teams ranked, or the players ranked when every team is one person
//   ?team=<id>  one team's members
//   ?q=<name>   players by name across every team
//   &page=<n>&size=<n>  1-based; size defaults to 25, at most 50
//
// The board endpoint stays as it is: it is polled, and a 1,200-name roster has no business riding
// along on every poll. This one is fetched when somebody opens the page, and answers 304 when
// nothing moved.
//
// WHO MAY READ IT is who may read the event's team pages on the website: canSeeEvent, with the
// plugin token standing in for the cookie. Character names only — never Discord handles.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const eventId = Number(rawId);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const event = (await eventForPluginRequest(request, eventId))?.event;
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const viewer = await verifyPluginTokenUser(request);
  const viewerPlayerId = viewer
    ? ((await db.query.users.findFirst({ where: eq(users.id, viewer.userId), columns: { playerId: true } }))?.playerId ?? null)
    : null;
  // The same answer for "no such event" and "not yours to see": the 404 must not probe for ids.
  if (!(await canSeeEvent({ eventId, playerId: viewerPlayerId }))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const { page, pageSize } = pageParams(url.searchParams.get('page'), url.searchParams.get('size'));
  const query = url.searchParams.get('q')?.slice(0, 40) ?? '';
  const teamParam = url.searchParams.get('team');
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

  if (query.trim()) return jsonWithEtag(request, rosterSearch(input, query, page, pageSize));

  if (teamParam != null) {
    if (!/^[1-9]\d{0,9}$/.test(teamParam)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Each member's share of the team's score, so the team's page reads best first.
    if (event.tilesRevealed && !individuals) {
      input.memberPoints = await teamMemberPoints(eventId, Number(teamParam));
      input.pointsUnit = isPointsMode(event.scoringMode) ? 'pts' : 'tiles';
    }
    const out = rosterTeam(input, Number(teamParam), page, pageSize);
    return out ? jsonWithEtag(request, out) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (individuals && event.tilesRevealed && people.length > 0) {
    const { allTime } = await getLadderBoards(event);
    input.individualPoints = allTime.map((s) => ({ participantId: s.playerId, name: s.name, points: s.points }));
  }
  return jsonWithEtag(request, rosterOverview(input, page, pageSize));
}

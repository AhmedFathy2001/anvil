import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { completions, eventParticipants, submissions, teams, tiles, users } from '@/db/schema';
import { verifyPluginToken, verifyPluginTokenUser } from '@/lib/auth';
import { canSeeEvent } from '@/lib/eventAccess';
import { parseStamp } from '@/lib/dbTime';
import { eventForPluginRequest } from '@/lib/eventScope';
import { eventTimeState } from '@/lib/eventTime';
import { isTileRevealed, parseEventRules } from '@/lib/eventRules';
import { jsonWithEtag } from '@/lib/httpEtag';
import { getStatStandings } from '@/lib/statStandings';
import { isMilestoneBasis } from '@/lib/statTracking';
import { countTileTeams, statTileTeams, type TrackerInput } from '@/lib/tileTracker';

// GET /api/plugin/event/[id]/tile/[tileId]/progress — one tile's progress for every team, with each
// team's top contributors (lib/tileTracker). Backs the plugin's pinned in-game tracker widget, which
// polls it only while a tile is pinned, so it answers 304 when nothing moved.
//
// WHO MAY READ IT is who may read the event on the website (canSeeEvent, the plugin token standing in
// for the cookie). A tile on a board not yet revealed, or still hidden by a reveal policy, is a 404
// like an unknown one.
export async function GET(request: Request, { params }: { params: Promise<{ id: string; tileId: string }> }) {
  const { id: rawId, tileId: rawTileId } = await params;
  const eventId = Number(rawId);
  const tileId = Number(rawTileId);
  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(tileId) || tileId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const event = (await eventForPluginRequest(request, eventId))?.event;
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const viewer = await verifyPluginTokenUser(request);
  const viewerUserPlayerId = viewer
    ? ((await db.query.users.findFirst({ where: eq(users.id, viewer.userId), columns: { playerId: true } }))?.playerId ?? null)
    : null;
  if (!(await canSeeEvent({ eventId, playerId: viewerUserPlayerId }))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Both gates the board applies: the whole board while the host is still authoring it
  // (tilesRevealed), then the per-tile reveal policy / unannounced missions.
  const tile = event.tilesRevealed
    ? await db.query.tiles.findFirst({ where: and(eq(tiles.id, tileId), eq(tiles.eventId, eventId)) })
    : undefined;
  if (!tile || !isTileRevealed(parseEventRules(event.rules), tile)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // The caller's own seat in THIS event, when they play in it — marks "your team" and "you".
  const seat = await verifyPluginToken(request);
  const mine = seat && seat.eventId === eventId ? seat : null;

  const [teamRows, people, done] = await Promise.all([
    db.select({ teamId: teams.id, name: teams.name, color: teams.color }).from(teams).where(eq(teams.eventId, eventId)),
    db.select({ id: eventParticipants.id, name: eventParticipants.name }).from(eventParticipants).where(eq(eventParticipants.eventId, eventId)),
    db.select({ teamId: completions.teamId }).from(completions).where(eq(completions.tileId, tileId)),
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
    const standing = (await getStatStandings(eventId, [tileId]))[0];
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
      .where(eq(submissions.tileId, tileId));
    teamProgress = countTileTeams(input, subs, tile.countMode);
  }

  // The widget counts down to the start itself and drops its pins once the event is over. Both are
  // stable values, so the ETag still only moves when a phase or a number does.
  const time = eventTimeState({ startDate: event.startDate, endDate: event.endDate, forceEndedAt: event.forceEndedAt });
  const startMs = parseStamp(event.startDate);
  return jsonWithEtag(request, {
    phase: time.phase,
    startsAt: startMs != null ? new Date(startMs).toISOString() : null,
    tileId,
    label: tile.label,
    points: tile.points ?? 0,
    goal,
    statType: isStat ? tile.statType : null,
    teams: teamProgress,
  });
}

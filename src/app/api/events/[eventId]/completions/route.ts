import { afterRaceCompletion } from '@/lib/raceRoutesDb';
import { branchingRaceWin } from '@/lib/raceRoutesDb';
import { raceGraph, canCreditRaceTile, canUndoRaceTile } from '@/lib/raceRoutes';
import { NextResponse } from 'next/server';
import { emitCompletionRow } from '@/lib/panelRows';
import { eventForRequest } from '@/lib/eventScope';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { completions, tiles, teams, events } from '@/db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { verifyAdmin, verifyCaptain, resolveTeamMembership } from '@/lib/auth';
import { notifyTileCompletion, notifyTeamWin } from '@/lib/discord';
import { parseContributionSnapshot } from '@/lib/statTracking';
import { evaluateCompletionGate } from '@/lib/completionGate';
import { handleBountyClaim, reopenBountyTileIfUnclaimed } from '@/lib/revealEngine';
import type { Completion } from '@/lib/types';
import { assertEventEditable } from '@/lib/eventLock';
import { afterPartCompletion } from '@/lib/comboCompletion';
import { standingsScopeForRequest } from '@/lib/standingsAccess';
import { filterToVisibleTeams } from '@/lib/standingsVisibility';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  const scopedEvent = await eventForRequest(request, id);
  if (!scopedEvent) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const eventTiles = await db.query.tiles.findMany({
    where: eq(tiles.eventId, id),
  });
  const tileIds = eventTiles.map((t) => t.id);

  let eventCompletions: Completion[] = [];
  if (tileIds.length > 0) {
    const rows = await db.select().from(completions)
      .where(inArray(completions.tileId, tileIds));
    eventCompletions = rows.map((c) => ({
      id: c.id,
      teamId: c.teamId,
      tileId: c.tileId,
      completedAt: c.completedAt,
      creditPlayerId: c.creditPlayerId,
      // Parse the frozen KC/XP split so clients feed it straight into computeMemberBreakdown.
      statContributions: parseContributionSnapshot(c.statContributions),
      // Frozen rule-modified award (first bonus / decay) — clients score it over the live weight.
      awardedPoints: c.awardedPoints,
    }));
  }

  // HIDDEN STANDINGS: a non-staff caller gets their own team(s)' completions only.
  const standingsScope = await standingsScopeForRequest(request, scopedEvent);
  return NextResponse.json(filterToVisibleTeams(standingsScope, eventCompletions, (c) => c.teamId));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const clan = await requireClan();
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;
  const { teamId, tileId } = await request.json();

  if (!teamId || !tileId) {
    return NextResponse.json({ error: 'teamId and tileId are required' }, { status: 400 });
  }

  // Check auth: must be admin or captain of the specified team. Captaincy is recognised
  // via the legacy captain_session cookie OR the Discord web session (unified My Team).
  const isAdmin = await verifyAdmin();
  const captain = await verifyCaptain();
  let isCaptainOfTeam = !!captain && captain.teamId === teamId;
  if (!isAdmin && !isCaptainOfTeam) {
    const membership = await resolveTeamMembership(eId, teamId);
    if (membership?.isCaptain) isCaptainOfTeam = true;
  }

  if (!isAdmin && !isCaptainOfTeam) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get event and check start date
  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Block completions before event starts (admin can bypass)
  if (!isAdmin && event.startDate) {
    const now = new Date().toISOString();
    if (now < event.startDate) {
      return NextResponse.json({ error: 'Event has not started yet' }, { status: 400 });
    }
  }

  // Verify team belongs to this event
  const team = await db.query.teams.findFirst({
    where: and(eq(teams.id, teamId), eq(teams.eventId, eId)),
  });
  if (!team) {
    return NextResponse.json({ error: 'Team not found in this event' }, { status: 404 });
  }

  // Verify tile belongs to this event
  const tile = await db.query.tiles.findFirst({
    where: and(eq(tiles.id, tileId), eq(tiles.eventId, eId)),
  });
  if (!tile) {
    return NextResponse.json({ error: 'Tile not found in this event' }, { status: 404 });
  }

  // A combo (lib/combo) completes from its parts — only an admin can force it either way.
  if (tile.tileType === 'combo' && !isAdmin) {
    return NextResponse.json({ error: 'A combo completes from its parts, not a manual toggle' }, { status: 400 });
  }

  // Drop tiles: only admin can force-toggle; captains/players use submissions
  if (tile.tileType === 'drop' && !isAdmin) {
    return NextResponse.json(
      { error: 'Drop tiles are completed through submissions, not manual toggle' },
      { status: 400 }
    );
  }

  // Tile race: completions follow the route (lib/raceRoutes). A team may only complete a tile that
  // is open for it — a start before it has finished anything, else a link from its committed tile —
  // and may only un-complete a tile with nothing finished at a later step. On a board with no steps
  // laid out that is exactly the old straight line. Admins bypass so they can correct the board.
  // A combo PART (lib/combo) has no place in the race — its combo does.
  const isPart = tile.parentTileId != null;
  if (event.format === 'tilerace' && !isAdmin && !isPart) {
    const raceTiles = await db.query.tiles.findMany({ where: and(eq(tiles.eventId, eId), isNull(tiles.parentTileId)) });
    const teamDone = await db.query.completions.findMany({ where: eq(completions.teamId, teamId) });
    const doneTileIds = new Set(teamDone.map((c) => c.tileId));
    const graph = raceGraph(raceTiles);

    if (!doneTileIds.has(tileId)) {
      if (!canCreditRaceTile(graph, doneTileIds, tileId)) {
        return NextResponse.json(
          { error: graph.branching ? 'That tile isn’t open on your team’s route' : 'Complete the earlier tiles in the race first' },
          { status: 400 },
        );
      }
    } else if (!canUndoRaceTile(graph, doneTileIds, tileId)) {
      return NextResponse.json({ error: 'Un-complete the later tiles in the race first' }, { status: 400 });
    }
  }

  // Toggle: check if completion exists
  const existing = await db.query.completions.findFirst({
    where: and(eq(completions.teamId, teamId), eq(completions.tileId, tileId)),
  });

  if (existing) {
    // Remove completion
    await db.delete(completions).where(eq(completions.id, existing.id));
    // A combo part undone may undo its combo (lib/comboCompletion).
    if (isPart) {
      await afterPartCompletion(tile, teamId, { change: 'removed' });
      return NextResponse.json({ action: 'removed', tileId, teamId });
    }
    // Bounty events: pulling back the claiming completion reopens the tile (no-op elsewhere).
    await reopenBountyTileIfUnclaimed(eId, tileId).catch(() => {});
    return NextResponse.json({ action: 'removed', tileId, teamId });
  } else {
    // Event-rules gate (lib/completionGate): captains can't complete unrevealed/claimed/locked
    // tiles. Admins bypass the block (board surgery) but still get the frozen award stamped so
    // an admin-forced completion scores consistently with everyone else's.
    const gate = await evaluateCompletionGate({ event, tile, teamId });
    // Admins bypass the RULES blocks (board surgery) — but not the start block: a tile completed
    // before the event began is nonsensical no matter who does it (gate.beforeStart).
    if (!gate.allowed && (!isAdmin || gate.beforeStart)) {
      return NextResponse.json({ error: gate.reason ?? 'This tile cannot be completed right now.' }, { status: 400 });
    }

    // Add completion
    const [completion] = await db
      .insert(completions)
      .values({ teamId, tileId, awardedPoints: gate.awardedPoints })
      .returning();

    // A combo part's row is progress: recompute (and maybe announce) its combo instead.
    if (isPart) {
      await afterPartCompletion(tile, teamId, { change: 'added', notifyClanId: clan.id });
      return NextResponse.json({ action: 'added', ...completion });
    }
    emitCompletionRow(tileId, teamId);
    afterRaceCompletion(event, teamId);

    // Bounty rotation: close the claimed tile and draw the next immediately (cron backstops).
    if (gate.bounty) handleBountyClaim(eId, tileId).catch(() => {});

    // Send Discord notification for tile completion
    notifyTileCompletion({
      clanId: clan.id,
      eventName: event?.name || 'Unknown Event',
      tileLabel: tile.label,
      teamName: team.name,
      teamId: team.id,
      teamColor: team.color,
      tileType: tile.tileType,
      trackedStat: tile.trackedStat,
      statType: tile.statType,
      eventId: eId,
      tile,
    }).catch(() => {}); // Silently ignore errors

    // Check for blackout win — board tiles only (combo parts aren't cells).
    const eventTiles = await db.query.tiles.findMany({
      where: and(eq(tiles.eventId, eId), isNull(tiles.parentTileId)),
    });
    const teamCompletions = await db.query.completions.findMany({
      where: eq(completions.teamId, teamId),
    });
    const eventTileIds = new Set(eventTiles.map(t => t.id));
    const completedTileIds = new Set(teamCompletions.map(c => c.tileId).filter(id => eventTileIds.has(id)));

    // A branching race is won by the first team to finish an end tile instead (lib/raceRoutesDb).
    const race = await branchingRaceWin(event, teamId);
    if (race ? race.won : completedTileIds.size === eventTiles.length && eventTiles.length > 0) {
      notifyTeamWin({
        clanId: clan.id,
        eventName: event.name,
        teamName: team.name,
        teamId: team.id,
        teamColor: team.color,
        totalTiles: race ? race.steps : eventTiles.length,
        eventId: eId,
      }).catch(() => {}); // Silently ignore errors
    }

    return NextResponse.json({ action: 'added', ...completion });
  }
}

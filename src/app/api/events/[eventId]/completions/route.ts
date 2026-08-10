import { NextResponse } from 'next/server';
import { db } from '@/db';
import { completions, tiles, teams, events } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { verifyAdmin, verifyCaptain, resolveTeamMembership } from '@/lib/auth';
import { notifyTileCompletion, notifyTeamWin } from '@/lib/discord';
import { parseContributionSnapshot } from '@/lib/statTracking';
import { evaluateCompletionGate } from '@/lib/completionGate';
import { handleBountyClaim, reopenBountyTileIfUnclaimed } from '@/lib/revealEngine';
import type { Completion } from '@/lib/types';
import { assertEventEditable } from '@/lib/eventLock';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

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
      // Parse the frozen KC/XP split so clients feed it straight into computeMemberBreakdown.
      statContributions: parseContributionSnapshot(c.statContributions),
      // Frozen rule-modified award (first bonus / decay) — clients score it over the live weight.
      awardedPoints: c.awardedPoints,
    }));
  }

  return NextResponse.json(eventCompletions);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
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

  // Drop tiles: only admin can force-toggle; captains/players use submissions
  if (tile.tileType === 'drop' && !isAdmin) {
    return NextResponse.json(
      { error: 'Drop tiles are completed through submissions, not manual toggle' },
      { status: 400 }
    );
  }

  // Tile race: completions are an ordered track. A team may only complete the tile
  // immediately after its current frontier, and may only un-complete the frontier
  // tile itself. Admins bypass so they can correct the board out of order.
  if (event.format === 'tilerace' && !isAdmin) {
    const raceTiles = await db.query.tiles.findMany({ where: eq(tiles.eventId, eId) });
    const teamDone = await db.query.completions.findMany({ where: eq(completions.teamId, teamId) });
    const doneTileIds = new Set(teamDone.map((c) => c.tileId));

    if (!doneTileIds.has(tileId)) {
      // Adding — every earlier tile in the sequence must already be done.
      const earlierUndone = raceTiles.some((t) => t.position < tile.position && !doneTileIds.has(t.id));
      if (earlierUndone) {
        return NextResponse.json({ error: 'Complete the earlier tiles in the race first' }, { status: 400 });
      }
    } else {
      // Removing — only the furthest tile can be undone.
      const laterDone = raceTiles.some((t) => t.position > tile.position && doneTileIds.has(t.id));
      if (laterDone) {
        return NextResponse.json({ error: 'Un-complete the later tiles in the race first' }, { status: 400 });
      }
    }
  }

  // Toggle: check if completion exists
  const existing = await db.query.completions.findFirst({
    where: and(eq(completions.teamId, teamId), eq(completions.tileId, tileId)),
  });

  if (existing) {
    // Remove completion
    await db.delete(completions).where(eq(completions.id, existing.id));
    // Bounty events: pulling back the claiming completion reopens the tile (no-op elsewhere).
    await reopenBountyTileIfUnclaimed(eId, tileId).catch(() => {});
    return NextResponse.json({ action: 'removed', tileId, teamId });
  } else {
    // Event-rules gate (lib/completionGate): captains can't complete unrevealed/claimed/locked
    // tiles. Admins bypass the block (board surgery) but still get the frozen award stamped so
    // an admin-forced completion scores consistently with everyone else's.
    const gate = await evaluateCompletionGate({ event, tile, teamId });
    if (!gate.allowed && !isAdmin) {
      return NextResponse.json({ error: gate.reason ?? 'This tile cannot be completed right now.' }, { status: 400 });
    }

    // Add completion
    const [completion] = await db
      .insert(completions)
      .values({ teamId, tileId, awardedPoints: gate.awardedPoints })
      .returning();

    // Bounty rotation: close the claimed tile and draw the next immediately (cron backstops).
    if (gate.bounty) handleBountyClaim(eId, tileId).catch(() => {});

    // Send Discord notification for tile completion
    notifyTileCompletion({
      eventName: event?.name || 'Unknown Event',
      tileLabel: tile.label,
      teamName: team.name,
      teamColor: team.color,
      tileType: tile.tileType,
      trackedStat: tile.trackedStat,
      statType: tile.statType,
    }).catch(() => {}); // Silently ignore errors

    // Check for blackout win
    const eventTiles = await db.query.tiles.findMany({
      where: eq(tiles.eventId, eId),
    });
    const teamCompletions = await db.query.completions.findMany({
      where: eq(completions.teamId, teamId),
    });
    const eventTileIds = new Set(eventTiles.map(t => t.id));
    const completedTileIds = new Set(teamCompletions.map(c => c.tileId).filter(id => eventTileIds.has(id)));

    if (completedTileIds.size === eventTiles.length && eventTiles.length > 0) {
      notifyTeamWin({
        eventName: event.name,
        teamName: team.name,
        teamColor: team.color,
        totalTiles: eventTiles.length,
      }).catch(() => {}); // Silently ignore errors
    }

    return NextResponse.json({ action: 'added', ...completion });
  }
}

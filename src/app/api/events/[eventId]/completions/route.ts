import { NextResponse } from 'next/server';
import { db } from '@/db';
import { completions, tiles, teams, events } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyAdmin, verifyCaptain } from '@/lib/auth';
import { notifyTileCompletion, notifyTeamWin } from '@/lib/discord';

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

  let eventCompletions: { id: number; teamId: number; tileId: number; completedAt: string }[] = [];
  if (tileIds.length > 0) {
    const allCompletions = await db.query.completions.findMany();
    eventCompletions = allCompletions.filter((c) => tileIds.includes(c.tileId));
  }

  return NextResponse.json(eventCompletions);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  const { teamId, tileId } = await request.json();

  if (!teamId || !tileId) {
    return NextResponse.json({ error: 'teamId and tileId are required' }, { status: 400 });
  }

  // Check auth: must be admin or captain of the specified team
  const isAdmin = await verifyAdmin();
  const captain = await verifyCaptain();

  if (!isAdmin && (!captain || captain.teamId !== teamId)) {
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

  // Toggle: check if completion exists
  const existing = await db.query.completions.findFirst({
    where: and(eq(completions.teamId, teamId), eq(completions.tileId, tileId)),
  });

  if (existing) {
    // Remove completion
    await db.delete(completions).where(eq(completions.id, existing.id));
    return NextResponse.json({ action: 'removed', tileId, teamId });
  } else {
    // Add completion
    const [completion] = await db.insert(completions).values({ teamId, tileId }).returning();

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

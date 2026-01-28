import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, players, teams } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { verifyAdmin, verifyCaptain } from '@/lib/auth';
import { getTeamForPick } from '@/lib/draft';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  const { playerId, teamId: overrideTeamId } = await request.json();

  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
  }

  // Auth: must be admin or captain of the picking team
  const isAdmin = await verifyAdmin();
  const captain = await verifyCaptain();

  if (!isAdmin && !captain) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Load event
  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.draftStatus !== 'active') {
    return NextResponse.json({ error: 'Draft is not active' }, { status: 400 });
  }
  if (!event.draftOrder) {
    return NextResponse.json({ error: 'Draft order not set' }, { status: 400 });
  }

  const teamOrder: number[] = JSON.parse(event.draftOrder);

  // Determine current pick
  const eventPlayers = await db
    .select()
    .from(players)
    .where(eq(players.eventId, eId));
  const pickedCount = eventPlayers.filter((p) => p.teamId !== null).length;
  const unpicked = eventPlayers.filter((p) => p.teamId === null);

  if (unpicked.length === 0) {
    return NextResponse.json({ error: 'No players left in pool' }, { status: 400 });
  }

  const expectedTeamId = getTeamForPick(teamOrder, pickedCount);

  // If admin is picking on behalf of a team, allow override
  const pickingTeamId = isAdmin && overrideTeamId ? overrideTeamId : expectedTeamId;

  // Validate it's the right team's turn (unless admin overriding)
  if (!isAdmin) {
    if (!captain || captain.teamId !== expectedTeamId) {
      return NextResponse.json({ error: 'It is not your team\'s turn to pick' }, { status: 403 });
    }
  }

  // For non-admin picks, the picking team must match the expected team
  if (!isAdmin && pickingTeamId !== expectedTeamId) {
    return NextResponse.json({ error: 'It is not your team\'s turn to pick' }, { status: 403 });
  }

  // Validate player is in pool
  const player = await db.query.players.findFirst({
    where: and(eq(players.id, playerId), eq(players.eventId, eId)),
  });
  if (!player) {
    return NextResponse.json({ error: 'Player not found in this event' }, { status: 404 });
  }
  if (player.teamId !== null) {
    return NextResponse.json({ error: 'Player has already been picked' }, { status: 400 });
  }

  // Make the pick
  const now = new Date().toISOString();
  await db
    .update(players)
    .set({
      teamId: expectedTeamId,
      pickNumber: pickedCount,
      pickedAt: now,
    })
    .where(eq(players.id, playerId));

  // Check if pool is now empty → auto-complete draft
  const remainingPool = unpicked.length - 1;
  if (remainingPool === 0) {
    await db
      .update(events)
      .set({ draftStatus: 'completed' })
      .where(eq(events.id, eId));
  }

  // Compute next pick info
  const nextPickNumber = pickedCount + 1;
  let nextTeamId: number | null = null;
  if (remainingPool > 0) {
    nextTeamId = getTeamForPick(teamOrder, nextPickNumber);
  }

  return NextResponse.json({
    success: true,
    pick: {
      playerId,
      playerName: player.name,
      teamId: expectedTeamId,
      pickNumber: pickedCount,
      pickedAt: now,
    },
    nextTeamId,
    poolRemaining: remainingPool,
    draftStatus: remainingPool === 0 ? 'completed' : 'active',
  });
}

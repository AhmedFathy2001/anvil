import { NextResponse } from 'next/server';
import { db } from '@/db';
import { submissions, tiles, teams, players, events } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyAdmin, verifyCaptain, verifyPlayer } from '@/lib/auth';
import { syncDropTileCompletion } from '@/lib/submissions';
import { notifySubmission } from '@/lib/discord';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  const { searchParams } = new URL(request.url);
  const teamIdFilter = searchParams.get('teamId');
  const tileIdFilter = searchParams.get('tileId');

  // Get all tiles for event
  const eventTiles = await db.query.tiles.findMany({
    where: eq(tiles.eventId, eId),
  });
  const tileIds = eventTiles.map((t) => t.id);

  if (tileIds.length === 0) {
    return NextResponse.json([]);
  }

  // Get all submissions for those tiles
  const allSubmissions = await db.select().from(submissions);
  let filtered = allSubmissions.filter((s) => tileIds.includes(s.tileId));

  if (teamIdFilter) {
    filtered = filtered.filter((s) => s.teamId === parseInt(teamIdFilter, 10));
  }
  if (tileIdFilter) {
    filtered = filtered.filter((s) => s.tileId === parseInt(tileIdFilter, 10));
  }

  // Join player names (uploader and credit)
  const allPlayers = await db.select().from(players).where(eq(players.eventId, eId));
  const playerMap = new Map(allPlayers.map((p) => [p.id, p.name]));

  const result = filtered.map((s) => ({
    ...s,
    uploaderName: s.playerId ? playerMap.get(s.playerId) || 'Unknown' : null,
    creditPlayerName: s.creditPlayerId ? playerMap.get(s.creditPlayerId) || 'Unknown' : null,
  }));

  return NextResponse.json(result);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  const { tileId, teamId, amount, imageUrl, note, creditPlayerId } = await request.json();

  if (!tileId || !teamId) {
    return NextResponse.json({ error: 'tileId and teamId are required' }, { status: 400 });
  }

  // Require image
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
    return NextResponse.json({ error: 'Image is required for submissions' }, { status: 400 });
  }

  // Check auth
  const isAdmin = await verifyAdmin();
  const captain = await verifyCaptain();
  const player = await verifyPlayer();

  if (!isAdmin && !captain && !player) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Non-admin must be on the correct team
  if (!isAdmin) {
    if (captain && captain.teamId !== teamId) {
      return NextResponse.json({ error: 'Cannot submit for another team' }, { status: 403 });
    }
    if (player && player.teamId !== teamId) {
      return NextResponse.json({ error: 'Cannot submit for another team' }, { status: 403 });
    }
  }

  // Verify tile belongs to event and is a drop tile
  const tile = await db.query.tiles.findFirst({
    where: and(eq(tiles.id, tileId), eq(tiles.eventId, eId)),
  });
  if (!tile) {
    return NextResponse.json({ error: 'Tile not found in this event' }, { status: 404 });
  }
  if (tile.tileType !== 'drop') {
    return NextResponse.json({ error: 'Submissions are only for drop tiles' }, { status: 400 });
  }

  // Verify team belongs to event
  const team = await db.query.teams.findFirst({
    where: and(eq(teams.id, teamId), eq(teams.eventId, eId)),
  });
  if (!team) {
    return NextResponse.json({ error: 'Team not found in this event' }, { status: 404 });
  }

  // Determine uploader playerId
  let uploaderId: number | null = null;
  if (player) {
    uploaderId = player.playerId;
  } else if (captain) {
    // Captain submitting - they are the uploader
    // Find captain's player record if they have one
    const captainPlayer = await db.query.players.findFirst({
      where: and(eq(players.teamId, captain.teamId), eq(players.eventId, eId)),
    });
    uploaderId = captainPlayer?.id || null;
  }

  // Validate creditPlayerId if provided - must be on the same team
  let resolvedCreditPlayerId: number | null = creditPlayerId || null;
  if (resolvedCreditPlayerId) {
    const creditPlayer = await db.query.players.findFirst({
      where: and(eq(players.id, resolvedCreditPlayerId), eq(players.teamId, teamId)),
    });
    if (!creditPlayer) {
      return NextResponse.json({ error: 'Credit player must be on the same team' }, { status: 400 });
    }
  }

  const [submission] = await db
    .insert(submissions)
    .values({
      tileId,
      teamId,
      playerId: uploaderId,
      creditPlayerId: resolvedCreditPlayerId,
      amount: amount || 1,
      imageUrl: imageUrl.trim(),
      note: note || null,
    })
    .returning();

  // Sync completion
  const syncResult = await syncDropTileCompletion(tileId, teamId);

  // Send Discord notification for the submission
  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });

  // Get current total submissions for progress
  const totalResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)` })
    .from(submissions)
    .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)));
  const currentTotal = totalResult[0]?.total ?? 0;

  // Get credit player name if provided
  let creditPlayerName: string | null = null;
  if (resolvedCreditPlayerId) {
    const creditPlayer = await db.query.players.findFirst({
      where: eq(players.id, resolvedCreditPlayerId),
    });
    creditPlayerName = creditPlayer?.name || null;
  }

  // Fire and forget - don't block the response
  notifySubmission({
    eventName: event?.name || 'Unknown Event',
    tileLabel: tile.label,
    teamName: team.name,
    teamColor: team.color,
    creditPlayerName,
    amount: amount || 1,
    currentTotal,
    requiredAmount: tile.requiredAmount,
    note: note || null,
    imageUrl: imageUrl.trim(),
  }).catch(() => {}); // Silently ignore errors

  return NextResponse.json({ submission, sync: syncResult }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  const { searchParams } = new URL(request.url);
  const submissionId = searchParams.get('submissionId');

  if (!submissionId) {
    return NextResponse.json({ error: 'submissionId query parameter required' }, { status: 400 });
  }

  const sId = parseInt(submissionId, 10);

  // Check auth
  const isAdmin = await verifyAdmin();
  const captain = await verifyCaptain();
  const player = await verifyPlayer();

  if (!isAdmin && !captain && !player) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get the submission
  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, sId),
  });
  if (!submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  // Verify tile belongs to this event
  const tile = await db.query.tiles.findFirst({
    where: and(eq(tiles.id, submission.tileId), eq(tiles.eventId, eId)),
  });
  if (!tile) {
    return NextResponse.json({ error: 'Submission not in this event' }, { status: 404 });
  }

  // Auth checks: admin can delete any, captain their team, player their own
  if (!isAdmin) {
    if (captain && captain.teamId !== submission.teamId) {
      return NextResponse.json({ error: 'Cannot delete submissions from another team' }, { status: 403 });
    }
    if (player) {
      if (player.teamId !== submission.teamId || player.playerId !== submission.playerId) {
        return NextResponse.json({ error: 'Can only delete your own submissions' }, { status: 403 });
      }
    }
  }

  await db.delete(submissions).where(eq(submissions.id, sId));

  // Sync completion
  const syncResult = await syncDropTileCompletion(submission.tileId, submission.teamId);

  return NextResponse.json({ success: true, sync: syncResult });
}

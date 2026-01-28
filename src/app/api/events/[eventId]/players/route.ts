import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { verifyAdmin, generatePlayerToken } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const eventPlayers = await db
    .select()
    .from(players)
    .where(eq(players.eventId, id));

  return NextResponse.json(eventPlayers);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  const body = await request.json();

  // Bulk import: array of { name, discord?, timezone? }
  if (Array.isArray(body)) {
    const toInsert = body
      .filter((p: { name?: string }) => p.name && typeof p.name === 'string' && p.name.trim())
      .map((p: { name: string; discord?: string; timezone?: string }) => ({
        eventId: id,
        name: p.name.trim(),
        discord: p.discord?.trim() || null,
        timezone: p.timezone?.trim() || null,
        playerToken: generatePlayerToken(),
      }));

    if (toInsert.length === 0) {
      return NextResponse.json({ error: 'No valid players to import' }, { status: 400 });
    }

    const inserted = await db.insert(players).values(toInsert).returning();
    return NextResponse.json(inserted, { status: 201 });
  }

  // Single player
  const { name, discord, timezone } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Player name is required' }, { status: 400 });
  }

  const [player] = await db
    .insert(players)
    .values({
      eventId: id,
      name: name.trim(),
      discord: discord?.trim() || null,
      timezone: timezone?.trim() || null,
      playerToken: generatePlayerToken(),
    })
    .returning();

  return NextResponse.json(player, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get('playerId');

  if (!playerId) {
    return NextResponse.json({ error: 'playerId query parameter required' }, { status: 400 });
  }

  const pId = parseInt(playerId, 10);

  // Only allow deleting unpicked players
  const player = await db.query.players.findFirst({
    where: and(eq(players.id, pId), eq(players.eventId, eId)),
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  if (player.teamId !== null) {
    return NextResponse.json({ error: 'Cannot delete a player that has been drafted' }, { status: 400 });
  }

  await db.delete(players).where(and(eq(players.id, pId), eq(players.eventId, eId)));

  return NextResponse.json({ success: true });
}

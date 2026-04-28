import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyAdmin, generatePlayerToken } from '@/lib/auth';
import { findOrCreateClanMember } from '@/lib/clan';

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
    const valid = body.filter(
      (p: { name?: string }) => p.name && typeof p.name === 'string' && p.name.trim(),
    ) as { name: string; discord?: string; timezone?: string }[];

    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid players to import' }, { status: 400 });
    }

    const toInsert = await Promise.all(
      valid.map(async (p) => {
        const name = p.name.trim();
        const discord = p.discord?.trim() || null;
        const clanMemberId = await findOrCreateClanMember(name, { discordId: discord });
        return {
          eventId: id,
          clanMemberId,
          name,
          discord,
          timezone: p.timezone?.trim() || null,
          playerToken: generatePlayerToken(),
        };
      }),
    );

    const inserted = await db.insert(players).values(toInsert).returning();
    return NextResponse.json(inserted, { status: 201 });
  }

  // Single player
  const { name, discord, timezone } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Player name is required' }, { status: 400 });
  }

  const trimmedName = name.trim();
  const trimmedDiscord = discord?.trim() || null;
  const clanMemberId = await findOrCreateClanMember(trimmedName, { discordId: trimmedDiscord });

  const [player] = await db
    .insert(players)
    .values({
      eventId: id,
      clanMemberId,
      name: trimmedName,
      discord: trimmedDiscord,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  const { playerId, name, discord, timezone } = await request.json();

  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
  }

  const pId = parseInt(playerId, 10);

  const player = await db.query.players.findFirst({
    where: and(eq(players.id, pId), eq(players.eventId, eId)),
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const updateData: { name?: string; discord?: string | null; timezone?: string | null } = {};

  if (name !== undefined) {
    if (typeof name === 'string' && name.trim()) {
      updateData.name = name.trim();
    } else {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }
  }

  if (discord !== undefined) {
    updateData.discord = discord?.trim() || null;
  }

  if (timezone !== undefined) {
    updateData.timezone = timezone?.trim() || null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const [updated] = await db
    .update(players)
    .set(updateData)
    .where(eq(players.id, pId))
    .returning();

  return NextResponse.json(updated);
}

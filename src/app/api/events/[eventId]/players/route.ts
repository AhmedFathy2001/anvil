import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, players, events, teams } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
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

  // Optional ?teamId= — drop the new player(s) straight onto a team (admin adding someone after
  // the draft). Validated against this event; null (default) leaves them in the pool.
  const rawTeamId = new URL(request.url).searchParams.get('teamId');
  let assignTeamId: number | null = null;
  if (rawTeamId) {
    const tid = parseInt(rawTeamId, 10);
    const team = Number.isFinite(tid)
      ? await db.query.teams.findFirst({ where: and(eq(teams.id, tid), eq(teams.eventId, id)) })
      : null;
    if (!team) return NextResponse.json({ error: 'Team not found in this event' }, { status: 404 });
    assignTeamId = tid;
  }
  const pickedAt = assignTeamId != null ? new Date().toISOString() : null;

  // Bulk add. Two payload shapes:
  //   - [{ clanMemberId }]  — preferred path, picker-driven, links directly to the synced roster
  //   - [{ name, discord?, timezone? }] — legacy text-based import, still accepted for guests/manual rows
  if (Array.isArray(body)) {
    type Item = { clanMemberId?: number; name?: string; discord?: string; timezone?: string };
    const items = body as Item[];

    const fromIds = items.filter((i): i is { clanMemberId: number } =>
      typeof i.clanMemberId === 'number' && Number.isFinite(i.clanMemberId),
    );
    const fromText = items.filter(
      (i) => typeof i.name === 'string' && i.name.trim().length > 0 && typeof i.clanMemberId !== 'number',
    ) as { name: string; discord?: string; timezone?: string }[];

    if (fromIds.length === 0 && fromText.length === 0) {
      return NextResponse.json({ error: 'No valid players to import' }, { status: 400 });
    }

    const toInsert: typeof players.$inferInsert[] = [];

    if (fromIds.length > 0) {
      // Picker path: look up the clan_members rows in one query and project them into players.
      const memberIds = fromIds.map((i) => i.clanMemberId);
      const memberRows = await db
        .select()
        .from(clanMembers)
        .where(inArray(clanMembers.id, memberIds));
      for (const m of memberRows) {
        toInsert.push({
          eventId: id,
          clanMemberId: m.id,
          name: m.rsn,
          discord: null,
          timezone: null,
          playerToken: generatePlayerToken(),
          teamId: assignTeamId,
          pickedAt,
        });
      }
    }

    for (const p of fromText) {
      const name = p.name.trim();
      const discord = p.discord?.trim() || null;
      const clanMemberId = await findOrCreateClanMember(name, { discordId: discord });
      toInsert.push({
        eventId: id,
        clanMemberId,
        name,
        discord,
        timezone: p.timezone?.trim() || null,
        playerToken: generatePlayerToken(),
        teamId: assignTeamId,
        pickedAt,
      });
    }

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
      teamId: assignTeamId,
      pickedAt,
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
  const { playerId, name, discord, timezone, teamId } = await request.json();

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

  const updateData: {
    name?: string;
    discord?: string | null;
    timezone?: string | null;
    teamId?: number | null;
    pickedAt?: string | null;
    pickNumber?: number | null;
  } = {};

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

  // Roster edits — assign to a team, or remove (teamId: null → back to the pool). Allowed before
  // the draft and once it's complete, but never mid-draft where the snake pick flow owns picks.
  if (teamId !== undefined) {
    const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
    if (event && (event.draftStatus === 'active' || event.draftStatus === 'paused')) {
      return NextResponse.json({ error: 'Cannot edit rosters while the draft is in progress.' }, { status: 409 });
    }
    if (teamId === null) {
      updateData.teamId = null;
      updateData.pickNumber = null;
      updateData.pickedAt = null;
    } else {
      const team = await db.query.teams.findFirst({ where: and(eq(teams.id, teamId), eq(teams.eventId, eId)) });
      if (!team) {
        return NextResponse.json({ error: 'Team not found in this event' }, { status: 404 });
      }
      updateData.teamId = teamId;
      updateData.pickedAt = new Date().toISOString();
    }
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

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, tiles, teams, completions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const eventTiles = await db.query.tiles.findMany({
    where: eq(tiles.eventId, id),
    orderBy: (tiles, { asc }) => [asc(tiles.position)],
  });

  const eventTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, id),
  });

  // Get all completions for tiles in this event
  const tileIds = eventTiles.map((t) => t.id);
  let eventCompletions: { id: number; teamId: number; tileId: number; completedAt: string }[] = [];
  if (tileIds.length > 0) {
    const allCompletions = await db.query.completions.findMany();
    eventCompletions = allCompletions.filter((c) => tileIds.includes(c.tileId));
  }

  // Strip captain passwords from team data
  const safeTeams = eventTeams.map(({ captainPassword: _, ...rest }) => rest);

  return NextResponse.json({
    ...event,
    tiles: eventTiles,
    teams: safeTeams,
    completions: eventCompletions,
  });
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
  const id = parseInt(eventId, 10);
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if ('startDate' in body) updates.startDate = body.startDate;
  if ('endDate' in body) updates.endDate = body.endDate;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const [updated] = await db
    .update(events)
    .set(updates)
    .where(eq(events.id, id))
    .returning();

  return NextResponse.json(updated);
}

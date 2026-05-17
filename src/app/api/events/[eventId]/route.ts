import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, tiles, teams, completions } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { notifyEventForceEnd } from '@/lib/discord';

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
    eventCompletions = await db.select().from(completions)
      .where(inArray(completions.tileId, tileIds));
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

  // Handle force-end action
  if (body.action === 'force-end') {
    const event = await db.query.events.findFirst({ where: eq(events.id, id) });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Validate event is active (started, not ended, not already force-ended)
    if (event.forceEndedAt) {
      return NextResponse.json({ error: 'Event is already force-ended' }, { status: 400 });
    }
    if (event.startDate && event.startDate > now) {
      return NextResponse.json({ error: 'Event has not started yet' }, { status: 400 });
    }
    if (event.endDate && event.endDate < now) {
      return NextResponse.json({ error: 'Event has already ended' }, { status: 400 });
    }

    // Save original end date and force-end
    const [updated] = await db
      .update(events)
      .set({
        originalEndDate: event.endDate,
        endDate: now,
        forceEndedAt: now,
        endNotified: 1,
      })
      .where(eq(events.id, id))
      .returning();

    // Compute standings for Discord notification
    const eventTeams = await db.select().from(teams).where(eq(teams.eventId, id));
    const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, id));
    const eventTileIds = eventTiles.map(t => t.id);
    const eventCompletions = eventTileIds.length > 0
      ? await db.select().from(completions).where(inArray(completions.tileId, eventTileIds))
      : [];

    const standings = eventTeams.map(team => {
      const teamCompletions = eventCompletions.filter(c => c.teamId === team.id);
      return { teamName: team.name, tilesCompleted: teamCompletions.length };
    });

    notifyEventForceEnd({
      eventName: event.name,
      standings,
      totalTiles: eventTiles.length,
    }).catch(() => {});

    return NextResponse.json(updated);
  }

  // Handle resume action
  if (body.action === 'resume') {
    const event = await db.query.events.findFirst({ where: eq(events.id, id) });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.forceEndedAt) {
      return NextResponse.json({ error: 'Event is not force-ended' }, { status: 400 });
    }

    const [updated] = await db
      .update(events)
      .set({
        endDate: event.originalEndDate,
        forceEndedAt: null,
        originalEndDate: null,
        endNotified: 0,
      })
      .where(eq(events.id, id))
      .returning();

    return NextResponse.json(updated);
  }

  // Default: update dates and/or sign-up config
  const updates: Record<string, unknown> = {};
  if ('startDate' in body) updates.startDate = body.startDate;
  if ('endDate' in body) updates.endDate = body.endDate;
  if ('signupOpensAt' in body) updates.signupOpensAt = body.signupOpensAt;
  if ('signupDeadline' in body) updates.signupDeadline = body.signupDeadline;
  if ('captainSelectionDeadline' in body) updates.captainSelectionDeadline = body.captainSelectionDeadline;
  if ('signupFee' in body) {
    if (body.signupFee !== null && (typeof body.signupFee !== 'number' || !Number.isFinite(body.signupFee) || body.signupFee < 0)) {
      return NextResponse.json({ error: 'signupFee must be a non-negative number or null' }, { status: 400 });
    }
    updates.signupFee = body.signupFee;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Validate ISO strings and enforce end > start (using the final values: new or existing).
  const isIsoString = (v: unknown): v is string =>
    typeof v === 'string' && !Number.isNaN(Date.parse(v));

  for (const field of ['startDate', 'endDate', 'signupOpensAt', 'signupDeadline', 'captainSelectionDeadline'] as const) {
    if (field in body && body[field] !== null && !isIsoString(body[field])) {
      return NextResponse.json({ error: `${field} must be an ISO date string or null` }, { status: 400 });
    }
  }

  const existing = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!existing) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  const finalStart = 'startDate' in body ? (body.startDate as string | null) : existing.startDate;
  const finalEnd = 'endDate' in body ? (body.endDate as string | null) : existing.endDate;
  if (finalStart && finalEnd && finalEnd <= finalStart) {
    return NextResponse.json(
      { error: 'endDate must be after startDate' },
      { status: 400 },
    );
  }

  // Sign-up sequencing: opens ≤ deadline ≤ captain-selection ≤ start. Each pair is checked
  // individually so partial updates against existing values still validate.
  const finalSignupOpens = 'signupOpensAt' in body ? (body.signupOpensAt as string | null) : existing.signupOpensAt;
  const finalSignupDeadline = 'signupDeadline' in body ? (body.signupDeadline as string | null) : existing.signupDeadline;
  const finalCaptainDeadline = 'captainSelectionDeadline' in body ? (body.captainSelectionDeadline as string | null) : existing.captainSelectionDeadline;

  if (finalSignupOpens && finalSignupDeadline && finalSignupDeadline <= finalSignupOpens) {
    return NextResponse.json({ error: 'signupDeadline must be after signupOpensAt' }, { status: 400 });
  }
  if (finalSignupDeadline && finalCaptainDeadline && finalCaptainDeadline < finalSignupDeadline) {
    return NextResponse.json({ error: 'captainSelectionDeadline must be on or after signupDeadline' }, { status: 400 });
  }
  if (finalCaptainDeadline && finalStart && finalCaptainDeadline > finalStart) {
    return NextResponse.json({ error: 'captainSelectionDeadline must be on or before startDate' }, { status: 400 });
  }
  if (finalSignupDeadline && finalStart && finalSignupDeadline > finalStart) {
    return NextResponse.json({ error: 'signupDeadline must be on or before startDate' }, { status: 400 });
  }

  const [updated] = await db
    .update(events)
    .set(updates)
    .where(eq(events.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/events/[eventId] — permanently removes an event and everything it owns
// (tiles, teams, completions, players, submissions, signups all cascade in the schema).
// Admin-only and gated on the event already being over so we can't delete a live one
// out from under participants — force-end first if you need to delete a running event.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Bad event id' }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const isOver = !!event.forceEndedAt || (!!event.endDate && event.endDate < now);
  const isDraft = !event.startDate && !event.forceEndedAt;
  if (!isOver && !isDraft) {
    return NextResponse.json(
      { error: 'Event is still active. Force-end it first or wait for it to end.' },
      { status: 400 },
    );
  }

  await db.delete(events).where(eq(events.id, id));
  return NextResponse.json({ success: true });
}

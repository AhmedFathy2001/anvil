import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db';
import { teams, events, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyAdmin, verifyCaptain } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const eventTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, id),
  });

  // Strip captain passwords
  const safeTeams = eventTeams.map(({ captainPassword: _, ...rest }) => rest);
  return NextResponse.json(safeTeams);
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
  const { name, color, captainUserId } = await request.json();

  if (!name || !color) {
    return NextResponse.json({ error: 'Name and color are required' }, { status: 400 });
  }

  const captainUserIdInt =
    typeof captainUserId === 'number' && Number.isFinite(captainUserId) && captainUserId > 0
      ? captainUserId
      : null;
  if (captainUserIdInt == null) {
    return NextResponse.json(
      { error: 'captainUserId is required — assign a Discord-linked user as captain.' },
      { status: 400 },
    );
  }

  // Confirm the chosen user actually exists before we trust the FK.
  const captainUser = await db.query.users.findFirst({ where: eq(users.id, captainUserIdInt) });
  if (!captainUser) {
    return NextResponse.json({ error: 'Captain user not found.' }, { status: 404 });
  }

  // captain_password is a legacy column we no longer read or hand out — but the live
  // DB may still have it as NOT NULL until migration 0019 lands. Stuff a random byte
  // string in regardless so the insert succeeds on either schema. The column is
  // strictly inert; no auth flow consults it anymore.
  const placeholderPassword = crypto.randomBytes(16).toString('hex');

  const [team] = await db.insert(teams).values({
    eventId: id,
    name,
    color,
    captainPassword: placeholderPassword,
    captainUserId: captainUserIdInt,
  }).returning();

  const { captainPassword: _, ...safeTeam } = team;
  return NextResponse.json(safeTeam, { status: 201 });
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
  const teamId = searchParams.get('teamId');

  if (!teamId) {
    return NextResponse.json({ error: 'teamId query parameter required' }, { status: 400 });
  }

  const tId = parseInt(teamId, 10);

  await db.delete(teams).where(and(eq(teams.id, tId), eq(teams.eventId, eId)));

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  const { teamId, name } = await request.json();

  if (!teamId) {
    return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
  }

  // Check auth: admin or captain of this team
  const isAdmin = await verifyAdmin();
  const captain = await verifyCaptain();

  if (!isAdmin && (!captain || captain.teamId !== teamId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify team belongs to this event
  const team = await db.query.teams.findFirst({
    where: and(eq(teams.id, teamId), eq(teams.eventId, eId)),
  });
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // Check if event has started
  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });
  const now = new Date();
  const eventStarted = event?.startDate && new Date(event.startDate) <= now;

  const updateData: { name?: string } = {};
  if (name && typeof name === 'string' && name.trim()) {
    if (eventStarted) {
      return NextResponse.json({ error: 'Cannot change team name after event has started' }, { status: 400 });
    }
    updateData.name = name.trim();
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const [updated] = await db
    .update(teams)
    .set(updateData)
    .where(eq(teams.id, teamId))
    .returning();

  const { captainPassword: _, ...safeTeam } = updated;
  return NextResponse.json(safeTeam);
}

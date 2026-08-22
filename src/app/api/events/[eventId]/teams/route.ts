import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db';
import { teams, events, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyAdmin, verifyCaptain } from '@/lib/auth';
import { updateTeamDiscordIdentity } from '@/lib/discord-teams';
import { captainSeatNotice, placeCaptainOnTeam } from '@/lib/teamCaptain';
import { assertEventEditable } from '@/lib/eventLock';

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
  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(id);
  if (lockedResponse) return lockedResponse;

  // Teams are part of the draft setup — once the draft is underway (or done) the team
  // set is frozen so the snake order stays valid. Adding a team mid-draft would leave it
  // out of the rotation; the admin must reset the draft to change teams.
  const eventRow = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!eventRow) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (eventRow.draftStatus !== 'none') {
    return NextResponse.json(
      { error: 'Teams are locked once the draft starts. Reset the draft to change teams.' },
      { status: 409 },
    );
  }

  const { name, color, captainUserId } = await request.json();

  if (!name || !color) {
    return NextResponse.json({ error: 'Name and color are required' }, { status: 400 });
  }

  // Unique within the event (case-insensitive) — duplicates make the scoreboard,
  // Discord roles and draft board ambiguous.
  const siblings = await db.query.teams.findMany({ where: eq(teams.eventId, id) });
  if (siblings.some((t) => t.name.trim().toLowerCase() === String(name).trim().toLowerCase())) {
    return NextResponse.json({ error: `A team named "${String(name).trim()}" already exists in this event.` }, { status: 409 });
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

  // Seat the captain on their own team (if they're a contestant in this event) so they show
  // in the roster and don't sit in the draft pool waiting to be picked onto themselves. When that
  // can't happen the team is still created — the reason rides back with it, because a captain who
  // was quietly not entered finds out by being told to go and sign up.
  const seat = await placeCaptainOnTeam(id, team.id, captainUserIdInt);

  // If a draft order was already saved, fold the new team in (at the end) so the order
  // never silently drops teams created after it was first set.
  if (eventRow.draftOrder) {
    try {
      const order: number[] = JSON.parse(eventRow.draftOrder);
      const validIds = new Set(siblings.map((t) => t.id));
      const nextOrder = [...order.filter((tid) => validIds.has(tid)), team.id];
      await db.update(events).set({ draftOrder: JSON.stringify(nextOrder) }).where(eq(events.id, id));
    } catch {
      // Unparseable legacy value — leave it; set-order will overwrite it.
    }
  }

  const { captainPassword: _, ...safeTeam } = team;
  return NextResponse.json({ ...safeTeam, captainNotice: captainSeatNotice(seat) }, { status: 201 });
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
  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('teamId');

  if (!teamId) {
    return NextResponse.json({ error: 'teamId query parameter required' }, { status: 400 });
  }

  const tId = parseInt(teamId, 10);

  // Same freeze as team creation: deleting a team mid-draft bricks the snake order
  // (the next pick references a team that no longer exists). Reset the draft first.
  const eventRow = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (eventRow && eventRow.draftStatus !== 'none') {
    return NextResponse.json(
      { error: 'Teams are locked once the draft starts. Reset the draft to remove a team.' },
      { status: 409 },
    );
  }

  await db.delete(teams).where(and(eq(teams.id, tId), eq(teams.eventId, eId)));

  // Scrub the deleted team from any saved draft order — otherwise the order keeps a
  // ghost id and the setup UI reports "order set" while missing real teams.
  if (eventRow?.draftOrder) {
    try {
      const order: number[] = JSON.parse(eventRow.draftOrder);
      const nextOrder = order.filter((id) => id !== tId);
      await db
        .update(events)
        .set({ draftOrder: nextOrder.length > 0 ? JSON.stringify(nextOrder) : null })
        .where(eq(events.id, eId));
    } catch {
      // Unparseable legacy value — leave it; set-order will overwrite it.
    }
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;
  const { teamId, name, color, captainUserId } = await request.json();

  if (!teamId) {
    return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
  }

  // Check auth: admin or captain of this team
  const isAdmin = await verifyAdmin();
  const captain = isAdmin ? null : await verifyCaptain();

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

  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });
  const now = new Date();
  const eventStarted = event?.startDate && new Date(event.startDate) <= now;

  // Captains may rebrand their team only in the window between the draft wrapping up and
  // the event going live — before that the roster isn't theirs yet, after that renames
  // would churn scoreboards mid-game. Admins can edit any time.
  if (!isAdmin) {
    if (event?.draftStatus !== 'completed') {
      return NextResponse.json(
        { error: 'Team name and color open up once the draft is finalized.' },
        { status: 403 },
      );
    }
    if (eventStarted) {
      return NextResponse.json(
        { error: 'Team name and color are locked once the event starts.' },
        { status: 403 },
      );
    }
  }

  const updateData: { name?: string; color?: string; captainUserId?: number } = {};
  if (captainUserId !== undefined) {
    // Reassigning the captain seat is an admin call — captains can rebrand, not hand off.
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can change the team captain.' }, { status: 403 });
    }
    if (typeof captainUserId !== 'number' || !Number.isFinite(captainUserId) || captainUserId <= 0) {
      return NextResponse.json({ error: 'captainUserId must be a user id.' }, { status: 400 });
    }
    const captainUser = await db.query.users.findFirst({ where: eq(users.id, captainUserId) });
    if (!captainUser) {
      return NextResponse.json({ error: 'Captain user not found.' }, { status: 404 });
    }
    updateData.captainUserId = captainUserId;
  }
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 50) {
      return NextResponse.json({ error: 'Team name must be 1–50 characters.' }, { status: 400 });
    }
    updateData.name = name.trim();
  }
  if (color !== undefined) {
    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color.trim())) {
      return NextResponse.json({ error: 'Color must be a hex value like #d4af37.' }, { status: 400 });
    }
    updateData.color = color.trim().toLowerCase();
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Team names stay unique within the event (case-insensitive) — duplicate names make the
  // scoreboard, Discord roles and draft board ambiguous.
  if (updateData.name && updateData.name.toLowerCase() !== team.name.toLowerCase()) {
    const siblings = await db.query.teams.findMany({ where: eq(teams.eventId, eId) });
    if (siblings.some((t) => t.id !== teamId && t.name.trim().toLowerCase() === updateData.name!.toLowerCase())) {
      return NextResponse.json({ error: `A team named "${updateData.name}" already exists in this event.` }, { status: 409 });
    }
  }

  const [updated] = await db
    .update(teams)
    .set(updateData)
    .where(eq(teams.id, teamId))
    .returning();

  // If the captain seat changed, seat the new captain on this team (same rule as create —
  // only when they're an unassigned contestant in the event).
  let captainNotice: string | null = null;
  if (updateData.captainUserId != null && updateData.captainUserId !== team.captainUserId) {
    captainNotice = captainSeatNotice(await placeCaptainOnTeam(eId, teamId, updateData.captainUserId));
  }

  // Mirror the rebrand onto Discord (role name/color + channel names) — fire-and-forget,
  // the site edit must not fail on a Discord hiccup.
  updateTeamDiscordIdentity(teamId).catch(() => {});

  const { captainPassword: _, ...safeTeam } = updated;
  return NextResponse.json({ ...safeTeam, captainNotice });
}

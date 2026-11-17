import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { teams } from '@/db/schema';
import { verifyAdmin, verifyCaptain, verifyUser, resolveTeamMembership } from '@/lib/auth';
import { eventForRequest } from '@/lib/eventScope';
import { refundLifeline, spendLifeline, teamEaseView } from '@/lib/raceEaseDb';
import { mayPickRoad } from '@/lib/raceRoutesDb';

// Tile race lifelines and easier options (events.rules.raceLifelines / raceEase, lib/raceEase).
//   GET    ?teamId=          — what the team's board shows: per tile, the easier options live for it,
//                              how many are still locked, and whether a lifeline can be spent there.
//   POST   { teamId, tileId } — spend a lifeline on a tile. The team's captain / staff seat, or any
//                              member of a team with neither (the same people who pick a road). Final.
//   DELETE { teamId, tileId } — an admin gives one back.

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await request.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** May this caller act for the team (spend), and may they read its view (any member)? */
async function teamAccess(eventId: number, teamId: number): Promise<{ read: boolean; spend: boolean; userId: number | null }> {
  const user = await verifyUser();
  const captain = await verifyCaptain();
  const admin = await verifyAdmin();
  let spend = !!admin || (!!captain && captain.teamId === teamId);
  let read = spend;
  if (user && !spend) {
    const membership = await resolveTeamMembership(eventId, teamId);
    const isMember = membership?.playerId != null;
    read = isMember;
    spend = await mayPickRoad(teamId, user.userId, isMember);
    read = read || spend;
  }
  return { read, spend, userId: user?.userId ?? null };
}

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  const event = await eventForRequest(request, eId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const teamId = Number(new URL(request.url).searchParams.get('teamId'));
  const empty = { tiles: {}, lifelines: null, canSpend: false };
  if (event.format !== 'tilerace' || !Number.isInteger(teamId)) return NextResponse.json(empty);
  const team = await db.query.teams.findFirst({ where: and(eq(teams.id, teamId), eq(teams.eventId, eId)) });
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  const access = await teamAccess(eId, teamId);
  // A team's lifelines and what they opened are the team's own business.
  if (!access.read) return NextResponse.json(empty);
  const view = await teamEaseView(event, teamId);
  if (!view) return NextResponse.json(empty);
  return NextResponse.json(
    { tiles: Object.fromEntries(view.tiles), lifelines: view.lifelines, canSpend: access.spend },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  const event = await eventForRequest(request, eId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await readBody(request);
  const teamId = Number(body?.teamId);
  const tileId = Number(body?.tileId);
  if (!Number.isInteger(teamId) || !Number.isInteger(tileId)) {
    return NextResponse.json({ error: 'teamId and tileId are required' }, { status: 400 });
  }
  const team = await db.query.teams.findFirst({ where: and(eq(teams.id, teamId), eq(teams.eventId, eId)) });
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  const access = await teamAccess(eId, teamId);
  if (!access.spend) {
    return NextResponse.json(
      { error: access.userId != null ? 'Your team’s captain decides when to use a lifeline.' : 'Unauthorized' },
      { status: access.userId != null ? 403 : 401 },
    );
  }
  const r = await spendLifeline(event, teamId, tileId, access.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, opened: r.opened });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  if (!(await eventForRequest(request, eId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Only an admin can give a lifeline back.' }, { status: 403 });
  const body = await readBody(request);
  const teamId = Number(body?.teamId);
  const tileId = Number(body?.tileId);
  if (!Number.isInteger(teamId) || !Number.isInteger(tileId)) {
    return NextResponse.json({ error: 'teamId and tileId are required' }, { status: 400 });
  }
  const team = await db.query.teams.findFirst({ where: and(eq(teams.id, teamId), eq(teams.eventId, eId)) });
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  return NextResponse.json({ ok: await refundLifeline(eId, teamId, tileId) });
}

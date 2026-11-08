import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { teams } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { verifyAdmin, verifyCaptain, verifyUser, resolveTeamMembership } from '@/lib/auth';
import { clearRaceRoadPick, mayPickRoad, pickRaceRoad } from '@/lib/raceRoutesDb';
import { loadRacePicks } from '@/lib/raceRoutePicks';
import { parseEventRules } from '@/lib/eventRules';

// "Choose and lock in" tile races (events.rules.raceRoad = 'choose', lib/raceRoutes): a team picks
// its road at a fork before any tile there counts.
//   POST   { teamId, tileId } — the team's captain / staff seat (any member without one) picks. Final.
//   DELETE { teamId, step }   — an admin resets a pick.

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await request.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// GET ?teamId= — the race's road mode, the team's picks, and whether the caller may pick for it.
export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  const event = await eventForRequest(request, eId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const mode = parseEventRules(event.rules).raceRoad;
  const teamId = Number(new URL(request.url).searchParams.get('teamId'));
  if (mode !== 'choose' || !Number.isInteger(teamId)) return NextResponse.json({ mode, picks: {}, canPick: false });
  const team = await db.query.teams.findFirst({ where: and(eq(teams.id, teamId), eq(teams.eventId, eId)) });
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  const picks = (await loadRacePicks(event, teamId)) ?? new Map<number, number>();
  const user = await verifyUser();
  const captain = await verifyCaptain();
  let canPick = (await verifyAdmin()) || (!!captain && captain.teamId === teamId);
  if (!canPick && user) {
    const membership = await resolveTeamMembership(eId, teamId);
    canPick = await mayPickRoad(teamId, user.userId, membership?.playerId != null);
  }
  return NextResponse.json({ mode, picks: Object.fromEntries(picks), canPick });
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  const scoped = await eventForRequest(request, eId);
  if (!scoped) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await readBody(request);
  const teamId = Number(body?.teamId);
  const tileId = Number(body?.tileId);
  if (!Number.isInteger(teamId) || !Number.isInteger(tileId)) {
    return NextResponse.json({ error: 'teamId and tileId are required' }, { status: 400 });
  }
  const team = await db.query.teams.findFirst({ where: and(eq(teams.id, teamId), eq(teams.eventId, eId)) });
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const user = await verifyUser();
  const isAdmin = await verifyAdmin();
  const captain = await verifyCaptain();
  let allowed = isAdmin || (!!captain && captain.teamId === teamId);
  if (!allowed && user) {
    const membership = await resolveTeamMembership(eId, teamId);
    allowed = await mayPickRoad(teamId, user.userId, membership?.playerId != null);
  }
  if (!allowed) {
    return NextResponse.json({ error: user ? 'Your team’s captain picks the road.' : 'Unauthorized' }, { status: user ? 403 : 401 });
  }
  const event = scoped;
  const r = await pickRaceRoad(event, teamId, tileId, user?.userId ?? null);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  if (!(await eventForRequest(request, eId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Only an admin can reset a road pick.' }, { status: 403 });
  const body = await readBody(request);
  const teamId = Number(body?.teamId);
  const step = Number(body?.step);
  if (!Number.isInteger(teamId) || !Number.isInteger(step)) {
    return NextResponse.json({ error: 'teamId and step are required' }, { status: 400 });
  }
  const team = await db.query.teams.findFirst({ where: and(eq(teams.id, teamId), eq(teams.eventId, eId)) });
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  return NextResponse.json({ ok: await clearRaceRoadPick(teamId, step) });
}

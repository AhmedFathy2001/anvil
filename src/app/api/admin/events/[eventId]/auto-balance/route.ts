import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { events, eventParticipants, teams } from '@/db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { assertEventEditable } from '@/lib/eventLock';
import { buildDraftBalance, greedyAssignments, projectedStrengths } from '@/lib/draftBalance';

// POST — the "Balance teams" button: distribute everyone still in the pool across the existing
// teams by profile rating (greedy weakest-team-first; multi-account people move as one). Never
// touches players already on a team, so it composes with a partial manual assignment or runs the
// whole formation on its own (balanceMode 'auto'). Admin can still move people afterwards — this
// is a starting point, not a verdict.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }
  const lockedResponse = await assertEventEditable(id);
  if (lockedResponse) return lockedResponse;

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  // Mirrors the place-pool guard: the roster set is frozen once a snake draft is underway.
  if (event.draftStatus !== 'none') {
    return NextResponse.json(
      { error: 'Teams are locked once the draft starts. Reset the draft first, or use the draft itself.' },
      { status: 409 },
    );
  }

  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, id));
  if (eventTeams.length < 2) {
    return NextResponse.json({ error: 'Create at least two teams to balance into.' }, { status: 400 });
  }

  const balance = await buildDraftBalance(clan.id, id);
  const teamIds = eventTeams.map((t) => t.id);
  const assignments = greedyAssignments(balance, teamIds);
  if (assignments.length === 0) {
    return NextResponse.json({ error: 'Nobody is waiting in the pool.' }, { status: 400 });
  }

  for (const a of assignments) {
    await db
      .update(eventParticipants)
      .set({ teamId: a.teamId })
      .where(and(inArray(eventParticipants.id, a.playerIds), eq(eventParticipants.eventId, id), isNull(eventParticipants.teamId)));
    const profile = balance.byPlayerId.get(a.playerIds[0]);
    if (profile) profile.teamId = a.teamId; // keep the in-memory strengths honest for the summary
  }

  const strengths = projectedStrengths(balance, teamIds);
  const teamName = new Map(eventTeams.map((t) => [t.id, t.name]));
  const summary = [...strengths.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([teamId, strength]) => ({ teamId, teamName: teamName.get(teamId) ?? String(teamId), strength }));
  const max = summary[0]?.strength ?? 0;
  const min = summary[summary.length - 1]?.strength ?? 0;

  return NextResponse.json({
    placed: assignments.length,
    assignments: assignments.map((a) => ({ rsn: a.rsn, teamId: a.teamId, teamName: teamName.get(a.teamId) })),
    projected: summary,
    spreadPct: max > 0 ? Math.round(((max - min) / max) * 100) : 0,
  });
}

import { NextResponse } from 'next/server';
import { competitionForRequest } from '@/lib/eventScope';
import { verifyAdminOrModerator } from '@/lib/auth';
import { db } from '@/db';
import { playerSnapshots, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const compId = parseInt(id, 10);

  const comp = await competitionForRequest(request, compId).then((c) => (c ? [c] : []));
  if (comp.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const participants = await db.select().from(weeklyParticipants).where(eq(weeklyParticipants.competitionId, compId));

  const participantCount = participants.length;

  return NextResponse.json({ ...comp[0], participantCount, participants });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const compId = parseInt(id, 10);

  // WHOSE COMPETITION IS THIS? Ids are global and this one came from the URL. GET four lines up has
  // asked since the multi-clan conversion; this did not, so a moderator of any clan could rename or
  // re-date any other clan's week by guessing an id. The role check above is satisfied by being
  // staff SOMEWHERE, which is exactly the gap the scope guard closes.
  if (!(await competitionForRequest(request, compId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { title, startDate, endDate, status } = await request.json();

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (startDate !== undefined) updates.startDate = startDate;
  if (endDate !== undefined) updates.endDate = endDate;
  if (status !== undefined) updates.status = status;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await db.update(weeklyCompetitions).set(updates).where(eq(weeklyCompetitions.id, compId));

  const updated = await db.select().from(weeklyCompetitions).where(eq(weeklyCompetitions.id, compId));
  if (updated.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(updated[0]);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const compId = parseInt(id, 10);

  // Same guard, and it matters more here: unscoped, this deleted another clan's competition along
  // with every participant row and player snapshot hanging off it.
  if (!(await competitionForRequest(request, compId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Delete children explicitly — the schema declares ON DELETE CASCADE, but the live
  // tables predate the squashed migration baseline and may not carry it, which made
  // this delete fail with a foreign-key error.
  try {
    await db.delete(playerSnapshots).where(eq(playerSnapshots.weeklyCompetitionId, compId));
    await db.delete(weeklyParticipants).where(eq(weeklyParticipants.competitionId, compId));
    await db.delete(weeklyCompetitions).where(eq(weeklyCompetitions.id, compId));
  } catch (err) {
    return NextResponse.json({ error: `Delete failed: ${err instanceof Error ? err.message : 'unknown error'}` }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';
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

  const comp = await db.select().from(weeklyCompetitions).where(eq(weeklyCompetitions.id, compId));
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

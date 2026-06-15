import { NextResponse } from 'next/server';
import { normalizeRsn, sanitizeRsn, verifyAdminOrModerator } from '@/lib/auth';
import { db } from '@/db';
import { weeklyParticipants } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { findOrCreateClanMember } from '@/lib/clan';

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

  const participants = await db.select().from(weeklyParticipants)
    .where(eq(weeklyParticipants.competitionId, compId));

  return NextResponse.json(participants);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const compId = parseInt(id, 10);
  const { rsns } = await request.json();

  if (!Array.isArray(rsns) || rsns.length === 0) {
    return NextResponse.json({ error: 'rsns array is required' }, { status: 400 });
  }

  let added = 0;
  for (const rsn of rsns) {
    if (typeof rsn !== 'string') continue;
    const trimmed = sanitizeRsn(rsn);
    if (!trimmed) continue;
    try {
      const clanMemberId = await findOrCreateClanMember(trimmed);
      await db.insert(weeklyParticipants).values({
        competitionId: compId,
        clanMemberId,
        rsn: trimmed,
        rsnNormalized: normalizeRsn(trimmed),
      }).onConflictDoNothing();
      added++;
    } catch {
      // Skip on error
    }
  }

  return NextResponse.json({ added });
}

// Manually correct a participant's baseline. Used to fix the stale-baseline overcount
// (player grinding across the comp start while logged in — see src/lib/gainsValidation.ts).
// Setting baseline to the current value zeroes out the bogus pre-event gain and counts
// only future progress, which mirrors how WOM treats a fresh post-logout snapshot.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const compId = parseInt(id, 10);
  const { participantId, baselineValue } = await request.json();

  if (typeof participantId !== 'number' || !Number.isInteger(participantId)) {
    return NextResponse.json({ error: 'participantId (number) is required' }, { status: 400 });
  }
  if (typeof baselineValue !== 'number' || !Number.isFinite(baselineValue) || baselineValue < 0) {
    return NextResponse.json({ error: 'baselineValue must be a non-negative number' }, { status: 400 });
  }

  const updated = await db
    .update(weeklyParticipants)
    .set({ baselineValue: Math.round(baselineValue), flagged: 0, flagReason: null })
    .where(and(eq(weeklyParticipants.id, participantId), eq(weeklyParticipants.competitionId, compId)))
    .returning({ id: weeklyParticipants.id });

  if (updated.length === 0) {
    return NextResponse.json({ error: 'Participant not found in this competition' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';
import { verifyAdminOrModerator } from '@/lib/auth';
import { db } from '@/db';
import { weeklyParticipants } from '@/db/schema';
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
    if (typeof rsn !== 'string' || !rsn.trim()) continue;
    try {
      await db.insert(weeklyParticipants).values({
        competitionId: compId,
        rsn: rsn.trim(),
      }).onConflictDoNothing();
      added++;
    } catch {
      // Skip on error
    }
  }

  return NextResponse.json({ added });
}

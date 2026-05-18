import { NextResponse } from 'next/server';
import { verifyAdminOrModerator } from '@/lib/auth';
import { db } from '@/db';
import { weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchParticipantStat } from '@/lib/weekly';

// Sequential hiscores fetch for every participant — easily over a minute. Default
// Vercel function timeout is 15 s (Pro) / 10 s (Hobby), so without this the admin
// "Refresh" button gets killed mid-loop.
export const maxDuration = 300;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const comp = await db.select().from(weeklyCompetitions).where(eq(weeklyCompetitions.id, compId));
  if (comp.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const participants = await db.select().from(weeklyParticipants)
    .where(eq(weeklyParticipants.competitionId, compId));

  let updated = 0;
  const errors: string[] = [];

  for (const p of participants) {
    try {
      const value = await fetchParticipantStat(p.rsn, comp[0].type as 'skill' | 'boss', comp[0].metric);
      const nowIso = new Date().toISOString();
      if (value !== null) {
        const updates: Record<string, unknown> = {
          currentValue: value,
          lastUpdated: nowIso,
        };
        // Set baseline on first fetch
        if (p.baselineValue === null) {
          updates.baselineValue = value;
        }
        await db.update(weeklyParticipants).set(updates).where(eq(weeklyParticipants.id, p.id));
        updated++;
      } else {
        // Bump lastUpdated on failure so this row stops occupying the head of the cron's
        // `ORDER BY lastUpdated ASC NULLS FIRST` queue.
        await db.update(weeklyParticipants)
          .set({ lastUpdated: nowIso })
          .where(eq(weeklyParticipants.id, p.id));
        errors.push(`No data for ${p.rsn}`);
      }
    } catch {
      errors.push(`Failed to fetch ${p.rsn}`);
    }
    await delay(1200);
  }

  return NextResponse.json({ updated, total: participants.length, errors });
}

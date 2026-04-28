import { NextResponse } from 'next/server';
import { db } from '@/db';
import { weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { fetchParticipantStat } from '@/lib/weekly';

const CRON_SECRET = process.env.CRON_SECRET;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' && !CRON_SECRET) {
    return NextResponse.json(
      { error: 'Server misconfigured: CRON_SECRET is required in production' },
      { status: 500 },
    );
  }
  const authHeader = request.headers.get('authorization');
  const hasValidSecret = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  const devBypass = !CRON_SECRET && request.headers.get('x-vercel-cron') === '1';
  if (!hasValidSecret && !devBypass) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();
  const results: {
    competitionId: number;
    title: string;
    participantsUpdated: number;
    errors: string[];
  }[] = [];

  // Update competition statuses based on dates
  const allComps = await db.select().from(weeklyCompetitions);

  for (const comp of allComps) {
    if (comp.status === 'upcoming' && comp.startDate <= now) {
      const newStatus = comp.endDate <= now ? 'completed' : 'active';
      await db.update(weeklyCompetitions)
        .set({ status: newStatus })
        .where(eq(weeklyCompetitions.id, comp.id));
      comp.status = newStatus;
    } else if (comp.status === 'active' && comp.endDate <= now) {
      await db.update(weeklyCompetitions)
        .set({ status: 'completed' })
        .where(eq(weeklyCompetitions.id, comp.id));
      comp.status = 'completed';
    }
  }

  // Process active competitions
  const activeComps = allComps.filter((c) => c.status === 'active');

  for (const comp of activeComps) {
    const compResult = {
      competitionId: comp.id,
      title: comp.title,
      participantsUpdated: 0,
      errors: [] as string[],
    };

    // Get participants sorted by oldest lastUpdated first (null = never updated = highest priority)
    const participants = await db.select().from(weeklyParticipants)
      .where(eq(weeklyParticipants.competitionId, comp.id))
      .orderBy(asc(weeklyParticipants.lastUpdated));

    // Cap at 40 participants per run to stay within timeout budget
    const batch = participants.slice(0, 40);

    for (const p of batch) {
      try {
        const value = await fetchParticipantStat(p.rsn, comp.type as 'skill' | 'boss', comp.metric);
        if (value !== null) {
          const updates: Record<string, unknown> = {
            currentValue: value,
            lastUpdated: new Date().toISOString(),
          };
          // Set baseline on first fetch
          if (p.baselineValue === null) {
            updates.baselineValue = value;
          }
          await db.update(weeklyParticipants).set(updates).where(eq(weeklyParticipants.id, p.id));
          compResult.participantsUpdated++;
        } else {
          compResult.errors.push(`No data for ${p.rsn}`);
        }
      } catch {
        compResult.errors.push(`Failed: ${p.rsn}`);
      }
      await delay(1200);
    }

    results.push(compResult);
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    activeCompetitions: activeComps.length,
    results,
  });
}

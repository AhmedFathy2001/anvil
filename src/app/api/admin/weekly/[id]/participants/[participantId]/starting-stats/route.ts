import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { weeklyParticipants } from '@/db/schema';
import { verifyAdminOrModerator } from '@/lib/auth';
import { competitionForRequest } from '@/lib/eventScope';
import { rateLimitByKey } from '@/lib/rate-limit';
import { captureWeeklyStartingStatsSoon } from '@/lib/startingStats';
import { shouldCaptureWeeklyNow } from '@/lib/startingStatsRules';

// "Try again" on a weekly participant whose starting stats could not be read (lib/startingStats).
// Same staff guard as the rest of the weekly roster; throttled per participant.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  if (!(await verifyAdminOrModerator())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, participantId } = await params;
  const compId = parseInt(id, 10);
  const pId = parseInt(participantId, 10);
  if (!Number.isFinite(compId) || !Number.isFinite(pId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Whose competition is this? The id came from the URL.
  const comp = await competitionForRequest(request, compId);
  if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const row = await db.query.weeklyParticipants.findFirst({
    where: and(eq(weeklyParticipants.id, pId), eq(weeklyParticipants.competitionId, compId)),
  });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!shouldCaptureWeeklyNow(comp, row, Date.now())) return NextResponse.json({ ok: true, queued: false });

  const limit = await rateLimitByKey('weekly-starting-stats', String(pId), { limit: 3, windowMs: 5 * 60_000 });
  if (!limit.ok) return NextResponse.json({ error: 'Already trying — give it a couple of minutes.' }, { status: 429 });

  captureWeeklyStartingStatsSoon(compId, [pId]);
  return NextResponse.json({ ok: true, queued: true }, { status: 202 });
}

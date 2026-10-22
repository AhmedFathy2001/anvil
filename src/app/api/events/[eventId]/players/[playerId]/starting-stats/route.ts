import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { eventParticipants, events } from '@/db/schema';
import { verifyAdmin } from '@/lib/auth';
import { eventForRequest } from '@/lib/eventScope';
import { assertEventEditable } from '@/lib/eventLock';
import { rateLimitByKey } from '@/lib/rate-limit';
import { captureStartingStatsSoon } from '@/lib/startingStats';
import { shouldCaptureNow } from '@/lib/startingStatsRules';

// "Try again" on a late joiner whose starting stats could not be read (lib/startingStats). One
// player, after the response, through the same capture every add path uses — so it obeys the same
// rules: nothing before the start, nothing for somebody who already has a start line. Throttled per
// player so the button can't become a hiscores hammer.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string; playerId: string }> },
) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { eventId, playerId } = await params;
  const eId = parseInt(eventId, 10);
  const pId = parseInt(playerId, 10);
  if (!Number.isFinite(eId) || !Number.isFinite(pId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;

  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  const player = await db.query.eventParticipants.findFirst({
    where: and(eq(eventParticipants.id, pId), eq(eventParticipants.eventId, eId)),
  });
  if (!event || !player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  if (!shouldCaptureNow(event, player, Date.now())) {
    return NextResponse.json({ ok: true, queued: false });
  }

  const limit = await rateLimitByKey('starting-stats', String(pId), { limit: 3, windowMs: 5 * 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Already trying — give it a couple of minutes.' }, { status: 429 });
  }

  captureStartingStatsSoon(eId, [pId]);
  return NextResponse.json({ ok: true, queued: true }, { status: 202 });
}

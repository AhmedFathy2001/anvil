import { NextResponse } from 'next/server';

import { verifyEventTreasurer } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { getClanFeatures } from '@/lib/clanFeatures';
import { eventForRequest, type ScopedEvent } from '@/lib/eventScope';
import { cooldownRemainingMs } from '@/lib/feeReminderText';
import { lastFeeReminder, remindUnpaidFees, unpaidFeeRecipients } from '@/lib/feeReminders';

/**
 * "Remind unpaid" on Admin → Fees: DM everyone on this event who still owes an entry fee.
 *
 * GET previews it (how many people would be messaged, and whether the cooldown is still running),
 * so the confirm can name the number. POST sends it. Both are treasurer authority — a clan
 * treasurer, an admin, or this board's own treasurer (verifyEventTreasurer) — and both resolve the
 * event through THIS clan first: ids are global, and an unscoped route would let any clan's
 * treasurer DM another clan's sign-ups.
 */
async function guard(
  request: Request,
  params: Promise<{ eventId: string }>,
): Promise<{ error: NextResponse } | { event: ScopedEvent; userId: number }> {
  const id = parseInt((await params).eventId, 10);
  if (!Number.isFinite(id)) return { error: NextResponse.json({ error: 'Invalid event id' }, { status: 400 }) };
  // Whose event is this? Ids are global and this one came from the URL.
  const event = await eventForRequest(request, id);
  if (!event) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const session = await verifyEventTreasurer(id);
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!(await getClanFeatures(event.clanId)).on('fees')) {
    return { error: NextResponse.json({ error: 'Fees are switched off for this clan.' }, { status: 404 }) };
  }
  return { event, userId: session.userId };
}

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const g = await guard(request, params);
  if ('error' in g) return g.error;
  const now = Date.now();
  const [{ recipients, unreachable }, last] = await Promise.all([
    unpaidFeeRecipients(g.event.id),
    lastFeeReminder(g.event.clanId, g.event.id, now),
  ]);
  return NextResponse.json({
    people: recipients.length,
    unreachable,
    waitMs: cooldownRemainingMs(last, now),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const g = await guard(request, params);
  if ('error' in g) return g.error;
  const clan = await requireClan();
  if (clan.id !== g.event.clanId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const result = await remindUnpaidFees({
    clan: { id: clan.id, name: clan.name, slug: clan.slug, kind: clan.kind },
    event: { id: g.event.id, name: g.event.name },
    actorUserId: g.userId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, waitMs: result.waitMs }, { status: result.status });
  }
  return NextResponse.json(result);
}

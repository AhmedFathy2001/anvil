import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { events, payouts } from '@/db/schema';
import { requireTeamManager } from '@/lib/teamStaff';
import { allPayoutsPaid, announcePayouts } from '@/lib/payouts';

/**
 * A co-host settles its OWN team's winnings.
 *
 * Only under `each-settles` — that's the policy where each clan pays its own members, so its team
 * manager marks its own payouts paid, exactly as it already marks its own players' fees. Under the
 * other policies the host holds the pot and pays everyone, so this refuses and the host's own payout
 * screen is the place. Scoped hard: the payout must belong to THIS team.
 */
export async function POST(request: Request, { params }: { params: Promise<{ teamId: string; payoutId: string }> }) {
  const { teamId, payoutId } = await params;
  const tId = parseInt(teamId, 10);
  const id = parseInt(payoutId, 10);
  if (!Number.isFinite(tId) || !Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const guard = await requireTeamManager(tId);
  if ('response' in guard) return guard.response;
  const { management } = guard;

  const payout = await db.query.payouts.findFirst({ where: and(eq(payouts.id, id), eq(payouts.eventId, management.eventId)) });
  if (!payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
  if (payout.teamId !== tId) return NextResponse.json({ error: 'That payout is not your team’s' }, { status: 403 });

  // clan-scope: global -- the event this managed team belongs to, by id; the cash policy lives on it.
  const event = await db.query.events.findFirst({ where: eq(events.id, management.eventId) });
  if (event?.cashPolicy !== 'each-settles') {
    return NextResponse.json({ error: 'The host holds the pot for this event — they pay the winners.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { proofUrl?: string; notes?: string } | null;
  const proofUrl = typeof body?.proofUrl === 'string' && body.proofUrl ? body.proofUrl : null;

  const [updated] = await db
    .update(payouts)
    .set({
      status: 'paid',
      paidByUserId: management.userId,
      paidAt: new Date().toISOString(),
      proofBlobUrl: proofUrl ?? payout.proofBlobUrl,
      notes: body?.notes ?? payout.notes,
    })
    .where(eq(payouts.id, id))
    .returning();

  // Same auto-announce as the host path: once the whole event is settled, post the winners once.
  let announced = false;
  if (event && !event.payoutsAnnouncedAt && (await allPayoutsPaid(management.eventId))) {
    announced = await announcePayouts(management.eventId).catch(() => false);
  }

  return NextResponse.json({ payout: updated, announced });
}

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { weeklyCompetitions } from '@/db/schema';
import { verifyFeeCollector } from '@/lib/auth';
import { competitionForRequest } from '@/lib/eventScope';
import { getCofferBalance } from '@/lib/coffer';
import { parseWeeklyPrizes, serializeWeeklyPrizes, totalPrizeGp } from '@/lib/weeklyPrizes';

/**
 * The coffer prize ladder on a Skill or Boss of the Week.
 *
 * Its own route rather than a field on PUT /api/admin/weekly/[id], because that one answers to
 * `verifyAdminOrModerator` and this is the clan's money. A moderator may rename a competition and
 * move its dates; deciding it pays 500m is the treasurer's call, the same grant that adjusts the
 * ledger and collects the fees.
 *
 * GET also returns the coffer balance, since the only question a host has while writing a ladder is
 * whether the clan can cover it.
 */

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyFeeCollector())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const compId = parseInt(id, 10);
  const comp = await competitionForRequest(request, compId);
  if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const balance = await getCofferBalance(comp.clanId);
  return NextResponse.json({
    prizes: parseWeeklyPrizes(comp.prizes),
    settledAt: comp.prizesSettledAt,
    balance,
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyFeeCollector())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const compId = parseInt(id, 10);
  // Whose competition is this? The id came from the URL, and ids are global.
  const comp = await competitionForRequest(request, compId);
  if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Once the prizes are settled the ladder is history: the awards are on the ledger, and editing
  // what they were paid for would leave the two disagreeing with nothing to say which is true.
  if (comp.prizesSettledAt) {
    return NextResponse.json(
      { error: 'This competition has already paid out. Adjust the ledger on the coffer page instead.' },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    places?: unknown;
    payZeroGain?: unknown;
    splitTies?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const places = Array.isArray(body.places)
    ? body.places.map((p) => ({ gp: Math.max(0, Math.floor(Number((p as { gp?: unknown })?.gp) || 0)) }))
    : [];
  // Round-tripped through the parser so the stored blob is exactly what the settle pass will read:
  // clamped, trailing empty places dropped, nonsense discarded.
  const prizes = parseWeeklyPrizes(
    JSON.stringify({ places, payZeroGain: body.payZeroGain === true, splitTies: body.splitTies === true }),
  );

  await db
    .update(weeklyCompetitions)
    .set({ prizes: serializeWeeklyPrizes(prizes) })
    .where(eq(weeklyCompetitions.id, compId));

  const balance = await getCofferBalance(comp.clanId);
  return NextResponse.json({ prizes, total: totalPrizeGp(prizes), balance });
}

import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { eventSignups, signupFees } from '@/db/schema';
import { and, eq, ne, notInArray } from 'drizzle-orm';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { applyFeeConfirmation, getRequiredConfirmations, settlesOnCollect } from '@/lib/feeConfirmations';

/**
 * Sign off on every fee this admin is allowed to sign off on.
 *
 * The queue's natural end state is dozens of fees one person collected, each needing a second pair
 * of eyes — which was dozens of identical clicks for whoever helped. This does them in one action
 * WITHOUT loosening the rule: fees the caller collected themselves are excluded in the query, and
 * each one still goes through the same applyFeeConfirmation the single-fee route uses. An admin
 * can't confirm their own collections here any more than they could one at a time.
 *
 * Optional `eventId` scopes it to one event, so "close out the July bingo" doesn't also settle fees
 * for an event still running.
 */
export async function POST(request: Request) {
  const clan = await requireClan();
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let eventId: number | null = null;
  try {
    const body = (await request.json()) as { eventId?: unknown };
    const parsed = Number(body?.eventId);
    if (Number.isFinite(parsed) && parsed > 0) eventId = parsed;
  } catch {
    /* no body — every event */
  }

  // With no second signature required there is nobody to be separate from, so the caller's own
  // collections are settleable too — which is the only way a one-person treasury clears the
  // backlog it built up while the rule was in force.
  const noSignature = settlesOnCollect(await getRequiredConfirmations(clan.id));

  const scope = (forCaller: boolean) =>
    and(
      eq(signupFees.status, 'collected'),
      // Otherwise never the caller's own collections: separation of duties is the point of this step.
      ...(noSignature
        ? []
        : [
            forCaller
              ? eq(signupFees.collectedByUserId, session.userId)
              : ne(signupFees.collectedByUserId, session.userId),
          ]),
      // A withdrawn/rejected sign-up's fee is dead money, not something to settle.
      notInArray(eventSignups.status, ['withdrawn', 'rejected']),
      ...(eventId != null ? [eq(eventSignups.eventId, eventId)] : []),
    );

  const rows = await db
    .select({ id: signupFees.id })
    .from(signupFees)
    .innerJoin(eventSignups, eq(signupFees.signupId, eventSignups.id))
    .where(scope(false));

  let confirmed = 0;
  let recorded = 0;
  let skipped = 0;
  for (const row of rows) {
    // Sequentially: each call reads the fee, appends a vote and writes it back, so running them
    // concurrently would let two votes on the same fee overwrite each other.
    const result = await applyFeeConfirmation(row.id, session.userId);
    if (result.outcome === 'confirmed') confirmed++;
    else if (result.outcome === 'recorded') recorded++;
    else skipped++;
  }

  // How many are left that only SOMEONE ELSE can clear — the honest answer to "why isn't it zero?"
  // With no second signature required nothing is waiting on anyone else, and scope(true) would
  // match every collected fee, so reporting it would invent a blocker that doesn't exist.
  const mine = noSignature
    ? []
    : await db
        .select({ id: signupFees.id })
        .from(signupFees)
        .innerJoin(eventSignups, eq(signupFees.signupId, eventSignups.id))
        .where(scope(true));

  return NextResponse.json({ confirmed, recorded, skipped, awaitingOtherAdmin: mine.length });
}

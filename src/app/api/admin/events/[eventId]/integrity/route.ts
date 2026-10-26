import { NextResponse } from 'next/server';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accountStatSnapshots, accounts, clanMemberships, eventParticipants, integritySignals, submissions, tiles } from '@/db/schema';
import { verifyAdminOrModerator } from '@/lib/auth';
import { checkCreditIntegrity } from '@/lib/creditIntegrity';
import { eventForRequest } from '@/lib/eventScope';

/**
 * GET — which boss-kill credits on this board do not add up (lib/creditIntegrity): more kills than
 * the player's hiscores KC rose by, or more in an hour than the boss allows. A list for staff to look
 * at, never an automatic penalty. Also the per-player signals the footprint check raised
 * (lib/footprintCheck: first service kill, more hours than one person plays) that staff haven't
 * marked fine.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const eId = parseInt((await params).eventId, 10);
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!(await verifyAdminOrModerator())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const killTiles = await db
    .select({ id: tiles.id, title: tiles.label, targetNpcs: tiles.targetNpcs })
    .from(tiles)
    .where(and(eq(tiles.eventId, eId), eq(tiles.tileType, 'kill')));
  // clan-scope: this clan -- rows of the event eventForRequest settled above.
  const signals = await db
    .select({ id: integritySignals.id, kind: integritySignals.kind, detail: integritySignals.detail, playerId: integritySignals.participantId, rsn: eventParticipants.name })
    .from(integritySignals)
    .innerJoin(eventParticipants, eq(eventParticipants.id, integritySignals.participantId))
    .where(and(eq(integritySignals.eventId, eId), isNull(integritySignals.dismissedAt)));
  if (killTiles.length === 0) return NextResponse.json({ flags: [], signals });

  // The client that CLAIMED the kills (playerId, the uploader): the KC lives on that account, even
  // when the credit was handed to a teammate.
  const credits = await db
    .select({ playerId: submissions.playerId, tileId: submissions.tileId, amount: submissions.amount, createdAt: submissions.createdAt })
    .from(submissions)
    .where(and(inArray(submissions.tileId, killTiles.map((t) => t.id)), isNotNull(submissions.playerId)));

  // clan-scope: this clan -- participants of the event eventForRequest settled above; seats joined by id.
  const players = await db
    .select({
      playerId: eventParticipants.id,
      rsn: eventParticipants.name,
      baseline: eventParticipants.statsSnapshot,
      current: accountStatSnapshots.snapshot,
      polledAt: accounts.statsPolledAt,
    })
    .from(eventParticipants)
    .leftJoin(clanMemberships, eq(clanMemberships.id, eventParticipants.clanMemberId))
    .leftJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .leftJoin(accountStatSnapshots, eq(accountStatSnapshots.accountId, accounts.id))
    .where(eq(eventParticipants.eventId, eId));

  const flags = checkCreditIntegrity({
    tiles: killTiles,
    credits: credits.map((c) => ({ ...c, playerId: c.playerId! })),
    players,
  });
  return NextResponse.json({ flags, signals });
}

/** PATCH { signalId } — staff looked at a signal and it's fine; it won't come back. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const eId = parseInt((await params).eventId, 10);
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!(await verifyAdminOrModerator())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const signalId = Number(body?.signalId);
  if (!Number.isInteger(signalId)) return NextResponse.json({ error: 'signalId required' }, { status: 400 });
  // Only a signal on THIS event: the id came from the caller.
  const updated = await db
    .update(integritySignals)
    .set({ dismissedAt: new Date().toISOString() })
    .where(and(eq(integritySignals.id, signalId), eq(integritySignals.eventId, eId)))
    .returning({ id: integritySignals.id });
  if (updated.length === 0) return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

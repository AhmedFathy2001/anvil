import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clanMemberships, events } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { canEnterEvent } from '@/lib/eventAccess';
import { admit } from '@/lib/guestAdmission';
import { rateLimitByKey } from '@/lib/rate-limit';

/**
 * Entering an event hosted by a clan you are not in.
 *
 * THE STRUCTURAL PROBLEM: `event_signups.clan_member_id` is NOT NULL and names a seat in the host
 * clan, so an outsider has nowhere to sit. This is where they get one — as a GUEST, through the same
 * admission path a guest application uses, rather than a second way into a clan's roster that
 * bypasses its policy and its bans.
 *
 * A visitor to your event becomes a guest of your clan, which is what they are. Once they have a
 * seat, the ordinary sign-up flow takes over and knows nothing about any of this.
 */
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await verifyUser();
  if (!session?.playerId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  const eventId = Number((await params).eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: 'Bad event' }, { status: 400 });
  }

  // Cheap to attempt and cheap to abuse: entering an event creates a seat in somebody's clan.
  const limited = await rateLimitByKey('event-enter', String(session.userId), { limit: 10, windowMs: 3600_000 });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const verdict = await canEnterEvent({ eventId, playerId: session.playerId });

  if (verdict.outcome === 'refused') {
    // 404 for not-visible, so an event nobody may see does not confirm its own existence. A ban is
    // told plainly — the person needs to know it is a decision rather than a glitch.
    if (verdict.reason === 'banned') {
      return NextResponse.json({ error: 'This clan has barred you from its events.' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (verdict.outcome === 'insider') {
    return NextResponse.json({ ok: true, alreadyIn: true, message: 'You can sign up directly.' });
  }

  // clan-scope: global -- entering somebody ELSE'S event is the whole point of this route; the clan is the event's, and canEnterEvent has already ruled on access.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const accountId = Number(body?.accountId);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: 'Which account are you entering with?' }, { status: 400 });
  }

  // Theirs, and verified. Verification is the same gate the ordinary sign-up applies — it proves the
  // person controls the RSN — and an outsider should not face a lower bar than a member.
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, accountId), eq(accounts.playerId, session.playerId)),
  });
  if (!account) return NextResponse.json({ error: 'Not your account' }, { status: 403 });
  if (!account.verifiedAt) {
    return NextResponse.json({ error: `${account.rsn} has to be verified first.` }, { status: 403 });
  }

  // An account that is a MEMBER of another clan may still guest here — that is the whole point of
  // cross-clan play, and the one-member-seat rule is about membership, not visits.
  //
  // Carry the REASON into the request. Staff clearing the queue see one list of strangers, and
  // "wants to play in Summer Bingo" is a different decision from "wants to join the clan" — without
  // it an event entrant is indistinguishable from a walk-up application, and gets judged as one.
  const admission = await admit({
    clanId: event.clanId,
    accountId,
    source: 'web',
    message: `Wants to play in ${event.name}.`,
  });

  if (admission.outcome === 'refused') {
    return NextResponse.json({ error: 'This clan is not taking guests.' }, { status: 403 });
  }

  // An invited outsider has already been decided about; that is what the invitation was. Asking them
  // to wait for approval as well would be asking twice.
  if (admission.outcome !== 'seated' && verdict.needsApproval) {
    return NextResponse.json(
      { ok: true, pending: true, message: 'Sent to the host — you’ll be able to sign up once they accept.' },
      { status: 202 },
    );
  }

  if (admission.outcome !== 'seated') {
    // Not seated, but no approval was required — the clan's own guest policy is stricter than the
    // event's entry setting. The clan's word wins: it is their roster.
    return NextResponse.json(
      { ok: true, pending: true, message: 'Sent to the host clan’s staff for approval.' },
      { status: 202 },
    );
  }

  await db
    .insert(clanAuditLog)
    .values({
      clanId: event.clanId,
      clanMemberId: admission.seatId,
      eventType: 'entered_event_as_guest',
      actorUserId: session.userId,
      newValue: JSON.stringify({ eventId, accountId, rsn: account.rsn }),
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, seatId: admission.seatId });
}

/** What entering would involve, so the page can say so before anyone presses anything. */
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await verifyUser();
  const eventId = Number((await params).eventId);
  if (!Number.isInteger(eventId)) return NextResponse.json({ error: 'Bad event' }, { status: 400 });

  const verdict = await canEnterEvent({ eventId, playerId: session?.playerId ?? null });
  if (verdict.outcome === 'refused' && verdict.reason === 'not-visible') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // The accounts they could enter with: verified, and not already seated in the host clan (those
  // need no entry at all).
  let options: { id: number; rsn: string }[] = [];
  if (session?.playerId && verdict.outcome === 'outsider') {
    // clan-scope: global -- entering somebody ELSE'S event is the whole point of this route; the clan is the event's, and canEnterEvent has already ruled on access.
    const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
    if (event) {
      const seated = await db
        .select({ accountId: clanMemberships.accountId })
        .from(clanMemberships)
        .where(and(eq(clanMemberships.clanId, event.clanId), isNull(clanMemberships.leftAt)));
      const seatedIds = new Set(seated.map((r) => r.accountId));

      options = (
        await db
          .select({ id: accounts.id, rsn: accounts.rsn, verifiedAt: accounts.verifiedAt })
          .from(accounts)
          .where(eq(accounts.playerId, session.playerId))
      )
        .filter((a) => a.verifiedAt != null && !seatedIds.has(a.id))
        .map((a) => ({ id: a.id, rsn: a.rsn }));
    }
  }

  return NextResponse.json({ verdict, options });
}

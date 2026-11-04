import { NextResponse } from 'next/server';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanJoinRequests, clanMemberships, clans, events } from '@/db/schema';
import { streamedEvent } from '@/lib/creatorSpaces';
import { seatOpensEventSql } from '@/lib/seatScope';
import { eventRoomVerdict } from '@/lib/creatorPlans';
import { eventPlayerCount, streamPlanOfEvent } from '@/lib/creatorPlansDb';
import { freemiumEnforced } from '@/lib/entitlements';
import { verifyUser } from '@/lib/auth';
import { canEnterEvent } from '@/lib/eventAccess';
import { guestPolicyOf } from '@/lib/guestAdmission';
import { enterEvent } from '@/lib/eventEntry';
import { entryGateInfo } from '@/lib/entryGatesDb';
import { rateLimitByKey } from '@/lib/rate-limit';

/**
 * Entering an event hosted by a clan you are not in.
 *
 * A STREAMED event (a creator space's, or a Streaming clan's open to viewers) seats an outsider as an
 * EVENT PLAYER of that one event (lib/eventPlayers) instead of a guest — see lib/eventEntry.
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

  const body = await request.json().catch(() => null);
  const result = await enterEvent({
    eventId,
    playerId: session.playerId,
    accountId: Number(body?.accountId),
    actorUserId: session.userId,
  });

  switch (result.outcome) {
    case 'refused':
    case 'bad-account':
      return NextResponse.json({ error: result.error }, { status: result.status });
    case 'gated':
      // The structured verdict rides along so the join card can list the steps and offer "Link Twitch".
      return NextResponse.json({ error: result.error, gate: result.gate }, { status: result.status });
    case 'insider':
      return NextResponse.json({ ok: true, alreadyIn: true, message: 'You can sign up directly.' });
    case 'pending':
      return NextResponse.json({ ok: true, pending: true, message: result.message }, { status: 202 });
    case 'seated':
      return NextResponse.json({ ok: true, seatId: result.seatId });
  }
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
  // Asked already? The "waiting on the host" card used to live only in the browser, so a reload (or
  // coming back the next day) offered "Ask to join" again as if nothing had been sent.
  let pendingSince: string | null = null;
  // A closed clan refuses every entry; say so up front instead of after the press.
  let guestsClosed = false;
  // Whether they have any character at all. With none, linking one is the next step, and the sign-up
  // page does that inline; with only unverified ones, verifying is, and that lives on the profile.
  let hasCharacter = false;
  // A creator-space event at its plan's player cap (lib/creatorPlans) — only ever true when enforced.
  let full = false;
  if (session?.playerId && verdict.outcome === 'outsider') {
    // clan-scope: global -- entering somebody ELSE'S event is the whole point of this route; the clan is the event's, and canEnterEvent has already ruled on access.
    const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
    if (event) {
      // Seats that open THIS event: a member/guest seat, or an event player's seat for it. An event
      // seat for another of the host's events opens nothing here (lib/eventPlayers).
      const seated = await db
        .select({ accountId: clanMemberships.accountId })
        .from(clanMemberships)
        .where(and(eq(clanMemberships.clanId, event.clanId), isNull(clanMemberships.leftAt), seatOpensEventSql(eventId)));
      const seatedIds = new Set(seated.map((r) => r.accountId));

      const mine = await db
        .select({ id: accounts.id, rsn: accounts.rsn, verifiedAt: accounts.verifiedAt })
        .from(accounts)
        .where(eq(accounts.playerId, session.playerId));
      // A streamed event (a creator space's, or a Streaming clan's open to viewers) asks per event, so
      // a character already seated there (a creator space's older guest seat) is still one they can ask with.
      const streamed = streamedEvent(
        await db.query.clans.findFirst({ where: eq(clans.id, event.clanId), columns: { kind: true, streaming: true } }),
        event,
      );
      options = mine
        .filter((a) => a.verifiedAt != null && (streamed || !seatedIds.has(a.id)))
        .map((a) => ({ id: a.id, rsn: a.rsn }));

      const [policy, asked] = await Promise.all([
        guestPolicyOf(event.clanId),
        mine.length === 0
          ? Promise.resolve(undefined)
          : db.query.clanJoinRequests.findFirst({
              where: and(
                eq(clanJoinRequests.clanId, event.clanId),
                inArray(clanJoinRequests.accountId, mine.map((a) => a.id)),
                eq(clanJoinRequests.status, 'pending'),
                // A streamed event's requests are per event: only this event's counts as "asked".
                ...(streamed ? [eq(clanJoinRequests.eventId, eventId)] : []),
              ),
              orderBy: asc(clanJoinRequests.requestedAt),
              columns: { requestedAt: true },
            }),
      ]);
      guestsClosed = policy === 'closed';
      if (streamed && freemiumEnforced()) {
        const plan = await streamPlanOfEvent(eventId);
        full = !eventRoomVerdict({ clanPlan: plan, players: await eventPlayerCount(eventId), adding: 1 }).ok;
      }
      hasCharacter = mine.length > 0;
      pendingSince = asked?.requestedAt ?? null;
    }
  }

  // A creator-space event's "who can join", said up front (no Twitch or Discord call is made here).
  const gate = verdict.outcome === 'outsider' ? await entryGateInfo(eventId, session?.userId ?? null) : null;

  return NextResponse.json({ verdict, options, pendingSince, guestsClosed, hasCharacter, full, gate });
}

// Entering an event hosted by a clan you are not in — the decision, without the HTTP.
//
// Lifted out of /api/events/[eventId]/enter so the rule can be tested against a real database: the
// route was the only place "may this stranger sit down?" was answered end to end, and a route
// handler cannot be called from a test without faking a session.

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clans, events } from '@/db/schema';
import { canEnterEvent, invitedToEvent, staffOfClan, type EntryVerdict } from '@/lib/eventAccess';
import { admit, requestEventEntry } from '@/lib/guestAdmission';
import { isCreatorSpace, streamedEvent } from '@/lib/creatorSpaces';
import { seatEventPlayer } from '@/lib/eventPlayers';
import { entryGateVerdict } from '@/lib/entryGatesDb';
import { verdictMessage, type GateVerdict } from '@/lib/entryGates';
import { streamPlanId } from '@/lib/creatorPlans';
import { freemiumEnforced } from '@/lib/entitlements';
import { hostRoomVerdict } from '@/lib/creatorPlansDb';

export type EnterResult =
  | { outcome: 'refused'; reason: 'not-visible' | 'banned' | 'signed-out' | 'closed' | 'full'; status: number; error: string }
  /** A streamed event's entry gate (lib/entryGates) said no; `gate` says what to do about it. */
  | { outcome: 'gated'; status: number; error: string; gate: Extract<GateVerdict, { pass: false }> }
  | { outcome: 'insider' }
  | { outcome: 'bad-account'; status: number; error: string }
  | { outcome: 'pending'; message: string }
  | { outcome: 'seated'; seatId: number };

export async function enterEvent(opts: {
  eventId: number;
  playerId: number;
  accountId: number;
  /** Who pressed it, for the audit line. */
  actorUserId: number | null;
}): Promise<EnterResult> {
  const verdict: EntryVerdict = await canEnterEvent({ eventId: opts.eventId, playerId: opts.playerId });

  if (verdict.outcome === 'refused') {
    // 404 for not-visible, so an event nobody may see does not confirm its own existence. A ban is
    // told plainly — the person needs to know it is a decision rather than a glitch.
    if (verdict.reason === 'banned') {
      // clan-scope: global -- the host of the one event being entered, by its id.
      const ev = await db.query.events.findFirst({ where: eq(events.id, opts.eventId), columns: { clanId: true } });
      const host = ev ? await db.query.clans.findFirst({ where: eq(clans.id, ev.clanId), columns: { kind: true } }) : null;
      const error = isCreatorSpace(host) ? 'The host has barred you from their events.' : 'This clan has barred you from its events.';
      return { outcome: 'refused', reason: 'banned', status: 403, error };
    }
    return { outcome: 'refused', reason: verdict.reason, status: 404, error: 'Not found' };
  }
  if (verdict.outcome === 'insider') return { outcome: 'insider' };

  // clan-scope: global -- entering somebody ELSE'S event is the whole point; canEnterEvent has already ruled on access.
  const event = await db.query.events.findFirst({ where: eq(events.id, opts.eventId) });
  if (!event) return { outcome: 'refused', reason: 'not-visible', status: 404, error: 'Not found' };

  if (!Number.isInteger(opts.accountId) || opts.accountId <= 0) {
    return { outcome: 'bad-account', status: 400, error: 'Which character are you signing up with?' };
  }

  // Theirs, and verified. Verification is the same gate the ordinary sign-up applies — it proves the
  // person controls the RSN — and an outsider should not face a lower bar than a member.
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, opts.accountId), eq(accounts.playerId, opts.playerId)),
  });
  if (!account) return { outcome: 'bad-account', status: 403, error: 'Not your account' };
  if (!account.verifiedAt) {
    return { outcome: 'bad-account', status: 403, error: `${account.rsn} has to be verified first.` };
  }

  // A STREAMED event — every creator-space event, and a Streaming clan's event open to viewers
  // (lib/creatorSpaces streamedEvent) — decides admission per EVENT: `open` seats them now,
  // `approval` files a request for this event. Whoever gets in is an EVENT PLAYER (lib/eventPlayers):
  // a seat that opens this event and nothing else, never a guest seat, never on the roster.
  // Any other event is the clan's own guest policy, exactly as before.
  const host = await db.query.clans.findFirst({
    where: eq(clans.id, event.clanId),
    columns: { kind: true, plan: true, streaming: true, guestPolicy: true },
  });
  const streamed = streamedEvent(host, event);

  // A streamed event's plan caps the players on it — at once, across the host's events whose dates
  // overlap this one (lib/creatorPlans). A no-op until
  // FREEMIUM_ENFORCED is on; then a full event says so before anyone is seated or asks the host.
  if (streamed && freemiumEnforced()) {
    const room = await hostRoomVerdict({ eventId: event.id, clanPlan: streamPlanId(host), adding: 1 });
    if (!room.ok) return { outcome: 'refused', reason: 'full', status: 403, error: room.error };
  }

  // The host's "who can join" (Twitch followers/subs, a Discord role, boosters). Before the approval
  // request too: asking a host to approve somebody their own gate would turn away wastes their time.
  // Staff and people the host invited by name are not gated (entryGateVerdict returns null).
  if (streamed) {
    const gate = await entryGateVerdict({ eventId: event.id, userId: opts.actorUserId, playerId: opts.playerId });
    if (gate && !gate.pass) {
      return { outcome: 'gated', status: gate.transient ? 503 : 403, error: verdictMessage(gate), gate };
    }
  }

  if (streamed) {
    const staff = await staffOfClan(event.clanId, opts.playerId);
    // `approval`, for somebody who is neither the host's staff nor invited to this event: ask about
    // THIS event. No seat, no sign-up, until the host says yes (approveRequest then seats them as
    // this event's player and invites them to it).
    if (verdict.needsApproval && !staff && !(await invitedToEvent(event.id, opts.playerId))) {
      await requestEventEntry({
        clanId: event.clanId,
        eventId: event.id,
        accountId: opts.accountId,
        playerId: opts.playerId,
        message: `Wants to play in ${event.name}.`,
      });
      return { outcome: 'pending', message: 'Sent to the host — you’ll be able to sign up once they accept.' };
    }
    // A creator space that has shut its doors stays shut (as admit() always kept it).
    if (isCreatorSpace(host) && host?.guestPolicy === 'closed' && !staff) {
      return { outcome: 'refused', reason: 'closed', status: 403, error: 'The host isn’t letting you join their events.' };
    }

    // The host's own staff play on a clan seat (admit's staff path): a guest seat in a creator space,
    // a member seat in a clan. Everybody else: this event's seat, and only this event's.
    let seatId: number;
    let eventType = 'entered_event_as_viewer';
    if (staff) {
      const admission = await admit({ clanId: event.clanId, accountId: opts.accountId, source: 'web', policy: 'open' });
      if (admission.outcome !== 'seated') {
        return { outcome: 'refused', reason: 'closed', status: 403, error: 'The host isn’t letting you join their events.' };
      }
      seatId = admission.seatId;
      eventType = 'entered_event_as_guest';
    } else {
      seatId = await seatEventPlayer({ clanId: event.clanId, eventId: event.id, accountId: opts.accountId });
    }
    await audit(event.clanId, seatId, eventType, opts, account.rsn);
    return { outcome: 'seated', seatId };
  }

  // An account that is a MEMBER of another clan may still guest here — that is the whole point of
  // cross-clan play, and the one-member-seat rule is about membership, not visits.
  //
  // Carry the REASON into the request. Staff clearing the queue see one list of strangers, and
  // "wants to play in Summer Bingo" is a different decision from "wants to join the clan".
  const admission = await admit({
    clanId: event.clanId,
    accountId: opts.accountId,
    source: 'web',
    message: `Wants to play in ${event.name}.`,
  });

  if (admission.outcome === 'refused') {
    return { outcome: 'refused', reason: 'closed', status: 403, error: 'This clan is not taking guests.' };
  }

  if (admission.outcome !== 'seated' && verdict.needsApproval) {
    return { outcome: 'pending', message: 'Sent to the host — you’ll be able to sign up once they accept.' };
  }
  if (admission.outcome !== 'seated') {
    // Not seated, but no approval was required — the clan's own guest policy is stricter than the
    // event's entry setting. The clan's word wins: it is their roster.
    return { outcome: 'pending', message: 'Sent to the host clan’s staff for approval.' };
  }

  await audit(event.clanId, admission.seatId, 'entered_event_as_guest', opts, account.rsn);
  return { outcome: 'seated', seatId: admission.seatId };
}

async function audit(
  clanId: number,
  seatId: number,
  eventType: string,
  opts: { eventId: number; accountId: number; actorUserId: number | null },
  rsn: string,
): Promise<void> {
  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      clanMemberId: seatId,
      eventType,
      actorUserId: opts.actorUserId,
      newValue: JSON.stringify({ eventId: opts.eventId, accountId: opts.accountId, rsn }),
    })
    .catch(() => {});
}

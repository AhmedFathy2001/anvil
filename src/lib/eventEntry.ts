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
import { isCreatorSpace } from '@/lib/creatorSpaces';

export type EnterResult =
  | { outcome: 'refused'; reason: 'not-visible' | 'banned' | 'signed-out' | 'closed'; status: number; error: string }
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
      return { outcome: 'refused', reason: 'banned', status: 403, error: 'This clan has barred you from its events.' };
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

  // A CREATOR SPACE decides admission per EVENT: `open` seats them now, `approval` files a request.
  // A clan's own guest policy decides it for a clan, exactly as before.
  const host = await db.query.clans.findFirst({ where: eq(clans.id, event.clanId), columns: { kind: true } });
  const creator = isCreatorSpace(host);

  // An account that is a MEMBER of another clan may still guest here — that is the whole point of
  // cross-clan play, and the one-member-seat rule is about membership, not visits.
  //
  // Carry the REASON into the request. Staff clearing the queue see one list of strangers, and
  // "wants to play in Summer Bingo" is a different decision from "wants to join the clan".
  // A creator space's `approval` event, for somebody who is neither its staff nor invited to it:
  // ask about THIS event, whether or not they already hold a seat from another one. No seat, no
  // sign-up, until the host says yes (approveRequest then invites them to this event only).
  if (creator && verdict.needsApproval && !(await staffOfClan(event.clanId, opts.playerId))) {
    if (!(await invitedToEvent(event.id, opts.playerId))) {
      await requestEventEntry({
        clanId: event.clanId,
        eventId: event.id,
        accountId: opts.accountId,
        playerId: opts.playerId,
        message: `Wants to play in ${event.name}.`,
      });
      return { outcome: 'pending', message: 'Sent to the host — you’ll be able to sign up once they accept.' };
    }
  }
  const invitedHere = creator && (await invitedToEvent(event.id, opts.playerId));

  const admission = await admit({
    clanId: event.clanId,
    accountId: opts.accountId,
    source: 'web',
    message: `Wants to play in ${event.name}.`,
    // Past the per-event check above, a creator space admits: open events, staff, and the invited.
    ...(creator ? { policy: 'open' as const } : {}),
  });

  if (admission.outcome === 'refused') {
    return { outcome: 'refused', reason: 'closed', status: 403, error: creator ? 'The host isn’t letting you join their events.' : 'This clan is not taking guests.' };
  }

  // An invited outsider has already been decided about; that is what the invitation was. Asking them
  // to wait for approval as well would be asking twice.
  if (admission.outcome !== 'seated' && verdict.needsApproval && !invitedHere) {
    return { outcome: 'pending', message: 'Sent to the host — you’ll be able to sign up once they accept.' };
  }
  if (admission.outcome !== 'seated') {
    // Not seated, but no approval was required — the clan's own guest policy is stricter than the
    // event's entry setting. The clan's word wins: it is their roster.
    return {
      outcome: 'pending',
      message: creator ? 'Sent to the host — you’ll be able to sign up once they accept.' : 'Sent to the host clan’s staff for approval.',
    };
  }

  await db
    .insert(clanAuditLog)
    .values({
      clanId: event.clanId,
      clanMemberId: admission.seatId,
      eventType: 'entered_event_as_guest',
      actorUserId: opts.actorUserId,
      newValue: JSON.stringify({ eventId: opts.eventId, accountId: opts.accountId, rsn: account.rsn }),
    })
    .catch(() => {});

  return { outcome: 'seated', seatId: admission.seatId };
}

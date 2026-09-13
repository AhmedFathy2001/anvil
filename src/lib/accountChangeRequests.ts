// The queue behind "can I play this event on my other account?".
//
// A REQUEST NEVER MOVES A ROSTER ROW. Approving calls `swapTrackedAccount` — the same repoint the
// approver could already have performed by hand from the sign-ups tab or their team page — so this
// grants no authority that did not exist. What it adds is the asking: a queue, a record of who
// asked and who answered, and somewhere it can be seen (lib/adminAttention). Before it, the asking
// happened in Discord, where it competed with everything else in the channel and the answer was
// somebody remembering to go and do it.
//
// WHO ANSWERS is lib/accountChangeRules, and it follows the money: a clan that collects its members'
// fees answers its own people; one whose members paid into the host's pot does not; a board may
// override either way.

import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import {
  accountChangeRequests,
  clanRoster,
  eventParticipants,
  events,
  teams,
} from '@/db/schema';
import { approverFor, type Approver } from '@/lib/accountChangeRules';
import { findRosterSeat } from '@/lib/roster';
import { swapTrackedAccount } from '@/lib/trackedAccount';

export interface OpenRequest {
  id: number;
  eventId: number;
  eventName: string;
  participantId: number;
  playerName: string;
  fromRsn: string | null;
  toRsn: string | null;
  note: string | null;
  createdAt: string;
  teamId: number | null;
  teamName: string | null;
  /** Who this one is waiting on — see accountChangeRules. */
  approver: Approver;
}

/** The board's override for who answers, read off the same rules JSON as every other board policy. */
function overrideOf(rulesJson: string | null | undefined): 'auto' | 'host' | 'team' {
  if (!rulesJson) return 'auto';
  try {
    const parsed = JSON.parse(rulesJson) as { accountChangeApproval?: unknown };
    const v = parsed?.accountChangeApproval;
    return v === 'host' || v === 'team' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/**
 * Who answers for one participant's request.
 *
 * Delegated means the team IS a clan (teams.clanId) — the same line the repoint route draws, and the
 * reason a drafted side always falls to the host however the cash is arranged.
 */
export async function approverForParticipant(participantId: number): Promise<{
  approver: Approver;
  eventId: number;
  teamClanId: number | null;
  hostClanId: number;
} | null> {
  const row = await db
    .select({
      eventId: eventParticipants.eventId,
      teamId: eventParticipants.teamId,
      teamClanId: teams.clanId,
      hostClanId: events.clanId,
      cashPolicy: events.cashPolicy,
      rules: events.rules,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(events.id, eventParticipants.eventId))
    .leftJoin(teams, eq(teams.id, eventParticipants.teamId))
    .where(eq(eventParticipants.id, participantId))
    .limit(1)
    .then((r) => r[0]);
  if (!row) return null;

  return {
    approver: approverFor({
      delegated: row.teamClanId != null,
      cashPolicy: row.cashPolicy,
      override: overrideOf(row.rules),
    }),
    eventId: row.eventId,
    teamClanId: row.teamClanId ?? null,
    hostClanId: row.hostClanId,
  };
}

export type RequestResult =
  | { ok: true; id: number }
  | { ok: false; status: number; error: string };

/**
 * File a request, having checked the one thing that must never be wrong: the character they are
 * asking to be followed on is THEIRS.
 *
 * Checked here and again at approval, because an account can be unlinked in between and a stale
 * request must not become a repoint onto somebody else's character.
 */
export async function requestAccountChange(opts: {
  participantId: number;
  userId: number;
  playerId: number;
  toSeatId: number;
  note?: string | null;
}): Promise<RequestResult> {
  const participant = await db.query.eventParticipants.findFirst({
    where: eq(eventParticipants.id, opts.participantId),
  });
  if (!participant) return { ok: false, status: 404, error: 'No such player row' };

  // Theirs to ask about: the row the board follows has to belong to the person asking.
  const current = participant.clanMemberId != null
    // clan-scope: global -- the id came from a participant row this request has already established.
    ? await findRosterSeat(eq(clanRoster.id, participant.clanMemberId))
    : null;
  if (!current || current.playerId !== opts.playerId) {
    return { ok: false, status: 403, error: 'That is not your player row' };
  }

  // And the character they want is theirs too, and still on a roster.
  //
  // clan-scope: global -- a person's characters span clans by design, and the ownership check below
  // is what scopes this: the seat has to belong to the person asking. Which clan it sits in is then
  // read off the seat itself and passed to the swap as its only allowed clan.
  const target = await findRosterSeat(
    and(eq(clanRoster.id, opts.toSeatId), isNull(clanRoster.leftAt)),
  );
  if (!target || target.playerId !== opts.playerId) {
    return { ok: false, status: 403, error: 'That character is not yours' };
  }
  if (target.id === participant.clanMemberId) {
    return { ok: false, status: 400, error: 'The board already follows that character' };
  }

  try {
    const [created] = await db
      .insert(accountChangeRequests)
      .values({
        eventId: participant.eventId,
        participantId: participant.id,
        requestedByUserId: opts.userId,
        toClanMemberId: target.id,
        fromClanMemberId: participant.clanMemberId ?? null,
        note: opts.note?.trim().slice(0, 400) || null,
      })
      .returning({ id: accountChangeRequests.id });
    return { ok: true, id: created.id };
  } catch (e) {
    // The partial unique index: one OPEN ask per roster row. Asking twice is the same ask.
    if ((e as { cause?: { code?: string } }).cause?.code === '23505') {
      return { ok: false, status: 409, error: 'You already have a request waiting on this event.' };
    }
    throw e;
  }
}

/** Requests still waiting, for one clan's attention queue — both the ones it hosts and the ones its teams own. */
export async function openRequestsForClan(clanId: number): Promise<OpenRequest[]> {
  // clan-scope: this clan -- both halves of the OR name this clan explicitly.
  const rows = await db
    .select({
      id: accountChangeRequests.id,
      eventId: accountChangeRequests.eventId,
      eventName: events.name,
      participantId: accountChangeRequests.participantId,
      playerName: eventParticipants.name,
      note: accountChangeRequests.note,
      createdAt: accountChangeRequests.createdAt,
      toSeatId: accountChangeRequests.toClanMemberId,
      fromSeatId: accountChangeRequests.fromClanMemberId,
      teamId: eventParticipants.teamId,
      teamName: teams.name,
      teamClanId: teams.clanId,
      hostClanId: events.clanId,
      cashPolicy: events.cashPolicy,
      rules: events.rules,
    })
    .from(accountChangeRequests)
    .innerJoin(events, eq(events.id, accountChangeRequests.eventId))
    .innerJoin(eventParticipants, eq(eventParticipants.id, accountChangeRequests.participantId))
    .leftJoin(teams, eq(teams.id, eventParticipants.teamId))
    .where(eq(accountChangeRequests.status, 'pending'));

  const seatIds = [
    ...new Set(rows.flatMap((r) => [r.toSeatId, r.fromSeatId]).filter((v): v is number => v != null)),
  ];
  const seats = seatIds.length
    // clan-scope: global -- ids came from rows this query already established.
    ? await db.select().from(clanRoster).where(inArray(clanRoster.id, seatIds))
    : [];
  const rsnById = new Map(seats.map((s) => [s.id, s.rsn]));

  return rows
    .map((r) => ({
      id: r.id,
      eventId: r.eventId,
      eventName: r.eventName,
      participantId: r.participantId,
      playerName: r.playerName,
      fromRsn: r.fromSeatId != null ? rsnById.get(r.fromSeatId) ?? null : null,
      toRsn: rsnById.get(r.toSeatId) ?? null,
      note: r.note,
      createdAt: r.createdAt,
      teamId: r.teamId,
      teamName: r.teamName ?? null,
      teamClanId: r.teamClanId ?? null,
      hostClanId: r.hostClanId,
      approver: approverFor({
        delegated: r.teamClanId != null,
        cashPolicy: r.cashPolicy,
        override: overrideOf(r.rules),
      }),
    }))
    // Whose queue is it? The host's when the host answers, the team's clan when the team does.
    .filter((r) => (r.approver === 'team' ? r.teamClanId === clanId : r.hostClanId === clanId))
    // The two clan ids were only ever the filter above; the caller gets the request, not the routing.
    .map((r) => {
      const { teamClanId, hostClanId, ...rest } = r;
      void teamClanId;
      void hostClanId;
      return rest;
    });
}

/** Just the number, for the attention queue — the list is only built where it is shown. */
export async function openRequestCountForClan(clanId: number): Promise<number> {
  return (await openRequestsForClan(clanId)).length;
}

export type DecisionResult =
  | { ok: true; changed: boolean; rsn?: string }
  | { ok: false; status: number; error: string };

/**
 * Answer one. Approving performs the repoint through `swapTrackedAccount`, which re-checks that both
 * seats belong to the same person — so a request that went stale between asking and answering fails
 * here rather than moving somebody else's character.
 *
 * AUTHORISATION IS THE CALLER'S. This knows how a request moves, not who may move it — the same
 * split lib/feeConfirmations uses.
 */
export async function decideAccountChange(opts: {
  requestId: number;
  actorUserId: number;
  decision: 'approved' | 'rejected';
  note?: string | null;
}): Promise<DecisionResult> {
  const req = await db.query.accountChangeRequests.findFirst({
    where: eq(accountChangeRequests.id, opts.requestId),
  });
  if (!req) return { ok: false, status: 404, error: 'No such request' };
  if (req.status !== 'pending') {
    return { ok: false, status: 409, error: `That request was already ${req.status}.` };
  }

  const settle = async () => {
    await db
      .update(accountChangeRequests)
      .set({
        status: opts.decision,
        decidedByUserId: opts.actorUserId,
        decidedAt: new Date().toISOString(),
        decisionNote: opts.note?.trim().slice(0, 400) || null,
      })
      .where(eq(accountChangeRequests.id, req.id));
  };

  if (opts.decision === 'rejected') {
    await settle();
    return { ok: true, changed: false };
  }

  const participant = await db.query.eventParticipants.findFirst({
    where: eq(eventParticipants.id, req.participantId),
  });
  if (!participant) return { ok: false, status: 404, error: 'That player row is gone' };

  // clan-scope: global -- the id was stored on a request whose ownership was checked when it was
  // filed, and `swapTrackedAccount` re-checks that both seats are the same person before moving
  // anything. The clan read off this seat is the swap's only allowed clan.
  const target = await findRosterSeat(eq(clanRoster.id, req.toClanMemberId));
  if (!target) return { ok: false, status: 404, error: 'That character is no longer on a roster' };

  const swap = await swapTrackedAccount({
    player: participant,
    eventId: req.eventId,
    toSeatId: req.toClanMemberId,
    // The clan the character actually sits in — the same scoping the by-hand routes apply, and the
    // reason a request cannot reach across into another clan's roster.
    allowedClanIds: [target.clanId],
    samePersonOnly: true,
  });
  if (!swap.ok) return { ok: false, status: swap.status, error: swap.error };

  if (swap.changed && swap.updates) {
    await db.update(eventParticipants).set(swap.updates).where(eq(eventParticipants.id, participant.id));
  }
  await settle();
  return { ok: true, changed: !!swap.changed, rsn: swap.rsn };
}

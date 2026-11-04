// "I'm in the wrong clan" — a player telling Anvil their character is a member of the wrong clan.
//
// Membership comes from the in-game roster, and a roster sync never moves it between clans
// (lib/guestAdmission memberSeatElsewhere), so a character seated as a member in the wrong clan stays
// there. The player's own home-clan choice (lib/homeClan chooseHomeClan) is one-way and only covers
// two rosters both listing them. Everything else is this: the player files a 'wrong_clan' report
// naming the clan they're really in, and platform staff move the membership from /staff/reports.
//
// Staff can only move it to a clan that already holds a seat for the character (any kind): a clan
// with no seat has no roster entry to promote, so the player says so in the note and staff take it
// from there by hand.

import { and, eq, inArray, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, characterReports, clanAuditLog, clanMemberships, clans } from '@/db/schema';
import { fileCharacterReport } from '@/lib/characterReports';
import { verificationOf } from '@/lib/clanVerification';
import { clanSeat } from '@/lib/seatScope';

interface LiveSeat {
  seatId: number;
  clanId: number;
  clanName: string;
  kind: string;
}

async function liveSeats(accountId: number): Promise<LiveSeat[]> {
  // clan-scope: global -- one character's seats in every clan; the question is which clan is home.
  return db
    .select({ seatId: clanMemberships.id, clanId: clans.id, clanName: clans.name, kind: clanMemberships.kind })
    .from(clanMemberships)
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    // Member and guest seats: an event player's seat is never a home clan, nor promoted into one.
    .where(and(eq(clanMemberships.accountId, accountId), isNull(clanMemberships.leftAt), clanSeat()));
}

export type WrongClanFileResult =
  | { ok: true; reportId: number; alreadyOpen: boolean }
  | { ok: false; status: 403 | 404 | 400; error: string };

/**
 * File (or add to) the player's wrong-clan report. Only the character's OWNER may: the person the
 * account belongs to. `claimedClanId` is the clan they say they're really in — one holding a live
 * seat for the character — or null for a clan with no seat (they explain in the note).
 *
 * One open report per (character, player): a second press adds its note to the first, and a changed
 * answer moves the report to the newly named clan (the latest word is the one staff act on).
 */
export async function fileWrongClanReport(input: {
  accountId: number;
  playerId: number;
  userId: number;
  claimedClanId: number | null;
  note?: string | null;
}): Promise<WrongClanFileResult> {
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, input.accountId),
    columns: { id: true, rsn: true, playerId: true },
  });
  if (!account) return { ok: false, status: 404, error: 'No such character.' };
  if (account.playerId !== input.playerId) return { ok: false, status: 403, error: 'That character isn’t linked to you.' };

  const seats = await liveSeats(account.id);
  const claimed = input.claimedClanId == null ? null : seats.find((s) => s.clanId === input.claimedClanId) ?? null;
  if (input.claimedClanId != null && !claimed) {
    return { ok: false, status: 400, error: 'That clan doesn’t have this character on its list. Pick “another clan” and tell us in the note.' };
  }
  const note = input.note?.trim().slice(0, 500) ?? '';
  if (!claimed && !note) return { ok: false, status: 400, error: 'Tell us which clan you’re really in.' };

  const member = seats.find((s) => s.kind === 'member') ?? null;
  if (claimed && member && claimed.clanId === member.clanId) {
    return { ok: false, status: 400, error: `${account.rsn} is already a member of ${claimed.clanName}.` };
  }

  const body =
    `The player says ${account.rsn} is in the wrong clan. ` +
    `Member of now: ${member ? member.clanName : 'no clan'}. ` +
    `Really in: ${claimed ? claimed.clanName : 'a clan with no place for this character on Anvil (see their note)'}.` +
    (note ? `\n\nTheir note: ${note}` : '');

  const { id, created } = await fileCharacterReport({
    accountId: account.id,
    clanId: claimed?.clanId ?? null,
    reportedByUserId: input.userId,
    claimantPlayerId: input.playerId,
    kind: 'wrong_clan',
    body,
  });
  // fileCharacterReport keys on (account, kind, claimant), not the clan — so a changed answer folds
  // into the open report. Point it at the clan they name now, which is the one staff would move to.
  if (!created) {
    await db
      .update(characterReports)
      .set({ clanId: claimed?.clanId ?? null })
      .where(and(eq(characterReports.id, id), inArray(characterReports.status, ['open'])));
  }
  return { ok: true, reportId: id, alreadyOpen: !created };
}

/** What staff need to offer "Make <clan> their home" on a wrong_clan report. */
export interface WrongClanMoveView {
  targetClanId: number;
  targetClanName: string;
  /** The target clan still holds a live seat for the character. */
  targetSeat: boolean;
  /** Already a member there — nothing to move. */
  alreadyMember: boolean;
  targetVerified: boolean;
  currentMemberClan: string | null;
}

export async function wrongClanMoveView(accountId: number, targetClanId: number): Promise<WrongClanMoveView | null> {
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, targetClanId), columns: { id: true, name: true } });
  if (!clan) return null;
  const seats = await liveSeats(accountId);
  const target = seats.find((s) => s.clanId === targetClanId);
  return {
    targetClanId,
    targetClanName: clan.name,
    targetSeat: !!target,
    alreadyMember: target?.kind === 'member',
    targetVerified: (await verificationOf(targetClanId)).verified,
    currentMemberClan: seats.find((s) => s.kind === 'member' && s.clanId !== targetClanId)?.clanName ?? null,
  };
}

/**
 * STAFF: carry out an open wrong_clan report — the clan it names becomes the character's member clan,
 * the clan holding the membership now keeps it as a guest. Same shape as chooseHomeClan (demote, then
 * promote, audit rows on both clans) but `via: 'staff'`, and the report is closed in the same
 * transaction so a half-done move can't be left behind.
 *
 * Refuses when the named clan is not verified (an unverified clan is anyone's to make, so it must not
 * be handed members on a player's word) or no longer holds a seat for the character.
 */
export async function applyWrongClanMove(
  reportId: number,
  actorUserId: number,
  resolution?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const report = await db.query.characterReports.findFirst({ where: eq(characterReports.id, reportId) });
  if (!report || report.kind !== 'wrong_clan' || report.status !== 'open') return { ok: false, error: 'That report is not open.' };
  if (report.clanId == null) return { ok: false, error: 'The player named a clan with no place for this character — move it by hand.' };
  const targetClanId = report.clanId;
  if (!(await verificationOf(targetClanId)).verified) {
    return { ok: false, error: 'That clan isn’t verified, so it can’t be made their home.' };
  }
  const seats = await liveSeats(report.accountId);
  const target = seats.find((s) => s.clanId === targetClanId);
  if (!target) return { ok: false, error: 'That clan no longer has this character on its list.' };
  if (target.kind === 'member') return { ok: false, error: 'They are already a member of that clan — mark it resolved.' };
  const current = seats.find((s) => s.kind === 'member' && s.clanId !== targetClanId) ?? null;

  const note = resolution?.trim().slice(0, 2000) || `Made ${target.clanName} their home`;
  const done = await db.transaction(async (tx) => {
    // Close the report first, conditionally: a second staff click (or a race) finds it closed and
    // rolls back nothing, rather than moving the membership twice.
    const [closed] = await tx
      .update(characterReports)
      .set({ status: 'resolved', resolution: note, resolvedByUserId: actorUserId, resolvedAt: new Date().toISOString() })
      .where(and(eq(characterReports.id, reportId), eq(characterReports.status, 'open')))
      .returning({ id: characterReports.id });
    if (!closed) return false;
    // Demote first: the one-member-seat index would refuse the promotion while both are members.
    if (current) await tx.update(clanMemberships).set({ kind: 'guest' }).where(eq(clanMemberships.id, current.seatId));
    const [promoted] = await tx
      .update(clanMemberships)
      .set({ kind: 'member' })
      .where(and(eq(clanMemberships.id, target.seatId), isNull(clanMemberships.leftAt), ne(clanMemberships.kind, 'member')))
      .returning({ id: clanMemberships.id });
    if (!promoted) throw new Error('target seat changed');
    const rows: (typeof clanAuditLog.$inferInsert)[] = [
      {
        clanId: targetClanId,
        clanMemberId: target.seatId,
        eventType: 'member_chose_this_clan',
        actorUserId,
        newValue: JSON.stringify({ previouslyMemberOf: current?.clanId ?? null, via: 'staff', reportId }),
        notes: 'moved here by Anvil staff at the player’s request',
      },
    ];
    if (current) {
      rows.push({
        clanId: current.clanId,
        clanMemberId: current.seatId,
        eventType: 'member_left_for_another_clan',
        actorUserId,
        newValue: JSON.stringify({ nowMemberOf: targetClanId, via: 'staff', reportId }),
        notes: 'moved to another clan by Anvil staff at the player’s request',
      });
    }
    await tx.insert(clanAuditLog).values(rows);
    return true;
  }).catch((e: unknown) => {
    if (e instanceof Error && e.message === 'target seat changed') return null;
    throw e;
  });
  if (done === null) return { ok: false, error: 'That clan no longer has this character on its list.' };
  if (!done) return { ok: false, error: 'That report is not open.' };
  return { ok: true };
}

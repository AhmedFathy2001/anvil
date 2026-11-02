// Pre-approved character reports — a clan OWNER's call carried out at once, with a one-click undo.
//
// lib/characterReports moved every change to a CHARACTER (who owns it, what it is called) off the
// clans and onto Anvil staff, because a character follows its person into every clan. That left
// clans waiting on staff for routine fixes. The middle ground: when the clan's OWNER reports
// something, the decision they asked for is applied straight away through the SAME code staff use
// (detachCharacter / reassignCharacter / renameCharacter), the report lands on /staff/reports as
// 'applied', and staff either approve it or revert it.
//
// THE UNDO IS THE CONTRACT. Only changes that can be put back exactly are applied early:
//   - taking a character off someone (wrong_owner, claim_review) — detach;
//   - giving it to the person a clan vouches for (claim_request) — reassign;
//   - a plain rename to a name no other entry holds.
// A rename onto a name another entry already uses would fold that entry in (lib/characterRename
// absorbs it and deletes the duplicate), and a merge is the same thing — neither can be unwound, so
// both stay a normal waiting report and the clan is told why.
//
// The before-state is kept in the clan's audit log (event 'character_report_applied', newValue
// `{"reportId":N}`, oldValue the snapshot), so the revert needs no new column and the clan's own log
// shows what its owner did.

import { and, eq, inArray, ne } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, characterReports, clanAuditLog, clanMemberships, detectedAccounts, pendingRenames, players, users } from '@/db/schema';
import { normalizeRsn, sanitizeRsn } from '@/lib/auth';
import { detachCharacter, fileCharacterReport, mergeCharacterReportBody, reassignCharacter, settleRenameRequests } from '@/lib/characterReports';
import { renameCharacter } from '@/lib/characterRename';
import { mergeEmptyPersonInto } from '@/lib/mergePeople';

export const APPLIED_EVENT = 'character_report_applied';
export const REVERTED_EVENT = 'character_report_reverted';

interface AccountState {
  playerId: number;
  claimedAt: string | null;
  verifiedAt: string | null;
  verificationMethod: string | null;
  verifiedByUserId: number | null;
  provisional: number;
  isPrimary: number;
  accountHash: string | null;
}

interface OwnerSnapshot {
  v: 1;
  type: 'owner';
  accountId: number;
  before: AccountState;
  /** The dismissed suggestion detach writes for the former holder's login — and what was there before. */
  formerLogin: { userId: number; rsnNormalized: string; row: { status: string; accountHash: string | null } | null } | null;
  after: { playerId: number; claimedAt: string | null };
}

interface RenameSnapshot {
  v: 1;
  type: 'rename';
  accountId: number;
  before: { rsn: string; previousRsns: string | null; status: string };
  after: { rsnNormalized: string };
}

type Snapshot = OwnerSnapshot | RenameSnapshot;

export type ApplyOutcome = { ok: true } | { ok: false; reason: string };

function accountState(a: typeof accounts.$inferSelect): AccountState {
  return {
    playerId: a.playerId,
    claimedAt: a.claimedAt,
    verifiedAt: a.verifiedAt,
    verificationMethod: a.verificationMethod,
    verifiedByUserId: a.verifiedByUserId,
    provisional: a.provisional,
    isPrimary: a.isPrimary,
    accountHash: a.accountHash,
  };
}

async function formerLoginState(a: typeof accounts.$inferSelect): Promise<OwnerSnapshot['formerLogin']> {
  if (!a.claimedAt) return null;
  const login = await db.query.users.findFirst({ where: eq(users.playerId, a.playerId), columns: { id: true } });
  if (!login) return null;
  const row = await db.query.detectedAccounts.findFirst({
    where: and(eq(detectedAccounts.userId, login.id), eq(detectedAccounts.rsnNormalized, a.rsnNormalized)),
    columns: { status: true, accountHash: true },
  });
  return { userId: login.id, rsnNormalized: a.rsnNormalized, row: row ?? null };
}

/**
 * Carry out an OPEN report's request now, keep what is needed to undo it, and mark it 'applied'.
 * Refuses — leaving the report open for staff — with a reason in plain words when the change is
 * not one that can be undone cleanly or a safety rail says no.
 */
export async function applyCharacterReport(reportId: number, actorUserId: number): Promise<ApplyOutcome> {
  const report = await db.query.characterReports.findFirst({ where: eq(characterReports.id, reportId) });
  if (!report || report.status !== 'open') return { ok: false, reason: 'That report is not waiting any more.' };
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, report.accountId) });
  if (!account) return { ok: false, reason: 'That character no longer exists.' };
  const note = `Applied by the clan owner (report #${report.id})`;

  let snapshot: Snapshot;
  if (report.kind === 'wrong_owner' || report.kind === 'claim_review') {
    if (!account.claimedAt) return { ok: false, reason: 'Nobody has linked that character, so there is nothing to take off.' };
    const before = accountState(account);
    const formerLogin = await formerLoginState(account);
    if (!(await detachCharacter(account.id, actorUserId, note))) {
      return { ok: false, reason: 'Nobody has linked that character, so there is nothing to take off.' };
    }
    snapshot = { v: 1, type: 'owner', accountId: account.id, before, formerLogin, after: { playerId: 0, claimedAt: null } };
  } else if (report.kind === 'claim_request') {
    if (report.claimantPlayerId == null) return { ok: false, reason: 'It does not say who should get the character.' };
    if (account.claimedAt && account.playerId === report.claimantPlayerId) {
      return { ok: false, reason: 'They already have that character.' };
    }
    const before = accountState(account);
    const formerLogin = await formerLoginState(account);
    const res = await reassignCharacter(account.id, report.claimantPlayerId, actorUserId, note);
    if (!res.ok) return { ok: false, reason: res.error };
    snapshot = { v: 1, type: 'owner', accountId: account.id, before, formerLogin, after: { playerId: 0, claimedAt: null } };
  } else if (report.kind === 'rename') {
    const newRsn = sanitizeRsn(report.requestedRsn ?? '');
    const newNorm = normalizeRsn(newRsn);
    if (!newNorm) return { ok: false, reason: 'It does not say what the new name is.' };
    if (account.rsnNormalized === newNorm && account.rsn === newRsn) return { ok: false, reason: 'It already has that name.' };
    // A name another entry holds means folding that entry in — permanent, so Anvil does it.
    const holder = await db.query.accounts.findFirst({
      where: and(eq(accounts.rsnNormalized, newNorm), ne(accounts.id, account.id)),
      columns: { rsn: true },
    });
    if (holder) {
      return {
        ok: false,
        reason: `Another entry already uses the name ${holder.rsn}. Joining the two can't be undone, so Anvil will do it.`,
      };
    }
    const before = { rsn: account.rsn, previousRsns: account.previousRsns, status: account.status };
    const res = await renameCharacter(account.id, newRsn, { actorUserId, via: 'staff', note, absorb: 'staff' });
    if (!res.ok) return { ok: false, reason: res.error };
    await settleRenameRequests(account.id, newRsn, 'approved', `Renamed to ${newRsn} by the clan owner`);
    snapshot = { v: 1, type: 'rename', accountId: account.id, before, after: { rsnNormalized: newNorm } };
  } else if (report.kind === 'merge') {
    return { ok: false, reason: "Joining two entries can't be undone, so Anvil does it by hand." };
  } else {
    return { ok: false, reason: 'Anvil looks at this kind of report by hand.' };
  }

  if (snapshot.type === 'owner') {
    const now = await db.query.accounts.findFirst({ where: eq(accounts.id, account.id), columns: { playerId: true, claimedAt: true } });
    snapshot.after = { playerId: now!.playerId, claimedAt: now!.claimedAt };
  }

  await db.insert(clanAuditLog).values({
    clanId: report.clanId,
    clanMemberId: await seatIn(report.clanId, account.id),
    eventType: APPLIED_EVENT,
    oldValue: JSON.stringify(snapshot),
    newValue: JSON.stringify({ reportId: report.id }),
    actorUserId,
    notes: `${report.kind.replace(/_/g, ' ')}: ${account.rsn}`,
  });
  await db
    .update(characterReports)
    .set({ status: 'applied', resolvedAt: new Date().toISOString(), resolvedByUserId: null, resolution: null })
    .where(and(eq(characterReports.id, report.id), eq(characterReports.status, 'open')));
  return { ok: true };
}

export type RaiseOutcome = { id: number; created: boolean; applied: boolean; why: string | null };

/**
 * File a report from a clan and, when `apply` (the clan owner), carry it out at once. When it cannot
 * be applied the report simply waits for staff as before, with the reason added for them, and the
 * reason comes back for the clan.
 */
export async function raiseCharacterReport(
  input: Parameters<typeof fileCharacterReport>[0],
  opts: { apply: boolean },
): Promise<RaiseOutcome> {
  const filed = await fileCharacterReport(input);
  if (!opts.apply || input.reportedByUserId == null) return { ...filed, applied: false, why: null };
  const current = await db.query.characterReports.findFirst({ where: eq(characterReports.id, filed.id), columns: { status: true } });
  if (current?.status === 'applied') return { ...filed, applied: true, why: null };
  const res = await applyCharacterReport(filed.id, input.reportedByUserId);
  if (res.ok) return { ...filed, applied: true, why: null };
  await noteNotApplied(filed.id, res.reason);
  return { ...filed, applied: false, why: res.reason };
}

/** Tell staff, on the report itself, why an owner's report is waiting rather than applied. */
export async function noteNotApplied(reportId: number, reason: string): Promise<void> {
  const row = await db.query.characterReports.findFirst({ where: eq(characterReports.id, reportId), columns: { body: true } });
  await db
    .update(characterReports)
    .set({ body: mergeCharacterReportBody(row?.body, `Not applied right away: ${reason}`) })
    .where(eq(characterReports.id, reportId));
}

export type RevertOutcome = { ok: true; already: boolean } | { ok: false; error: string };

/**
 * Undo an applied report. STAFF ONLY. Idempotent: the report is claimed 'applied' → 'reverted' in one
 * conditional write before anything is touched, so a second click (or a second staff member) gets
 * `already` instead of undoing twice. If the character has moved on since — somebody else linked it,
 * it was renamed again — nothing is touched and the report goes back to 'applied' with the reason.
 */
export async function revertCharacterReport(reportId: number, actorUserId: number, note?: string | null): Promise<RevertOutcome> {
  const prior = await db.query.characterReports.findFirst({ where: eq(characterReports.id, reportId) });
  if (!prior) return { ok: false, error: 'No such report.' };
  if (prior.status === 'reverted') return { ok: true, already: true };
  if (prior.status !== 'applied') return { ok: false, error: 'Only a report a clan owner applied can be reverted.' };

  const [claimed] = await db
    .update(characterReports)
    .set({
      status: 'reverted',
      resolvedByUserId: actorUserId,
      resolvedAt: new Date().toISOString(),
      resolution: note?.trim().slice(0, 2000) || 'Reverted by Anvil staff',
    })
    .where(and(eq(characterReports.id, reportId), eq(characterReports.status, 'applied')))
    .returning({ id: characterReports.id });
  if (!claimed) return { ok: true, already: true };

  const putBack = async (error: string): Promise<RevertOutcome> => {
    await db
      .update(characterReports)
      .set({ status: 'applied', resolvedByUserId: prior.resolvedByUserId, resolvedAt: prior.resolvedAt, resolution: prior.resolution })
      .where(eq(characterReports.id, reportId));
    return { ok: false, error };
  };

  const [entry] = await db
    .select({ oldValue: clanAuditLog.oldValue })
    .from(clanAuditLog)
    .where(and(eq(clanAuditLog.eventType, APPLIED_EVENT), eq(clanAuditLog.newValue, JSON.stringify({ reportId }))))
    .limit(1);
  let snap: Snapshot | null = null;
  try {
    snap = entry?.oldValue ? (JSON.parse(entry.oldValue) as Snapshot) : null;
  } catch {
    snap = null;
  }
  if (!snap || snap.accountId !== prior.accountId) return putBack('Nothing was kept to undo this one — fix it with the character tools.');

  const res = snap.type === 'owner' ? await undoOwner(snap, actorUserId) : await undoRename(snap, prior.requestedRsn, actorUserId);
  if (!res.ok) return putBack(res.reason);

  await db
    .insert(clanAuditLog)
    .values({
      clanId: prior.clanId,
      clanMemberId: await seatIn(prior.clanId, prior.accountId),
      eventType: REVERTED_EVENT,
      newValue: JSON.stringify({ reportId }),
      actorUserId,
      notes: note?.trim() || null,
    })
    .catch(() => {});
  return { ok: true, already: false };
}

/** The character's seat in the reporting clan, so the clan's log names who it was about. */
async function seatIn(clanId: number | null, accountId: number): Promise<number | null> {
  if (clanId == null) return null;
  const [seat] = await db
    .select({ id: clanMemberships.id })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.clanId, clanId), eq(clanMemberships.accountId, accountId)))
    .limit(1);
  return seat?.id ?? null;
}

async function undoOwner(snap: OwnerSnapshot, actorUserId: number): Promise<ApplyOutcome> {
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, snap.accountId) });
  if (!account) return { ok: false, reason: 'That character no longer exists.' };
  if (account.playerId !== snap.after.playerId || (account.claimedAt ?? null) !== (snap.after.claimedAt ?? null)) {
    return { ok: false, reason: 'The character has changed hands since, so it was left alone — fix it with the character tools.' };
  }

  // Back to the person it sat with. A claimed holder must still exist; an unclaimed character sat on
  // a placeholder person, which the claim folded away — a fresh placeholder is the same state.
  let target = snap.before.playerId;
  const exists = await db.query.players.findFirst({ where: eq(players.id, target), columns: { id: true } });
  if (!exists) {
    if (snap.before.claimedAt) return { ok: false, reason: 'The person it was taken from is no longer on Anvil.' };
    target = (await db.insert(players).values({ displayName: account.rsn }).returning({ id: players.id }))[0].id;
  }

  let isPrimary = snap.before.isPrimary;
  if (isPrimary === 1) {
    const other = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.playerId, target), eq(accounts.isPrimary, 1), ne(accounts.id, account.id)))
      .limit(1);
    if (other.length) isPrimary = 0;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(accounts)
      .set({
        playerId: target,
        claimedAt: snap.before.claimedAt,
        verifiedAt: snap.before.verifiedAt,
        verificationMethod: snap.before.verificationMethod,
        verifiedByUserId: snap.before.verifiedByUserId,
        provisional: snap.before.provisional,
        isPrimary,
        accountHash: snap.before.accountHash,
      })
      .where(eq(accounts.id, account.id));

    // The suggestion detach wrote so the former holder's plugin would not re-take it.
    if (snap.formerLogin) {
      const key = and(eq(detectedAccounts.userId, snap.formerLogin.userId), eq(detectedAccounts.rsnNormalized, snap.formerLogin.rsnNormalized));
      if (snap.formerLogin.row) {
        await tx.update(detectedAccounts).set(snap.formerLogin.row).where(key);
      } else {
        await tx.delete(detectedAccounts).where(key);
      }
    }

    if (snap.after.claimedAt == null) {
      // Detached: the placeholder detach minted is empty again — fold it into the person it came from.
      await mergeEmptyPersonInto(snap.after.playerId, target, actorUserId, tx);
    } else if (snap.after.playerId !== target) {
      // Given to someone: their plugin must not simply take it again (first-use auto-claim honours a
      // dismissed suggestion, as detachCharacter records). They can still prove it by the XP check.
      const logins = await tx.select({ id: users.id }).from(users).where(eq(users.playerId, snap.after.playerId));
      const nowIso = new Date().toISOString();
      for (const l of logins) {
        await tx
          .insert(detectedAccounts)
          .values({ userId: l.id, rsn: account.rsn, rsnNormalized: account.rsnNormalized, status: 'dismissed', detectedAt: nowIso, lastSeenAt: nowIso })
          .onConflictDoUpdate({ target: [detectedAccounts.userId, detectedAccounts.rsnNormalized], set: { status: 'dismissed', accountHash: null } });
      }
    }
  });
  return { ok: true };
}

async function undoRename(snap: RenameSnapshot, requestedRsn: string | null, actorUserId: number): Promise<ApplyOutcome> {
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, snap.accountId) });
  if (!account) return { ok: false, reason: 'That character no longer exists.' };
  if (account.rsnNormalized !== snap.after.rsnNormalized) {
    return { ok: false, reason: 'It has been renamed again since, so it was left alone.' };
  }
  const oldNorm = normalizeRsn(snap.before.rsn);
  const taken = await db.query.accounts.findFirst({
    where: and(eq(accounts.rsnNormalized, oldNorm), ne(accounts.id, account.id)),
    columns: { rsn: true },
  });
  if (taken) return { ok: false, reason: `Another entry now uses ${taken.rsn}, so the old name can't be put back.` };

  const res = await renameCharacter(account.id, snap.before.rsn, { actorUserId, via: 'staff', note: 'Rename reverted by Anvil staff', absorb: 'staff' });
  if (!res.ok) return { ok: false, reason: res.error };
  await db
    .update(accounts)
    .set({ previousRsns: snap.before.previousRsns, status: snap.before.status })
    .where(eq(accounts.id, account.id));

  // The player's own request for this name, approved when it was applied, is now a no.
  if (requestedRsn) {
    // clan-scope: global -- one character's seats in every clan; a rename is a fact about the character.
    const seatIds = (
      await db.select({ id: clanMemberships.id }).from(clanMemberships).where(eq(clanMemberships.accountId, account.id))
    ).map((x) => x.id);
    if (seatIds.length) {
      await db
        .update(pendingRenames)
        .set({ status: 'denied', resolution: 'Undone by Anvil staff', reviewedAt: new Date().toISOString() })
        .where(
          and(
            inArray(pendingRenames.clanMemberId, seatIds),
            eq(pendingRenames.status, 'approved'),
            eq(pendingRenames.newRsnNormalized, normalizeRsn(requestedRsn)),
          ),
        );
    }
  }
  return { ok: true };
}

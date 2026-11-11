// Clan ownership transfer as a REQUEST with a 3-day hold — the bank-PIN delay (rules in
// lib/ownershipTransferRules, the move itself in lib/clanOwnership).
//
//   1. ASK. The owner picks one of the clan's admins. A clan_ownership_transfers row goes 'pending'
//      with completes_at = now + 72h. Both people get an in-site notice (user_notices, shown on
//      /settings/claims) and a Discord DM where a bot can reach them. It lands in Anvil staff's
//      queue (/staff/ownership) — the support ticket.
//   2. WAIT. The owner may cancel, the target may decline, Anvil staff may block it (with a reason) or
//      let it through (off their queue; the hold still runs). The clan's admin pages carry a banner.
//   3. MOVE. The lifecycle tick (lib/eventLifecycle) completes a request whose hold ran out, with the
//      same transaction that moves the seats marking the row completed — if the target is still an
//      admin with a verified login and the asker is still the owner. Otherwise it is cancelled with
//      the reason, and both are told.
//
// Every step is in the clan's audit log (clan_audit_log, clan set); staff's block / let-through also
// write a `platform_*` row so they show in the operator log (/staff/audit).

import { and, asc, desc, eq, inArray, isNull, lte } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanOwnershipTransfers, clanStaff, clans, userNotices, users } from '@/db/schema';
import { isRealDiscordId } from '@/lib/anvilDiscordRoles';
import { clanGrant } from '@/lib/clanGrants';
import { moveClanOwnership } from '@/lib/clanOwnership';
import { log } from '@/lib/logger';
import { clanPathOf } from '@/lib/clanScopedPaths';
import {
  checkTransferAction,
  completionDecision,
  fmtTransferMoment,
  transferCompletesAt,
  type TransferAction,
  type TransferStatus,
} from '@/lib/ownershipTransferRules';

type TransferRow = typeof clanOwnershipTransfers.$inferSelect;

/** Swappable so a test can see what would be DMed, without Discord. */
export const transferDeps = {
  dm: async (userId: number, msg: { title: string; description: string }, path: string): Promise<boolean> => {
    const { discordDm } = await import('@/lib/ownershipClaims');
    return discordDm(userId, msg, path);
  },
};

const NOTICE_KIND = 'ownership_transfer';
/** Pending requests the tick completes per run: bounded, the rest wait a minute. */
const SETTLE_BATCH = 50;

async function names(clanId: number, userIds: number[]) {
  const [clan] = await db.select({ id: clans.id, name: clans.name, slug: clans.slug, kind: clans.kind }).from(clans).where(eq(clans.id, clanId));
  const rows = userIds.length
    ? await db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, userIds))
    : [];
  const byId = new Map(rows.map((r) => [r.id, r.displayName]));
  return { clan, name: (id: number) => byId.get(id) ?? 'someone' };
}

async function audit(clanId: number, eventType: string, actorUserId: number | null, t: TransferRow, extra: Record<string, unknown> = {}, notes?: string) {
  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      eventType,
      actorUserId,
      oldValue: JSON.stringify({ userId: t.fromUserId }),
      newValue: JSON.stringify({ transferId: t.id, userId: t.toUserId, completesAt: t.completesAt, ...extra }),
      notes: notes ?? null,
    })
    .catch(() => {});
}

/** An in-site notice (the record they were told) plus a best-effort DM linking to the clan's staff page. */
async function tell(userId: number, t: TransferRow, clan: { slug: string; kind?: string | null } | undefined, msg: { title: string; description: string }) {
  await db
    .insert(userNotices)
    .values({ userId, kind: NOTICE_KIND, refId: t.id, title: msg.title, body: msg.description, createdAt: new Date().toISOString() })
    .catch(() => {});
  const path = clan ? clanPathOf(clan, '/admin/people/staff') : '/settings/claims';
  transferDeps.dm(userId, msg, path).catch(() => false);
}

export type RequestOutcome =
  | { ok: true; transfer: TransferRow }
  | { ok: false; error: string; status: 400 | 403 | 404 | 409 };

/** The owner asks to hand `clanId` to one of its admins. */
export async function requestOwnershipTransfer(input: {
  clanId: number;
  fromUserId: number;
  toUserId: number;
  nowMs?: number;
}): Promise<RequestOutcome> {
  const nowMs = input.nowMs ?? Date.now();
  const { clanId, fromUserId, toUserId } = input;
  const fromGrant = await clanGrant(clanId, fromUserId);
  if (!fromGrant?.isOwner) return { ok: false, error: 'Only the current owner can transfer ownership', status: 403 };
  if (toUserId === fromUserId) return { ok: false, error: 'You are already the owner', status: 400 };
  const target = await db.query.users.findFirst({ where: eq(users.id, toUserId), columns: { id: true, discordId: true } });
  if (!target) return { ok: false, error: 'User not found', status: 404 };
  const toGrant = await clanGrant(clanId, toUserId);
  if (toGrant?.role !== 'admin') return { ok: false, error: 'Ownership can only be transferred to an admin', status: 400 };
  if (!isRealDiscordId(target.discordId)) {
    return { ok: false, error: 'They need an Anvil login linked to Discord before they can own a clan', status: 400 };
  }

  const nowIso = new Date(nowMs).toISOString();
  const [row] = await db
    .insert(clanOwnershipTransfers)
    .values({
      clanId,
      fromUserId,
      toUserId,
      status: 'pending',
      requestedAt: nowIso,
      completesAt: transferCompletesAt(nowMs),
      createdAt: nowIso,
      updatedAt: nowIso,
    })
    // One pending per clan (partial unique index): a second ask, or a double click, is refused.
    .onConflictDoNothing()
    .returning();
  if (!row) return { ok: false, error: 'A transfer is already pending — cancel it first to pick someone else', status: 409 };

  const { clan, name } = await names(clanId, [fromUserId, toUserId]);
  const when = fmtTransferMoment(row.completesAt);
  await audit(clanId, 'ownership_transfer_requested', fromUserId, row, {}, `${name(fromUserId)} asked to hand ownership to ${name(toUserId)}; moves ${when}`);
  await tell(fromUserId, row, clan, {
    title: `Ownership of ${clan?.name ?? 'your clan'} moves to ${name(toUserId)} on ${when}`,
    description: `You asked to make ${name(toUserId)} the owner of ${clan?.name ?? 'your clan'}. Nothing changes until ${when}; you can cancel it from the clan's admin pages any time before then. Anvil staff have been told, as they are for every ownership transfer.`,
  });
  await tell(toUserId, row, clan, {
    title: `${name(fromUserId)} is handing ${clan?.name ?? 'a clan'} to you`,
    description: `Unless it is cancelled, you become the owner of ${clan?.name ?? 'the clan'} on ${when}, and ${name(fromUserId)} becomes an ordinary admin. Don't want it? Decline from the clan's admin pages.`,
  });
  return { ok: true, transfer: row };
}

export type ActOutcome = { ok: true; transfer: TransferRow } | { ok: false; error: string; status: 403 | 404 | 409 };

/**
 * Cancel (the owner who asked), decline (the target), block / let through (platform staff).
 *
 * `clanId` scopes it: an owner or target acts on THEIR clan's pending request (no id needed); staff
 * address one by id across clans and pass `clanId: null`.
 */
export async function actOnOwnershipTransfer(input: {
  action: TransferAction;
  actorUserId: number;
  isPlatformStaff: boolean;
  clanId: number | null;
  transferId?: number;
  reason?: string | null;
  nowMs?: number;
}): Promise<ActOutcome> {
  const nowIso = new Date(input.nowMs ?? Date.now()).toISOString();
  const where =
    input.transferId != null
      ? input.clanId != null
        ? and(eq(clanOwnershipTransfers.id, input.transferId), eq(clanOwnershipTransfers.clanId, input.clanId))
        : eq(clanOwnershipTransfers.id, input.transferId)
      : input.clanId != null
        ? and(eq(clanOwnershipTransfers.clanId, input.clanId), eq(clanOwnershipTransfers.status, 'pending'))
        : null;
  if (!where) return { ok: false, error: 'Not found', status: 404 };
  const t = await db.query.clanOwnershipTransfers.findFirst({ where });
  if (!t) return { ok: false, error: 'No pending ownership transfer', status: 404 };

  const check = checkTransferAction(t, { userId: input.actorUserId, isPlatformStaff: input.isPlatformStaff }, input.action);
  if (!check.ok) return { ok: false, error: check.error, status: check.code };
  const reason = input.reason?.trim().slice(0, 500) || null;

  // Staff letting it through: it completes now, through the same guarded move as the end of the hold.
  if (input.action === 'clear') {
    const done = await completeTransfer(t, nowIso, input.actorUserId);
    if (!done.ok) return { ok: false, error: done.error, status: 409 };
    return { ok: true, transfer: done.transfer };
  }

  const [updated] = await db
    .update(clanOwnershipTransfers)
    .set({ status: check.next, decidedAt: nowIso, decidedByUserId: input.actorUserId, reason, updatedAt: nowIso })
    // Only from pending — a tick completing it at the same instant wins, and this one says so.
    .where(and(eq(clanOwnershipTransfers.id, t.id), eq(clanOwnershipTransfers.status, 'pending')))
    .returning();
  if (!updated) return { ok: false, error: 'That transfer is no longer pending.', status: 409 };

  const { clan, name } = await names(t.clanId, [t.fromUserId, t.toUserId, input.actorUserId]);
  const clanName = clan?.name ?? 'the clan';
  const eventType = `ownership_transfer_${check.next}`;
  const lines: Record<Exclude<TransferStatus, 'pending' | 'completed'>, { title: string; description: string; notes: string }> = {
    cancelled: {
      title: `Ownership transfer of ${clanName} cancelled`,
      description: `${name(t.fromUserId)} cancelled handing ${clanName} to ${name(t.toUserId)}. Nothing changed: ${name(t.fromUserId)} is still the owner.`,
      notes: `${name(t.fromUserId)} cancelled the transfer to ${name(t.toUserId)}`,
    },
    declined: {
      title: `${name(t.toUserId)} declined ownership of ${clanName}`,
      description: `${name(t.toUserId)} turned down becoming the owner of ${clanName}. Nothing changed: ${name(t.fromUserId)} is still the owner.`,
      notes: `${name(t.toUserId)} declined the transfer`,
    },
    blocked: {
      title: `Anvil staff stopped the ownership transfer of ${clanName}`,
      description: `Anvil staff blocked handing ${clanName} from ${name(t.fromUserId)} to ${name(t.toUserId)}${reason ? `: ${reason}` : '.'} Nothing changed. Ask in the Anvil Discord if you have questions.`,
      notes: `Blocked by Anvil staff (${name(input.actorUserId)})${reason ? `: ${reason}` : ''}`,
    },
  };
  const line = lines[check.next as 'cancelled' | 'declined' | 'blocked'];
  await audit(t.clanId, eventType, input.actorUserId, updated, reason ? { reason } : {}, line.notes);
  if (check.next === 'blocked') {
    // Also the operator log (/staff/audit only reads `platform_*`; the clan's history hides those).
    await audit(t.clanId, 'platform_ownership_transfer_blocked', input.actorUserId, updated, { reason }, `Blocked ${name(t.fromUserId)} → ${name(t.toUserId)}${reason ? `: ${reason}` : ''}`);
  }
  for (const uid of [t.fromUserId, t.toUserId]) await tell(uid, updated, clan, line);
  return { ok: true, transfer: updated };
}

/**
 * The lifecycle tick: complete every pending request whose hold has run out — or cancel it with the
 * reason it can't go ahead. Bounded (SETTLE_BATCH, oldest first) and idempotent: the move and the
 * row's 'completed' are one transaction guarded on 'pending', so a rerun or a racing cancel can never
 * move ownership twice or move it under a cancelled request.
 */
export async function settleOwnershipTransfers(nowMs = Date.now()): Promise<number> {
  const nowIso = new Date(nowMs).toISOString();
  // clan-scope: global -- the platform's sweep over every clan's pending transfers.
  const due = await db
    .select()
    .from(clanOwnershipTransfers)
    .where(and(eq(clanOwnershipTransfers.status, 'pending'), lte(clanOwnershipTransfers.completesAt, nowIso)))
    .orderBy(asc(clanOwnershipTransfers.completesAt))
    .limit(SETTLE_BATCH);
  let moved = 0;
  for (const t of due) {
    try {
      if ((await settleOne(t, nowIso)) === 'completed') moved++;
    } catch (err) {
      log.warn('ownership-transfer.settle-failed', { transferId: t.id, err: String(err) });
    }
  }
  return moved;
}

async function settleOne(t: TransferRow, nowIso: string): Promise<'completed' | 'cancelled' | 'skipped'> {
  const done = await completeTransfer(t, nowIso, null);
  if (done.ok) return 'completed';
  if (done.superseded) return 'skipped';
  const { clan, name } = await names(t.clanId, [t.fromUserId, t.toUserId]);
  return cancelLapsed(t, nowIso, done.error, clan, clan?.name ?? 'the clan', name);
}

/**
 * Move ownership for a pending request now: at the end of its hold (`staffUserId` null) or because
 * Anvil staff let it through. The checks the hold ends on, then the move and the row's 'completed' in
 * one transaction guarded on 'pending'. On failure nothing changes; the caller decides (the tick
 * cancels with the reason, staff just hear it).
 */
async function completeTransfer(
  t: TransferRow,
  nowIso: string,
  staffUserId: number | null,
): Promise<{ ok: true; transfer: TransferRow } | { ok: false; error: string; superseded?: boolean }> {
  const [fromGrant, toGrant, target] = await Promise.all([
    clanGrant(t.clanId, t.fromUserId),
    clanGrant(t.clanId, t.toUserId),
    db.query.users.findFirst({ where: eq(users.id, t.toUserId), columns: { discordId: true } }),
  ]);
  const decision = completionDecision({
    fromRole: fromGrant?.role ?? null,
    targetRole: toGrant?.role ?? null,
    targetVerified: isRealDiscordId(target?.discordId),
  });
  if (!decision.complete) return { ok: false, error: decision.reason };
  let finished: TransferRow | undefined;
  const res = await moveClanOwnership(t.clanId, t.fromUserId, t.toUserId, async (tx) => {
    [finished] = await tx
      .update(clanOwnershipTransfers)
      .set({
        status: 'completed',
        decidedAt: nowIso,
        decidedByUserId: staffUserId,
        ...(staffUserId != null ? { staffClearedAt: nowIso, staffClearedByUserId: staffUserId } : {}),
        updatedAt: nowIso,
      })
      .where(and(eq(clanOwnershipTransfers.id, t.id), eq(clanOwnershipTransfers.status, 'pending')))
      .returning();
    return finished != null;
  });
  if (!res.ok || !finished) {
    if (!res.ok && res.reason === 'superseded') return { ok: false, error: 'That transfer is no longer pending.', superseded: true };
    return { ok: false, error: !res.ok && res.reason === 'from-not-owner' ? 'The person who asked is no longer the owner.' : 'They are no longer an admin of this clan.' };
  }
  const { clan, name } = await names(t.clanId, [t.fromUserId, t.toUserId, ...(staffUserId != null ? [staffUserId] : [])]);
  const clanName = clan?.name ?? 'the clan';
  const early = staffUserId != null;
  // Same event type the instant transfer always wrote, so history reads the same.
  await audit(t.clanId, 'ownership_transferred', early ? staffUserId : t.fromUserId, finished, {},
    `Ownership transferred from ${name(t.fromUserId)} to ${name(t.toUserId)} ${early ? `(by Anvil staff, ${name(staffUserId as number)})` : 'after the 3-day hold'}`);
  if (early) {
    await audit(t.clanId, 'platform_ownership_transfer_cleared', staffUserId, finished, {}, `${name(t.fromUserId)} → ${name(t.toUserId)}, completed now`);
  }
  const msg = {
    title: `${name(t.toUserId)} now owns ${clanName}`,
    description: `${early ? 'Anvil staff completed it' : 'The 3-day hold ran out'}: ${name(t.toUserId)} is the owner of ${clanName}, and ${name(t.fromUserId)} is an ordinary admin. Only the new owner can transfer it again.`,
  };
  for (const uid of [t.fromUserId, t.toUserId]) await tell(uid, finished, clan, msg);
  return { ok: true, transfer: finished };
}

/**
 * Anvil staff, for recovery (a hijacked or vanished owner): hand the clan to one of its admins NOW, no
 * request or hold. A reason is required and both people are told. A pending request is superseded.
 * A clan with no owner at all is the directory's "appoint an owner" instead.
 */
export async function staffTransferNow(input: {
  clanId: number;
  toUserId: number;
  actorUserId: number;
  reason: string;
  nowMs?: number;
}): Promise<{ ok: true; transfer: TransferRow } | { ok: false; error: string; status: number }> {
  const reason = input.reason.trim().slice(0, 500);
  if (!reason) return { ok: false, error: 'Say why — both people are told.', status: 400 };
  const nowIso = new Date(input.nowMs ?? Date.now()).toISOString();
  // clan-scope: platform staff acting on one named clan.
  const owner = await db.query.clanStaff.findFirst({
    where: and(eq(clanStaff.clanId, input.clanId), eq(clanStaff.role, 'owner')),
    columns: { userId: true },
  });
  if (!owner) return { ok: false, error: 'This clan has no owner — appoint one from the directory instead.', status: 409 };
  if (owner.userId === input.toUserId) return { ok: false, error: 'They already own this clan.', status: 400 };

  // Any pending request makes way first (one pending per clan).
  await db
    .update(clanOwnershipTransfers)
    .set({ status: 'cancelled', decidedAt: nowIso, decidedByUserId: input.actorUserId, reason: 'Superseded by an Anvil staff transfer', updatedAt: nowIso })
    .where(and(eq(clanOwnershipTransfers.clanId, input.clanId), eq(clanOwnershipTransfers.status, 'pending')));
  const [row] = await db
    .insert(clanOwnershipTransfers)
    .values({
      clanId: input.clanId,
      fromUserId: owner.userId,
      toUserId: input.toUserId,
      status: 'pending',
      requestedAt: nowIso,
      completesAt: nowIso,
      reason,
      createdAt: nowIso,
      updatedAt: nowIso,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) return { ok: false, error: 'Another transfer started at the same moment — try again.', status: 409 };
  const done = await completeTransfer(row, nowIso, input.actorUserId);
  if (!done.ok) {
    await db
      .update(clanOwnershipTransfers)
      .set({ status: 'cancelled', decidedAt: nowIso, decidedByUserId: input.actorUserId, reason: done.error, updatedAt: nowIso })
      .where(and(eq(clanOwnershipTransfers.id, row.id), eq(clanOwnershipTransfers.status, 'pending')));
    return { ok: false, error: done.error, status: 409 };
  }
  return { ok: true, transfer: done.transfer };
}

async function cancelLapsed(
  t: TransferRow,
  nowIso: string,
  reason: string,
  clan: { slug: string; kind?: string | null } | undefined,
  clanName: string,
  name: (id: number) => string,
): Promise<'cancelled' | 'skipped'> {
  const [row] = await db
    .update(clanOwnershipTransfers)
    .set({ status: 'cancelled', decidedAt: nowIso, decidedByUserId: null, reason, updatedAt: nowIso })
    .where(and(eq(clanOwnershipTransfers.id, t.id), eq(clanOwnershipTransfers.status, 'pending')))
    .returning();
  if (!row) return 'skipped';
  await audit(t.clanId, 'ownership_transfer_lapsed', null, row, { reason }, `Transfer to ${name(t.toUserId)} cancelled: ${reason}`);
  const msg = {
    title: `Ownership transfer of ${clanName} cancelled`,
    description: `Handing ${clanName} from ${name(t.fromUserId)} to ${name(t.toUserId)} did not go ahead: ${reason} Nothing changed.`,
  };
  for (const uid of [t.fromUserId, t.toUserId]) await tell(uid, row, clan, msg);
  return 'cancelled';
}

// ── Reads ──────────────────────────────────────────────────────────────────────────────────────

export interface TransferView {
  id: number;
  clanId: number;
  fromUserId: number;
  fromName: string;
  toUserId: number;
  toName: string;
  status: TransferStatus;
  requestedAt: string;
  completesAt: string;
  decidedAt: string | null;
  reason: string | null;
  staffClearedAt: string | null;
}

async function toViews(rows: TransferRow[]): Promise<TransferView[]> {
  const ids = [...new Set(rows.flatMap((r) => [r.fromUserId, r.toUserId]))];
  const people = ids.length ? await db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, ids)) : [];
  const byId = new Map(people.map((p) => [p.id, p.displayName]));
  return rows.map((r) => ({
    id: r.id,
    clanId: r.clanId,
    fromUserId: r.fromUserId,
    fromName: byId.get(r.fromUserId) ?? 'Unknown',
    toUserId: r.toUserId,
    toName: byId.get(r.toUserId) ?? 'Unknown',
    status: r.status as TransferStatus,
    requestedAt: r.requestedAt,
    completesAt: r.completesAt,
    decidedAt: r.decidedAt,
    reason: r.reason,
    staffClearedAt: r.staffClearedAt,
  }));
}

/** This clan's pending transfer, if any — the admin banner and the staff page's "Make owner" state. */
export async function pendingTransferForClan(clanId: number): Promise<TransferView | null> {
  const row = await db.query.clanOwnershipTransfers.findFirst({
    where: and(eq(clanOwnershipTransfers.clanId, clanId), eq(clanOwnershipTransfers.status, 'pending')),
  });
  return row ? (await toViews([row]))[0] : null;
}

export interface StaffTransferView extends TransferView {
  clanName: string;
  clanSlug: string;
}

/** Anvil staff's queue: pending first (soonest to move), then recent history. */
export async function listOwnershipTransfers(opts: { status?: 'pending' | 'all'; clanId?: number } = {}): Promise<StaffTransferView[]> {
  const conds = [];
  if (opts.status !== 'all') conds.push(eq(clanOwnershipTransfers.status, 'pending'));
  if (opts.clanId != null) conds.push(eq(clanOwnershipTransfers.clanId, opts.clanId));
  // clan-scope: global -- the platform staff queue across every clan (optionally one).
  const rows = await db
    .select()
    .from(clanOwnershipTransfers)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(opts.status === 'all' ? desc(clanOwnershipTransfers.id) : asc(clanOwnershipTransfers.completesAt))
    .limit(200);
  const views = await toViews(rows);
  const clanIds = [...new Set(rows.map((r) => r.clanId))];
  const clanRows = clanIds.length ? await db.select({ id: clans.id, name: clans.name, slug: clans.slug }).from(clans).where(inArray(clans.id, clanIds)) : [];
  const byClan = new Map(clanRows.map((c) => [c.id, c]));
  return views.map((v) => ({ ...v, clanName: byClan.get(v.clanId)?.name ?? 'Unknown clan', clanSlug: byClan.get(v.clanId)?.slug ?? '' }));
}

/** Pending transfers staff have not looked at yet: the badge on /staff. */
export async function unreviewedTransferCount(): Promise<number> {
  // clan-scope: global -- platform staff queue count.
  const rows = await db
    .select({ id: clanOwnershipTransfers.id })
    .from(clanOwnershipTransfers)
    .where(and(eq(clanOwnershipTransfers.status, 'pending'), isNull(clanOwnershipTransfers.staffClearedAt)));
  return rows.length;
}

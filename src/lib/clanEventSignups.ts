import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanEventSignups, clanEvents, clanRoster, users, type ClanEvent } from '@/db/schema';
import { parseModules, signupWindow } from '@/lib/clanEventModules';
import { loadQuestions } from '@/lib/clanEventQuestions';
import { getRequiredConfirmations } from '@/lib/feeConfirmations';
import { decideConfirmation, settlesOnCollect } from '@/lib/feeRules';
import { del } from '@/lib/storage';
import { validateAnswers } from '@/lib/survey';

// Sign-ups on a clan event (lib/clanEventModules), and the entry fee that rides on each one. The fee
// moves through the same states as a board's (unpaid → collected → confirmed, or disputed), settled
// by the same rule (lib/feeRules decideConfirmation) against the clan's own confirmation setting.

export type Signup = typeof clanEventSignups.$inferSelect;

/** Taking a place: pending and approved. Rejected and withdrawn ones don't count toward the cap. */
export const ACTIVE = ['pending', 'approved'];

/** The event, in this clan, not called off. */
export async function liveClanEvent(clanId: number, id: number): Promise<ClanEvent | null> {
  if (!Number.isInteger(id)) return null;
  const e = await db.query.clanEvents.findFirst({ where: and(eq(clanEvents.id, id), eq(clanEvents.clanId, clanId), isNull(clanEvents.cancelledAt)) });
  return e ?? null;
}

/** The person's accounts in this clan, main first — what they can sign up as. */
export async function seatsFor(clanId: number, playerId: number | null): Promise<{ id: number; rsn: string }[]> {
  if (playerId == null) return [];
  const rows = await db
    .select({ id: clanRoster.id, rsn: clanRoster.rsn, primary: clanRoster.isPrimary })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clanId), eq(clanRoster.playerId, playerId), isNull(clanRoster.leftAt)));
  return rows.sort((a, b) => b.primary - a.primary || a.rsn.localeCompare(b.rsn)).map(({ id, rsn }) => ({ id, rsn }));
}

export async function mySignup(clanId: number, eventId: number, key: string, userId: number): Promise<Signup | null> {
  const row = await db.query.clanEventSignups.findFirst({
    where: and(eq(clanEventSignups.clanId, clanId), eq(clanEventSignups.clanEventId, eventId), eq(clanEventSignups.occurrence, key), eq(clanEventSignups.userId, userId)),
  });
  return row ?? null;
}

export async function activeCount(clanId: number, eventId: number, key: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clanEventSignups)
    .where(and(eq(clanEventSignups.clanId, clanId), eq(clanEventSignups.clanEventId, eventId), eq(clanEventSignups.occurrence, key), inArray(clanEventSignups.status, ACTIVE)));
  return r?.n ?? 0;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number };
const fail = (error: string, status = 400) => ({ ok: false as const, error, status });

/**
 * Sign up, or change your answers. Refused while sign-ups are shut, when it's full, and when staff
 * already turned this person down. An event with a fee owes it from here.
 */
export async function signUp(
  clanId: number,
  eventId: number,
  who: { userId: number; playerId: number | null; displayName: string | null },
  input: { clanMemberId?: unknown; answers?: unknown },
  now = Date.now(),
): Promise<Result<Signup>> {
  const e = await liveClanEvent(clanId, eventId);
  if (!e) return fail('That event isn’t on any more.', 404);
  const m = parseModules(e.modules);
  const w = signupWindow(m, e, now);
  if (!w.open) return fail(w.reason, 409);

  const checked = validateAnswers(await loadQuestions(clanId, eventId, 'signup'), input.answers ?? {});
  if (!checked.ok) return fail(checked.error);

  const seats = await seatsFor(clanId, who.playerId);
  const seat = seats.find((s) => s.id === Number(input.clanMemberId)) ?? seats[0] ?? null;
  const rsn = seat?.rsn ?? who.displayName?.trim() ?? '';
  if (!rsn) return fail('Link an account to this clan first, so the host knows who you are.');

  const prior = await mySignup(clanId, eventId, w.key, who.userId);
  if (prior?.status === 'rejected') return fail('The host turned this sign-up down.', 403);
  const stamp = new Date(now).toISOString();
  if (prior && ACTIVE.includes(prior.status)) {
    const [row] = await db
      .update(clanEventSignups)
      .set({ answers: checked.clean, clanMemberId: seat?.id ?? null, rsn, updatedAt: stamp })
      .where(eq(clanEventSignups.id, prior.id))
      .returning();
    return { ok: true, value: row };
  }

  if (m.signups.cap != null && (await activeCount(clanId, eventId, w.key)) >= m.signups.cap) return fail('It’s full.', 409);
  const status = m.signups.approval ? 'pending' : 'approved';
  // Coming back after withdrawing keeps any fee already handed over — the money didn't move.
  const fee = prior?.feeStatus && prior.feeStatus !== 'pending' ? {} : m.fee.on ? { feeAmount: m.fee.amount, feeStatus: 'pending' } : { feeAmount: null, feeStatus: null };
  const values = { answers: checked.clean, clanMemberId: seat?.id ?? null, rsn, status, updatedAt: stamp, ...fee };
  const [row] = prior
    ? await db.update(clanEventSignups).set(values).where(eq(clanEventSignups.id, prior.id)).returning()
    : await db.insert(clanEventSignups).values({ clanId, clanEventId: eventId, occurrence: w.key, userId: who.userId, ...values }).returning();

  // Two people taking the last place at once: the later one gives it back.
  if (m.signups.cap != null && (await activeCount(clanId, eventId, w.key)) > m.signups.cap) {
    await db.update(clanEventSignups).set({ status: 'withdrawn' }).where(eq(clanEventSignups.id, row.id));
    return fail('It’s full.', 409);
  }
  return { ok: true, value: row };
}

/**
 * Take your name off. A sign-up whose fee was handed over stays on the books as withdrawn, so the
 * money is still accounted for; one with nothing to account for is simply gone.
 */
export async function withdraw(clanId: number, eventId: number, userId: number, now = Date.now()): Promise<Result<null>> {
  const e = await liveClanEvent(clanId, eventId);
  if (!e) return fail('That event isn’t on any more.', 404);
  const w = signupWindow(parseModules(e.modules), e, now);
  if (!w.open) return fail('Sign-ups are closed — ask the host to take you off.', 409);
  const prior = await mySignup(clanId, eventId, w.key, userId);
  if (!prior) return { ok: true, value: null };
  if (prior.feeStatus && prior.feeStatus !== 'pending') {
    await db.update(clanEventSignups).set({ status: 'withdrawn', updatedAt: new Date(now).toISOString() }).where(eq(clanEventSignups.id, prior.id));
  } else {
    await db.delete(clanEventSignups).where(eq(clanEventSignups.id, prior.id));
  }
  return { ok: true, value: null };
}

export interface SignupRow extends Signup {
  displayName: string | null;
}

/** Everyone under one key, for staff: oldest first, so the order is who asked first. */
export async function listSignups(clanId: number, eventId: number, key: string): Promise<SignupRow[]> {
  const rows = await db
    .select({ s: clanEventSignups, displayName: users.displayName })
    .from(clanEventSignups)
    .leftJoin(users, eq(users.id, clanEventSignups.userId))
    .where(and(eq(clanEventSignups.clanId, clanId), eq(clanEventSignups.clanEventId, eventId), eq(clanEventSignups.occurrence, key)))
    .orderBy(asc(clanEventSignups.id));
  return rows.map((r) => ({ ...r.s, displayName: r.displayName }));
}

/** The names on the list (active only), for the event page, the plugin and Discord. */
export async function activeNames(clanId: number, eventIds: number[]): Promise<{ eventId: number; occurrence: string; userId: number; rsn: string }[]> {
  if (!eventIds.length) return [];
  return db
    .select({ eventId: clanEventSignups.clanEventId, occurrence: clanEventSignups.occurrence, userId: clanEventSignups.userId, rsn: clanEventSignups.rsn })
    .from(clanEventSignups)
    .where(and(eq(clanEventSignups.clanId, clanId), inArray(clanEventSignups.clanEventId, eventIds), inArray(clanEventSignups.status, ACTIVE)))
    .orderBy(asc(clanEventSignups.id));
}

async function staffSignup(clanId: number, eventId: number, signupId: number): Promise<Signup | null> {
  const row = await db.query.clanEventSignups.findFirst({
    where: and(eq(clanEventSignups.id, signupId), eq(clanEventSignups.clanId, clanId), eq(clanEventSignups.clanEventId, eventId)),
  });
  return row ?? null;
}

/** Staff: approve, turn down, or take someone off. */
export async function setSignupStatus(clanId: number, eventId: number, signupId: number, status: 'approved' | 'rejected' | 'withdrawn'): Promise<Result<Signup>> {
  const row = await staffSignup(clanId, eventId, signupId);
  if (!row) return fail('Not found', 404);
  if (status === 'approved' && !ACTIVE.includes(row.status)) {
    const e = await liveClanEvent(clanId, eventId);
    const cap = e ? parseModules(e.modules).signups.cap : null;
    if (cap != null && (await activeCount(clanId, eventId, row.occurrence)) >= cap) return fail('It’s full — take someone off first.', 409);
  }
  const [updated] = await db.update(clanEventSignups).set({ status, updatedAt: new Date().toISOString() }).where(eq(clanEventSignups.id, row.id)).returning();
  return { ok: true, value: updated };
}

// ── The fee ──────────────────────────────────────────────────────────────────────────────────────

export type FeeAction = 'collect' | 'confirm' | 'dispute' | 'reset';

function audit(clanId: number, actorUserId: number, row: Signup, eventType: string, extra: Record<string, unknown> = {}) {
  db.insert(clanAuditLog)
    .values({
      clanId,
      clanMemberId: row.clanMemberId,
      eventType,
      newValue: JSON.stringify({ clanEventId: row.clanEventId, signupId: row.id, occurrence: row.occurrence, amount: row.feeAmount, ...extra }),
      actorUserId: actorUserId > 0 ? actorUserId : null,
    })
    .catch(() => {});
}

/**
 * One move on one fee. The caller has already decided who may make it (collectors collect, admins
 * confirm and reset, any staff disputes); this is how the fee moves.
 */
export async function moveFee(
  clanId: number,
  eventId: number,
  signupId: number,
  action: FeeAction,
  actorUserId: number,
  opts: { proofUrl?: string | null; force?: boolean; note?: string | null } = {},
): Promise<Result<Signup>> {
  const row = await staffSignup(clanId, eventId, signupId);
  if (!row || row.feeStatus == null) return fail('No fee on that sign-up.', 404);
  const now = new Date().toISOString();
  const required = await getRequiredConfirmations(clanId);
  const save = async (set: Partial<Signup>) => (await db.update(clanEventSignups).set(set).where(eq(clanEventSignups.id, row.id)).returning())[0];

  if (action === 'collect') {
    if (row.feeStatus === 'confirmed') return fail('Already settled — reset it first.', 409);
    if (row.proofUrl && opts.proofUrl && row.proofUrl !== opts.proofUrl) del(row.proofUrl).catch(() => {});
    const settle = settlesOnCollect(required);
    const updated = await save({
      feeStatus: settle ? 'confirmed' : 'collected',
      collectedByUserId: actorUserId,
      collectedAt: now,
      proofUrl: opts.proofUrl ?? row.proofUrl,
      confirmations: null,
      confirmedByUserId: settle ? actorUserId : null,
      confirmedAt: settle ? now : null,
    });
    if (settle) audit(clanId, actorUserId, row, 'clan_event_fee_confirmed', { noSignature: true });
    return { ok: true, value: updated };
  }

  if (action === 'confirm') {
    const decision = decideConfirmation(
      { status: row.feeStatus, collectedByUserId: row.collectedByUserId, confirmations: row.confirmations ?? [] },
      actorUserId,
      required,
      now,
      opts.force ? { auto: true } : {},
    );
    if (decision.outcome === 'own-collection') return fail('You collected this fee, so another admin must confirm it.', 403);
    if (decision.outcome === 'not-collected') return fail('No one has marked this fee paid yet.');
    if (decision.outcome === 'noop') return { ok: true, value: row };
    if (row.proofUrl && decision.dropProof) del(row.proofUrl).catch(() => {});
    const updated = await save({
      confirmations: decision.confirmations,
      feeStatus: decision.settled ? 'confirmed' : row.feeStatus,
      confirmedByUserId: decision.settled ? actorUserId : null,
      confirmedAt: decision.settled ? now : null,
      proofUrl: decision.dropProof ? null : row.proofUrl,
    });
    if (decision.settled) audit(clanId, actorUserId, row, 'clan_event_fee_confirmed', opts.force ? { forced: true } : {});
    return { ok: true, value: updated };
  }

  if (action === 'dispute') {
    if (row.feeStatus === 'confirmed') return fail('This fee is already confirmed — reset it before disputing.', 409);
    return { ok: true, value: await save({ feeStatus: 'disputed', feeNotes: opts.note?.trim() || row.feeNotes }) };
  }

  // reset
  if (row.proofUrl) del(row.proofUrl).catch(() => {});
  const updated = await save({ feeStatus: 'pending', collectedByUserId: null, collectedAt: null, proofUrl: null, confirmations: null, confirmedByUserId: null, confirmedAt: null });
  audit(clanId, actorUserId, row, 'clan_event_fee_reset');
  return { ok: true, value: updated };
}

/** Fees collected under a key — what the pot counts (money in, not money owed). */
export async function collectedFeesGp(clanId: number, eventId: number, key: string): Promise<number> {
  const [r] = await db
    .select({ gp: sql<number>`coalesce(sum(${clanEventSignups.feeAmount}), 0)::bigint` })
    .from(clanEventSignups)
    .where(and(eq(clanEventSignups.clanId, clanId), eq(clanEventSignups.clanEventId, eventId), eq(clanEventSignups.occurrence, key), inArray(clanEventSignups.feeStatus, ['collected', 'confirmed'])));
  return Number(r?.gp ?? 0);
}

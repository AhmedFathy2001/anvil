import { db } from '@/db';
import { clanAuditLog, eventSignups, settings, signupFees } from '@/db/schema';
import { and, eq, notInArray } from 'drizzle-orm';
import { del } from '@/lib/storage';
import {
  clampRequiredConfirmations,
  decideConfirmation,
  settlesOnCollect,
  type ConfirmOutcome,
  type FeeConfirmation,
} from '@/lib/feeRules';

export { settlesOnCollect };
export type { ConfirmOutcome, FeeConfirmation };

// How many distinct staff confirmations a paid fee needs before it's settled. Admin-set via the
// `fee_confirmations_required` setting; defaults to 1 (a single second pair of eyes). 0 means the
// clan has turned the second signature off — see lib/feeRules for why that exists.
export async function getRequiredConfirmations(): Promise<number> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, 'fee_confirmations_required'),
  });
  return clampRequiredConfirmations(row?.value);
}

export function parseConfirmations(json: string | null | undefined): FeeConfirmation[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (e): e is FeeConfirmation => e && typeof e.userId === 'number' && typeof e.at === 'string',
    );
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Applying a confirmation. One implementation, shared by the per-fee route, the bulk "confirm all"
// action and the end-of-event auto-close, so the separation-of-duties rule can't drift between them.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface ConfirmResult {
  outcome: ConfirmOutcome;
  confirmations: number;
  required: number;
}

/**
 * Record one admin's confirmation of one fee.
 *
 * `actorUserId` of 0 (or less) means "no human actor" — the end-of-event auto-close. That path
 * bypasses the separation-of-duties check by design, because there is nobody to be separate from;
 * it's gated behind an explicit clan setting instead, and `auto` is recorded in the audit trail so
 * the difference stays visible afterwards.
 */
export async function applyFeeConfirmation(
  feeId: number,
  actorUserId: number,
  opts: { auto?: boolean } = {},
): Promise<ConfirmResult> {
  const required = await getRequiredConfirmations();
  const fee = await db.query.signupFees.findFirst({ where: eq(signupFees.id, feeId) });
  if (!fee) return { outcome: 'noop', confirmations: 0, required };

  const now = new Date().toISOString();
  const decision = decideConfirmation(
    {
      status: fee.status,
      collectedByUserId: fee.collectedByUserId,
      confirmations: parseConfirmations(fee.confirmations),
    },
    actorUserId,
    required,
    now,
    opts,
  );

  if (decision.outcome === 'own-collection' || decision.outcome === 'not-collected') {
    return { outcome: decision.outcome, confirmations: 0, required };
  }
  if (decision.outcome === 'noop') {
    return { outcome: 'noop', confirmations: decision.confirmations.length, required };
  }

  if (fee.proofBlobUrl && decision.dropProof) {
    del(fee.proofBlobUrl).catch(() => {});
  }

  await db
    .update(signupFees)
    .set({
      confirmations: JSON.stringify(decision.confirmations),
      status: decision.settled ? 'confirmed' : fee.status,
      confirmedByUserId: decision.settled && actorUserId > 0 ? actorUserId : null,
      confirmedAt: decision.settled ? now : null,
      proofBlobUrl: decision.dropProof ? null : fee.proofBlobUrl,
    })
    .where(eq(signupFees.id, feeId));

  if (decision.settled) {
    await recordFeeSettled(feeId, fee.signupId, fee.amount, fee.collectedByUserId, actorUserId, {
      auto: opts.auto === true,
      noSignature: settlesOnCollect(required),
    });
  }

  return {
    outcome: decision.outcome,
    confirmations: decision.confirmations.length,
    required,
  };
}

/**
 * One audit entry per settled fee, whoever settled it and however.
 *
 * `noSignature` marks the ones a clan settled with the second signature turned off, so a later read
 * of the trail can tell "an admin signed this off" from "this clan does not require one" — the
 * difference matters if anyone ever asks where the money went.
 */
export async function recordFeeSettled(
  feeId: number,
  signupId: number,
  amount: number,
  collectedByUserId: number | null,
  actorUserId: number,
  flags: { auto?: boolean; noSignature?: boolean } = {},
): Promise<void> {
  const signup = await db.query.eventSignups.findFirst({ where: eq(eventSignups.id, signupId) });
  db.insert(clanAuditLog)
    .values({
      clanMemberId: signup?.clanMemberId ?? null,
      eventType: 'fee_confirmed',
      newValue: JSON.stringify({
        feeId,
        amount,
        collectedByUserId,
        ...(flags.auto ? { auto: true } : {}),
        ...(flags.noSignature ? { noSignature: true } : {}),
      }),
      actorUserId: actorUserId > 0 ? actorUserId : null,
    })
    .catch(() => {});
}

/**
 * Whether an event ending should settle its already-collected fees automatically.
 *
 * OFF by default, and deliberately opt-in: the confirmation step exists so one person can't both
 * take the money and mark it received, and turning this on removes that check for anything already
 * marked collected. It's the right trade for a small clan where the treasurer IS the admin and the
 * queue would otherwise nag forever — and the wrong one for a clan that wants the audit trail.
 *
 * Note what it does NOT do: fees nobody has collected (pending/reported/disputed) are untouched, so
 * this can never mark unpaid money as received. It only closes out fees a mod already said they had.
 */
export async function shouldAutoConfirmOnEventEnd(): Promise<boolean> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, 'fee_autoconfirm_on_event_end'),
  });
  return row?.value === 'true' || row?.value === '1';
}

/**
 * Settle every collected-but-unconfirmed fee for one event. Returns how many were closed.
 * Caller checks {@link shouldAutoConfirmOnEventEnd} — this does the work unconditionally.
 */
export async function autoConfirmEventFees(eventId: number): Promise<number> {
  const rows = await db
    .select({ id: signupFees.id })
    .from(signupFees)
    .innerJoin(eventSignups, eq(signupFees.signupId, eventSignups.id))
    .where(
      and(
        eq(signupFees.status, 'collected'),
        eq(eventSignups.eventId, eventId),
        notInArray(eventSignups.status, ['withdrawn', 'rejected']),
      ),
    );

  let closed = 0;
  for (const row of rows) {
    const result = await applyFeeConfirmation(row.id, 0, { auto: true });
    if (result.outcome === 'confirmed') closed++;
  }
  return closed;
}

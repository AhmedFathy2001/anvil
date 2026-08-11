import { db } from '@/db';
import { clanAuditLog, eventSignups, settings, signupFees } from '@/db/schema';
import { and, eq, notInArray } from 'drizzle-orm';
import { del } from '@/lib/storage';

// How many distinct staff confirmations a paid fee needs before it's settled. Admin-set via
// the `fee_confirmations_required` setting; defaults to 1 (single confirm, today's behaviour).
// Clamped to a sane 1–5.
export async function getRequiredConfirmations(): Promise<number> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, 'fee_confirmations_required'),
  });
  const n = parseInt(row?.value || '1', 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 5);
}

export interface FeeConfirmation {
  userId: number;
  at: string;
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

export type ConfirmOutcome =
  /** Vote recorded and the fee settled — proof deleted, status 'confirmed'. */
  | 'confirmed'
  /** Vote recorded, still short of the required count. Fee stays 'collected'. */
  | 'recorded'
  /** Nothing to do: already settled, or this admin already voted. */
  | 'noop'
  /** Refused: the collector can't sign off on their own collection. */
  | 'own-collection'
  /** Refused: nobody has marked this fee paid yet. */
  | 'not-collected';

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
  const auto = opts.auto === true;
  const required = await getRequiredConfirmations();
  const fee = await db.query.signupFees.findFirst({ where: eq(signupFees.id, feeId) });
  if (!fee) return { outcome: 'noop', confirmations: 0, required };
  if (fee.status === 'confirmed') return { outcome: 'noop', confirmations: 0, required };
  if (!fee.collectedByUserId) return { outcome: 'not-collected', confirmations: 0, required };
  // Separation of duties — the person who collected can't also sign off on it.
  if (!auto && fee.collectedByUserId === actorUserId) {
    return { outcome: 'own-collection', confirmations: 0, required };
  }

  const confirmations = parseConfirmations(fee.confirmations);
  if (!auto && confirmations.some((c) => c.userId === actorUserId)) {
    return { outcome: 'noop', confirmations: confirmations.length, required };
  }

  const now = new Date().toISOString();
  // The auto path settles outright rather than casting a vote it can't attribute to anyone.
  const nextConfirmations = auto
    ? confirmations
    : [...confirmations, { userId: actorUserId, at: now }];
  const met = auto || nextConfirmations.length >= required;

  if (fee.proofBlobUrl && met) {
    del(fee.proofBlobUrl).catch(() => {});
  }

  await db
    .update(signupFees)
    .set({
      confirmations: JSON.stringify(nextConfirmations),
      status: met ? 'confirmed' : fee.status,
      confirmedByUserId: met && actorUserId > 0 ? actorUserId : null,
      confirmedAt: met ? now : null,
      proofBlobUrl: met ? null : fee.proofBlobUrl,
    })
    .where(eq(signupFees.id, feeId));

  if (met) {
    const signup = await db.query.eventSignups.findFirst({ where: eq(eventSignups.id, fee.signupId) });
    db.insert(clanAuditLog)
      .values({
        clanMemberId: signup?.clanMemberId ?? null,
        eventType: 'fee_confirmed',
        newValue: JSON.stringify({
          feeId,
          amount: fee.amount,
          collectedByUserId: fee.collectedByUserId,
          ...(auto ? { auto: true } : {}),
        }),
        actorUserId: actorUserId > 0 ? actorUserId : null,
      })
      .catch(() => {});
  }

  return {
    outcome: met ? 'confirmed' : 'recorded',
    confirmations: nextConfirmations.length,
    required,
  };
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

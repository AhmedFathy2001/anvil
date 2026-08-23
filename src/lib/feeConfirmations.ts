import { db } from '@/db';
import { getSetting } from '@/lib/settings';
import { clanAuditLog, eventSignups, events, signupFees } from '@/db/schema';
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
export async function getRequiredConfirmations(clanId: number): Promise<number> {
  return clampRequiredConfirmations(await getSetting(clanId, 'fee_confirmations_required'));
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
/**
 * The clan a fee belongs to, two hops up: fee -> sign-up -> event.
 *
 * Derived rather than passed in, so a caller cannot hand this a clan that disagrees with the event
 * the money was actually collected for.
 */
async function clanIdForSignup(signupId: number): Promise<number | null> {
  const row = await db
    .select({ clanId: events.clanId })
    .from(eventSignups)
    .innerJoin(events, eq(eventSignups.eventId, events.id))
    .where(eq(eventSignups.id, signupId))
    .limit(1);
  return row[0]?.clanId ?? null;
}

export async function applyFeeConfirmation(
  feeId: number,
  actorUserId: number,
  opts: { auto?: boolean } = {},
): Promise<ConfirmResult> {
  const fee = await db.query.signupFees.findFirst({ where: eq(signupFees.id, feeId) });
  const clanId = fee ? await clanIdForSignup(fee.signupId) : null;
  const required = clanId == null ? 1 : await getRequiredConfirmations(clanId);
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
export async function shouldAutoConfirmOnEventEnd(clanId: number): Promise<boolean> {
  const value = await getSetting(clanId, 'fee_autoconfirm_on_event_end');
  return value === 'true' || value === '1';
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

/**
 * Which event a fee belongs to, for the gates that only get a fee id.
 *
 * The fee routes are keyed by fee, not by event, because collecting money was a clan-wide job. A
 * per-board treasurer changes that: their reach is one event, so the route has to find out which.
 */
export async function eventIdForFee(feeId: number): Promise<number | null> {
  const row = await db
    .select({ eventId: eventSignups.eventId })
    .from(signupFees)
    .innerJoin(eventSignups, eq(signupFees.signupId, eventSignups.id))
    .where(eq(signupFees.id, feeId))
    .limit(1);
  return row[0]?.eventId ?? null;
}

/** What a close-out did, split by what each fee was before it — the honest report for the UI. */
export interface FeeCloseOut {
  /** Money a mod had already taken; settled rather than written off. */
  settled: number;
  /** Never paid (or claimed but never collected, or disputed): written off. */
  writtenOff: number;
  /** Already confirmed before we got here. */
  alreadyDone: number;
}

/**
 * End the fee ledger for a finished event.
 *
 * A board that's over still shows every fee nobody ever paid, and there is no clean way to make
 * that list go away: "Mark paid" is a lie, "Reset" puts it back to unpaid, and the settle-all pass
 * only touches money a mod already collected. So the ledger nags forever over people who simply
 * never turned up.
 *
 * This closes it, and it does NOT pretend everything was paid. A fee somebody collected but nobody
 * countersigned is SETTLED (the money exists; the second signature is never coming). Everything
 * else — unpaid, claimed-but-uncollected, disputed — is written off to 'closed', which is its own
 * terminal status meaning "this was never paid and nobody is chasing it any more". The note keeps
 * what it was, so the write-off is legible a year later.
 *
 * Withdrawn and rejected sign-ups are swept too: their fees are the deadest money on the board and
 * leaving them out would mean the ledger still isn't empty afterwards.
 *
 * Caller enforces who may do this and that the event is actually over.
 */
export async function closeOutEventFees(eventId: number, actorUserId: number): Promise<FeeCloseOut> {
  const rows = await db
    .select({ id: signupFees.id, status: signupFees.status, notes: signupFees.notes })
    .from(signupFees)
    .innerJoin(eventSignups, eq(signupFees.signupId, eventSignups.id))
    .where(eq(eventSignups.eventId, eventId));

  const out: FeeCloseOut = { settled: 0, writtenOff: 0, alreadyDone: 0 };
  const now = new Date().toISOString();
  for (const row of rows) {
    if (row.status === 'confirmed' || row.status === 'closed') {
      out.alreadyDone++;
      continue;
    }
    if (row.status === 'collected') {
      // Auto mode: the collector may well be the admin closing the board out, and refusing to
      // settle their own collections here would leave exactly the fees this action exists to clear.
      const result = await applyFeeConfirmation(row.id, actorUserId, { auto: true });
      if (result.outcome === 'confirmed') out.settled++;
      else out.alreadyDone++;
      continue;
    }
    await db
      .update(signupFees)
      .set({
        status: 'closed',
        notes: appendNote(row.notes, `Closed at event end (was ${row.status}) — ${now}`),
      })
      .where(eq(signupFees.id, row.id));
    out.writtenOff++;
  }
  return out;
}

/** Keep whatever the fee already said; the close-out reason is appended, never overwritten. */
function appendNote(existing: string | null, line: string): string {
  const prev = (existing ?? '').trim();
  return prev ? `${prev}\n${line}` : line;
}

/**
 * Mark a fee paid, whoever is doing it.
 *
 * Extracted so the admin route and the team-staff route can't drift: the dispute rule ("the player
 * says they paid someone else"), the settle-on-collect rule, and the audit line are one behaviour
 * with two callers, not two implementations that agree today.
 *
 * The caller owns AUTHORISATION — this only knows how a fee moves, not who may move it.
 */
export async function markFeeCollected(
  fee: typeof signupFees.$inferSelect,
  actorUserId: number,
  opts: { proofUrl?: string | null; notes?: string | null } = {},
): Promise<{ fee: typeof signupFees.$inferSelect; settled: boolean }> {
  const proofUrl = opts.proofUrl ?? null;

  // Replacing a proof leaves the old blob orphaned otherwise. Best-effort: a failed delete must not
  // block the money being recorded.
  if (fee.proofBlobUrl && proofUrl && fee.proofBlobUrl !== proofUrl) {
    del(fee.proofBlobUrl).catch(() => {});
  }

  // A dispute is the player naming a different collector — that needs a human either way.
  const disputed = fee.reportedCollectorUserId !== null && fee.reportedCollectorUserId !== actorUserId;
  const feeClanId = await clanIdForSignup(fee.signupId);
  const required = feeClanId == null ? 1 : await getRequiredConfirmations(feeClanId);
  const settleNow = !disputed && settlesOnCollect(required);
  const status = disputed ? 'disputed' : settleNow ? 'confirmed' : 'collected';

  const now = new Date().toISOString();
  const [updated] = await db
    .update(signupFees)
    .set({
      collectedByUserId: actorUserId,
      collectedAt: now,
      proofBlobUrl: proofUrl ?? fee.proofBlobUrl,
      status,
      // Re-marking paid resets any tally — the fee changed hands again.
      confirmations: null,
      confirmedByUserId: settleNow ? actorUserId : null,
      confirmedAt: settleNow ? now : null,
      notes: opts.notes ?? fee.notes,
    })
    .where(eq(signupFees.id, fee.id))
    .returning();

  if (settleNow) {
    await recordFeeSettled(fee.id, fee.signupId, fee.amount, actorUserId, actorUserId, {
      noSignature: true,
    });
  }

  return { fee: updated, settled: settleNow };
}

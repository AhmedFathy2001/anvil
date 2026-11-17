// Competitions people sign up for themselves, with an optional entry fee.
//
// A weekly was either "all members" (the roster is swept in) or "selected people" (staff add them).
// This is the third way in: the competition is open and members ENTER from its page. A sign-up is
// simply a participant row the member made for their own character, so the standings, baselines,
// teams and opt-outs need to know nothing new.
//
// The fee is tracked the way an event's is (lib/feeRules, lib/clanEventSignups): paid in game to a
// collector, marked collected, and settled under the clan's own confirmation policy. Money is
// recorded, never moved by the site. Somebody who has not paid is still on the board, marked as
// owing, so staff decide what an unpaid entry means; nothing is hidden or removed on a timer.

import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { seatsFor } from '@/lib/clanEventSignups';
import { getWeeklyPool, recordAdjustment, setWeeklyPool } from '@/lib/coffer';
import { parseWeeklyPrizes, totalPrizeGp } from '@/lib/weeklyPrizes';
import { getRequiredConfirmations } from '@/lib/feeConfirmations';
import { decideConfirmation, settlesOnCollect } from '@/lib/feeRules';
import { normalizeRsn } from '@/lib/auth';
import { captureWeeklyStartingStatsSoon } from '@/lib/startingStats';

type Competition = typeof weeklyCompetitions.$inferSelect;
type Participant = typeof weeklyParticipants.$inferSelect;
export type SignupResult<T> = { ok: true; value: T } | { ok: false; error: string; status: number };
const fail = (error: string, status = 400) => ({ ok: false as const, error, status });

export const MAX_ENTRY_FEE = 2_000_000_000;
/** A fee as stored: a whole number of gp above zero, else none. */
export function cleanEntryFee(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.min(MAX_ENTRY_FEE, Math.floor(n)) : null;
}

/** Whether this competition takes sign-ups right now: switched on, and not finished. */
export const signupOpen = (comp: Pick<Competition, 'selfSignup' | 'status'>): boolean => comp.selfSignup && comp.status !== 'completed';

export interface MyEntry {
  /** The viewer's characters with a seat in this clan, primary first. */
  seats: { id: number; rsn: string }[];
  /** Their rows in this competition. */
  entries: { participantId: number; rsn: string; feeAmount: number | null; feeStatus: string | null }[];
}

export async function myEntry(comp: Competition, playerId: number | null): Promise<MyEntry> {
  const seats = await seatsFor(comp.clanId, playerId);
  if (!seats.length) return { seats, entries: [] };
  const rows = await db
    .select({ participantId: weeklyParticipants.id, rsn: weeklyParticipants.rsn, feeAmount: weeklyParticipants.feeAmount, feeStatus: weeklyParticipants.feeStatus })
    .from(weeklyParticipants)
    .where(and(eq(weeklyParticipants.competitionId, comp.id), inArray(weeklyParticipants.clanMemberId, seats.map((s) => s.id))));
  return { seats, entries: rows };
}

/** Enter one of your own characters. Entering twice is the same as once. */
export async function enterCompetition(
  comp: Competition,
  who: { userId: number; playerId: number | null },
  input: { clanMemberId?: unknown } = {},
): Promise<SignupResult<Participant>> {
  if (!comp.selfSignup) return fail('This competition has no sign-up. Its staff enter the people in it.', 409);
  if (comp.status === 'completed') return fail('This competition has ended.', 409);
  const seats = await seatsFor(comp.clanId, who.playerId);
  if (!seats.length) return fail('Link a character to this clan first: play on it with the Anvil plugin, then come back.');
  const seat = seats.find((s) => s.id === Number(input.clanMemberId)) ?? seats[0];

  const [existing] = await db
    .select()
    .from(weeklyParticipants)
    .where(and(eq(weeklyParticipants.competitionId, comp.id), eq(weeklyParticipants.clanMemberId, seat.id)));
  if (existing) {
    // Opted out earlier: entering again puts them back, fee state untouched.
    if (!existing.optedOut) return { ok: true, value: existing };
    const [back] = await db.update(weeklyParticipants).set({ optedOut: false }).where(eq(weeklyParticipants.id, existing.id)).returning();
    return { ok: true, value: back };
  }
  const fee = comp.entryFee && comp.entryFee > 0 ? { feeAmount: comp.entryFee, feeStatus: 'pending' } : {};
  const [row] = await db
    .insert(weeklyParticipants)
    .values({ competitionId: comp.id, clanMemberId: seat.id, rsn: seat.rsn, rsnNormalized: normalizeRsn(seat.rsn), enteredByUserId: who.userId, ...fee })
    .onConflictDoNothing()
    .returning();
  if (!row) return fail('That character is already entered.', 409);
  // Joined while it runs: take their starting stats now, not on the next sweep.
  captureWeeklyStartingStatsSoon(comp.id, [row.id]);
  return { ok: true, value: row };
}

/**
 * Take your own sign-up back. Only before it starts, and only while no fee has been handed over:
 * after that the money has to be accounted for, so it is staff who take someone out. Once it is
 * running, "Opt out" is the way off the board.
 */
export async function leaveCompetition(comp: Competition, who: { playerId: number | null }, now = Date.now()): Promise<SignupResult<number>> {
  if (!comp.selfSignup) return fail('This competition has no sign-up.', 409);
  const started = comp.status !== 'upcoming' || Date.parse(comp.startDate) <= now;
  if (started) return fail('It has started. Use Opt out to come off the board.', 409);
  const mine = await myEntry(comp, who.playerId);
  if (!mine.entries.length) return { ok: true, value: 0 };
  if (mine.entries.some((e) => e.feeStatus === 'collected' || e.feeStatus === 'confirmed')) {
    return fail('Your entry fee has already been taken. Ask your clan’s staff to take you out and sort the fee.', 409);
  }
  const gone = await db.delete(weeklyParticipants).where(inArray(weeklyParticipants.id, mine.entries.map((e) => e.participantId))).returning({ id: weeklyParticipants.id });
  return { ok: true, value: gone.length };
}

// ── The fee ────────────────────────────────────────────────────────────────

export type WeeklyFeeAction = 'collect' | 'confirm' | 'reset' | 'waive';

/**
 * Keep the coffer in step with one entrant's fee, on a competition that adds its fees to the prizes:
 * a SETTLED fee is in the coffer, anything else is not. The row's own flag is claimed first, so two
 * moves at once can never credit (or take back) the same fee twice. The prize settle pays the pot
 * out of the coffer (lib/weeklyPrizeSettle), which is why the money has to be there.
 */
async function syncFeeCoffer(comp: Competition, row: Participant, actorUserId: number): Promise<void> {
  const shouldBeIn = comp.feesToPrizes && row.feeStatus === 'confirmed' && (row.feeAmount ?? 0) > 0;
  if (shouldBeIn === row.feeInCoffer) return;
  const claimed = await db
    .update(weeklyParticipants)
    .set({ feeInCoffer: shouldBeIn })
    .where(and(eq(weeklyParticipants.id, row.id), eq(weeklyParticipants.feeInCoffer, !shouldBeIn)))
    .returning({ id: weeklyParticipants.id });
  if (!claimed.length) return;
  const amount = row.feeAmount ?? 0;
  await recordAdjustment({
    clanId: comp.clanId,
    amount: shouldBeIn ? amount : -amount,
    userId: actorUserId > 0 ? actorUserId : null,
    note: shouldBeIn ? `Entry fee: ${row.rsn}, ${comp.title}` : `Entry fee taken back out: ${row.rsn}, ${comp.title}`,
    // Taking back a fee that was credited is a correction of the books, not a spend.
    force: true,
  });
  await syncPotHold(comp, actorUserId);
}

/**
 * Keep the competition's hold on the coffer equal to what it will pay: the ladder plus the fee pot.
 * The hold follows what was asked for the ladder: held stays held, "record it without holding" stays
 * unheld. A competition with no ladder never asked, and its pot is that competition's own entry
 * money, so it is held. Never touches a pool that has been paid.
 */
export async function syncPotHold(comp: Competition, actorUserId: number | null): Promise<void> {
  if (!comp.feesToPrizes) return;
  const existing = await getWeeklyPool(comp.id);
  if (existing?.status === 'paid') return;
  const amount = totalPrizeGp(parseWeeklyPrizes(comp.prizes)) + (await weeklyFeePotGp(comp.id));
  const hold = existing ? existing.status === 'reserved' : true;
  const args = { clanId: comp.clanId, competitionId: comp.id, amount, userId: actorUserId && actorUserId > 0 ? actorUserId : null };
  const held = await setWeeklyPool({ ...args, hold });
  // Not enough free gp to hold it (the coffer was spent elsewhere): record it unheld rather than lose track of it.
  if (!held.ok && hold) await setWeeklyPool({ ...args, hold: false });
}

/** The entry fees of this competition that are in the coffer: the pot added to its prizes. */
export async function weeklyFeePotGp(competitionId: number): Promise<number> {
  const [r] = await db
    .select({ gp: sql<number>`coalesce(sum(${weeklyParticipants.feeAmount}), 0)::bigint` })
    .from(weeklyParticipants)
    .where(and(eq(weeklyParticipants.competitionId, competitionId), eq(weeklyParticipants.feeInCoffer, true)));
  return Number(r?.gp ?? 0);
}

function audit(comp: Competition, actorUserId: number, row: Participant, eventType: string, extra: Record<string, unknown> = {}) {
  db.insert(clanAuditLog)
    .values({
      clanId: comp.clanId,
      clanMemberId: row.clanMemberId,
      eventType,
      newValue: JSON.stringify({ competitionId: comp.id, participantId: row.id, rsn: row.rsn, amount: row.feeAmount, ...extra }),
      actorUserId: actorUserId > 0 ? actorUserId : null,
      notes: `Competition "${comp.title}"`,
    })
    .catch(() => {});
}

/**
 * One move on one entrant's fee. The caller has decided who may make it (collectors collect, admins
 * confirm, reset and waive). `waive` takes the fee off someone staff let in free.
 */
export async function moveWeeklyFee(comp: Competition, participantId: number, action: WeeklyFeeAction, actorUserId: number): Promise<SignupResult<Participant>> {
  const [row] = await db.select().from(weeklyParticipants).where(and(eq(weeklyParticipants.id, participantId), eq(weeklyParticipants.competitionId, comp.id)));
  if (!row) return fail('That entrant is not in this competition.', 404);
  const now = new Date().toISOString();
  const save = async (set: Partial<Participant>) => {
    const [updated] = await db.update(weeklyParticipants).set(set).where(eq(weeklyParticipants.id, row.id)).returning();
    // The amount being taken back out is the one that went in, so the row as it was carries it.
    await syncFeeCoffer(comp, { ...updated, feeAmount: updated.feeAmount ?? row.feeAmount }, actorUserId);
    return (await db.select().from(weeklyParticipants).where(eq(weeklyParticipants.id, row.id)))[0];
  };
  const cleared = { feeCollectedByUserId: null, feeCollectedAt: null, feeConfirmations: null, feeConfirmedByUserId: null, feeConfirmedAt: null };

  if (action === 'waive') {
    if (row.feeStatus === 'collected' || row.feeStatus === 'confirmed') return fail('This fee was already taken. Undo it first.', 409);
    const updated = await save({ feeAmount: null, feeStatus: null, ...cleared });
    audit(comp, actorUserId, row, 'weekly_fee_waived');
    return { ok: true, value: updated };
  }
  if (row.feeStatus == null) {
    // Entered by staff, or before the fee was set: `collect` puts the competition's fee on them.
    if (action !== 'collect' || !comp.entryFee) return fail('There is no fee on this entrant.', 404);
    row.feeAmount = comp.entryFee;
    row.feeStatus = 'pending';
  }
  const required = await getRequiredConfirmations(comp.clanId);

  if (action === 'collect') {
    if (row.feeStatus === 'confirmed') return fail('Already settled. Reset it first.', 409);
    const settle = settlesOnCollect(required);
    const updated = await save({
      feeAmount: row.feeAmount,
      feeStatus: settle ? 'confirmed' : 'collected',
      feeCollectedByUserId: actorUserId,
      feeCollectedAt: now,
      feeConfirmations: null,
      feeConfirmedByUserId: settle ? actorUserId : null,
      feeConfirmedAt: settle ? now : null,
    });
    audit(comp, actorUserId, row, settle ? 'weekly_fee_confirmed' : 'weekly_fee_collected', settle ? { noSignature: true } : {});
    return { ok: true, value: updated };
  }

  if (action === 'confirm') {
    const decision = decideConfirmation({ status: row.feeStatus ?? 'pending', collectedByUserId: row.feeCollectedByUserId, confirmations: row.feeConfirmations ?? [] }, actorUserId, required, now);
    if (decision.outcome === 'own-collection') return fail('You collected this fee, so another admin must confirm it.', 403);
    if (decision.outcome === 'not-collected') return fail('No one has marked this fee paid yet.');
    if (decision.outcome === 'noop') return { ok: true, value: row };
    const updated = await save({
      feeConfirmations: decision.confirmations,
      feeStatus: decision.settled ? 'confirmed' : row.feeStatus,
      feeConfirmedByUserId: decision.settled ? actorUserId : null,
      feeConfirmedAt: decision.settled ? now : null,
    });
    if (decision.settled) audit(comp, actorUserId, row, 'weekly_fee_confirmed');
    return { ok: true, value: updated };
  }

  // reset
  const updated = await save({ feeStatus: 'pending', ...cleared });
  audit(comp, actorUserId, row, 'weekly_fee_reset');
  return { ok: true, value: updated };
}

export interface WeeklyFeeRow {
  participantId: number;
  rsn: string;
  feeAmount: number | null;
  feeStatus: string | null;
  collectedAt: string | null;
  confirmations: number;
  selfEntered: boolean;
}

/** Everyone in the competition with their fee, owing first, and the totals. */
export async function weeklyFeeSheet(comp: Competition): Promise<{ rows: WeeklyFeeRow[]; owedGp: number; inHandGp: number; settledGp: number; required: number }> {
  const all = await db.select().from(weeklyParticipants).where(eq(weeklyParticipants.competitionId, comp.id));
  const order: Record<string, number> = { pending: 0, collected: 1, confirmed: 2 };
  const rows = all
    .map((p) => ({ participantId: p.id, rsn: p.rsn, feeAmount: p.feeAmount, feeStatus: p.feeStatus, collectedAt: p.feeCollectedAt, confirmations: p.feeConfirmations?.length ?? 0, selfEntered: p.enteredByUserId != null }))
    .sort((a, b) => (order[a.feeStatus ?? ''] ?? 3) - (order[b.feeStatus ?? ''] ?? 3) || a.rsn.localeCompare(b.rsn));
  const sum = (status: string) => rows.filter((r) => r.feeStatus === status).reduce((n, r) => n + (r.feeAmount ?? 0), 0);
  return { rows, owedGp: sum('pending'), inHandGp: sum('collected'), settledGp: sum('confirmed'), required: await getRequiredConfirmations(comp.clanId) };
}

/** Fees taken so far (collected or settled): what the competition has actually brought in. */
export async function weeklyFeesTakenGp(competitionId: number): Promise<number> {
  const [r] = await db
    .select({ gp: sql<number>`coalesce(sum(${weeklyParticipants.feeAmount}), 0)::bigint` })
    .from(weeklyParticipants)
    .where(and(eq(weeklyParticipants.competitionId, competitionId), isNotNull(weeklyParticipants.feeStatus), inArray(weeklyParticipants.feeStatus, ['collected', 'confirmed'])));
  return Number(r?.gp ?? 0);
}

import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanEventPayouts } from '@/db/schema';
import { MAX_GP, parseModules, potGp, validKey } from '@/lib/clanEventModules';
import { collectedFeesGp, liveClanEvent } from '@/lib/clanEventSignups';
import { del } from '@/lib/storage';

// Payouts on a clan event: the pot is the host's added gp plus the fees collected under the key,
// and the host names who gets what — there's no board to rank anyone. Then each row is paid, with
// a screenshot if they like, the same as a board's payout sheet.

export type Payout = typeof clanEventPayouts.$inferSelect;
type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number };
const fail = (error: string, status = 400) => ({ ok: false as const, error, status });

export async function payoutSheet(clanId: number, eventId: number, key: string): Promise<{ pot: number; collected: number; rows: Payout[] } | null> {
  const e = await liveClanEvent(clanId, eventId);
  if (!e) return null;
  const m = parseModules(e.modules);
  const collected = await collectedFeesGp(clanId, eventId, key);
  const rows = await db
    .select()
    .from(clanEventPayouts)
    .where(and(eq(clanEventPayouts.clanId, clanId), eq(clanEventPayouts.clanEventId, eventId), eq(clanEventPayouts.occurrence, key)))
    .orderBy(asc(clanEventPayouts.id));
  return { pot: potGp(m, collected), collected, rows };
}

/** Name a winner. More than the pot is allowed — a host can top it up — and the sheet shows it. */
export async function addPayout(clanId: number, eventId: number, key: string, input: { rsn?: unknown; amount?: unknown; note?: unknown }): Promise<Result<Payout>> {
  const e = await liveClanEvent(clanId, eventId);
  if (!e) return fail('Not found', 404);
  const m = parseModules(e.modules);
  if (!m.payouts.on) return fail('Turn payouts on for this event first.', 409);
  if (!validKey(m, e, key)) return fail('That isn’t one of this event’s dates.');
  const rsn = typeof input.rsn === 'string' ? input.rsn.trim().slice(0, 12) : '';
  if (!rsn) return fail('Who gets it?');
  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_GP) return fail('Give an amount in gp.');
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 60) || null : null;
  const [row] = await db.insert(clanEventPayouts).values({ clanId, clanEventId: eventId, occurrence: key, rsn, amount, note }).returning();
  return { ok: true, value: row };
}

/** Pay, unpay, or remove one row. A paid row's proof goes with it when it's removed or unpaid. */
export async function movePayout(clanId: number, eventId: number, payoutId: number, action: 'pay' | 'unpay' | 'delete', actorUserId: number, proofUrl: string | null = null): Promise<Result<Payout | null>> {
  const scope = and(eq(clanEventPayouts.id, payoutId), eq(clanEventPayouts.clanId, clanId), eq(clanEventPayouts.clanEventId, eventId));
  // clan-scope: this clan -- `scope` above carries clanId.
  const row = await db.query.clanEventPayouts.findFirst({ where: scope });
  if (!row) return fail('Not found', 404);
  if (action === 'delete') {
    if (row.proofUrl) del(row.proofUrl).catch(() => {});
    await db.delete(clanEventPayouts).where(scope);
    return { ok: true, value: null };
  }
  if (row.proofUrl && (action === 'unpay' || (proofUrl && proofUrl !== row.proofUrl))) del(row.proofUrl).catch(() => {});
  const [updated] = await db
    .update(clanEventPayouts)
    .set(
      action === 'pay'
        ? { status: 'paid', paidByUserId: actorUserId, paidAt: new Date().toISOString(), proofUrl: proofUrl ?? row.proofUrl }
        : { status: 'pending', paidByUserId: null, paidAt: null, proofUrl: null },
    )
    .where(scope)
    .returning();
  return { ok: true, value: updated };
}

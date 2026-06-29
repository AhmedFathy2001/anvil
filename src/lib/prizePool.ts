import { db } from '@/db';
import { eventSignups } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

// "Entries" that count toward the pool are APPROVED signups. We deliberately do NOT
// gate on whether the fee was actually collected — an approved entry is treated as
// owing into the pool regardless of payment status.
export async function countApprovedSignups(eventId: number): Promise<number> {
  const rows = await db
    .select({ id: eventSignups.id })
    .from(eventSignups)
    .where(and(eq(eventSignups.eventId, eventId), eq(eventSignups.status, 'approved')));
  return rows.length;
}

// Total displayed prize pool = host-added bonus + entry fee × approved entries.
// Nulls (free event / no bonus) read as 0.
export function computePrizePool(opts: {
  addedPrizePool: number | null;
  signupFee: number | null;
  approvedCount: number;
}): number {
  const added = opts.addedPrizePool ?? 0;
  const fees = (opts.signupFee ?? 0) * opts.approvedCount;
  return added + fees;
}

import { db } from '@/db';
import { eventSignups } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

// "Entries" that count toward the pool are APPROVED signups. We deliberately do NOT
// gate on whether the fee was actually collected — an approved entry is treated as
// owing into the pool regardless of payment status. Sign-ups flagged excludeFromPrizePool
// (non-paying: mid-event sub-ins, comped/staff entries) are left out so roster swaps don't
// inflate the pool past the real money in.
export async function countApprovedSignups(eventId: number): Promise<number> {
  const rows = await db
    .select({ id: eventSignups.id })
    .from(eventSignups)
    .where(
      and(
        eq(eventSignups.eventId, eventId),
        eq(eventSignups.status, 'approved'),
        eq(eventSignups.excludeFromPrizePool, false),
      ),
    );
  return rows.length;
}

// The pot arithmetic lives in lib/prizePoolMath, which is free of `@/db`; re-exported so every
// caller keeps its single import of this module.
export { computePrizePool } from '@/lib/prizePoolMath';

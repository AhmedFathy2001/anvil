import { db } from '@/db';
import { eventSignups, signupFees } from '@/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';

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

/**
 * The entry fees actually IN — what the prize pot counts.
 *
 * The pot used to count every approved sign-up as if they had paid, so it advertised money the clan
 * didn't have and could promise prizes it then couldn't cover. Now only fees a staff member has
 * marked collected (or that are confirmed) count; the rest show as "still owed" on the Money tab.
 * Summed from each fee row's own amount, so a per-account fee counts what was really charged.
 */
export async function countPaidEntries(eventId: number): Promise<{ count: number; gp: number }> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int`, gp: sql<number>`coalesce(sum(${signupFees.amount}), 0)::int` })
    .from(signupFees)
    .innerJoin(eventSignups, eq(eventSignups.id, signupFees.signupId))
    .where(
      and(
        eq(eventSignups.eventId, eventId),
        eq(eventSignups.status, 'approved'),
        eq(eventSignups.excludeFromPrizePool, false),
        inArray(signupFees.status, ['collected', 'confirmed']),
      ),
    );
  return { count: row?.count ?? 0, gp: row?.gp ?? 0 };
}

// The pot arithmetic lives in lib/prizePoolMath, which is free of `@/db`; re-exported so every
// caller keeps its single import of this module.
export { computePrizePool } from '@/lib/prizePoolMath';

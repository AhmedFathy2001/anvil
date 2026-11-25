import { and, eq, notInArray } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, eventSignups } from '@/db/schema';

/**
 * Who's signed up for a board, by character name, in sign-up order — for a host who shows the list
 * (rules.signupFields.publicList) so people can see their friends are in. Names only: answers, fees
 * and statuses stay with the host. Pending and approved count; a withdrawn or turned-down one doesn't.
 */
export async function signedUpNames(eventId: number): Promise<string[]> {
  // clan-scope: this clan -- one board's sign-ups; their seats are that board's own clans'.
  const rows = await db
    .select({ rsn: clanRoster.rsn })
    .from(eventSignups)
    .innerJoin(clanRoster, eq(clanRoster.id, eventSignups.clanMemberId))
    .where(and(eq(eventSignups.eventId, eventId), notInArray(eventSignups.status, ['withdrawn', 'rejected'])))
    .orderBy(eventSignups.signedUpAt);
  return [...new Set(rows.map((r) => r.rsn))];
}

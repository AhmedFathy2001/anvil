// Stores the in-game clan join dates a roster sync carries (lib/clanJoinDate) on the seats they belong
// to. Only seats whose date is new or really moved are written, in one statement per 500, so a
// steady roster costs one read and no writes.

import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships } from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { joinDateChanged, joinDateFromDays } from '@/lib/clanJoinDate';

export async function recordJoinDates(
  clanId: number,
  members: { rsn?: string | null; joinedDays?: number | null }[],
  now: string,
): Promise<number> {
  const at = new Date(now);
  const reported = new Map<string, string>();
  for (const m of members) {
    const key = normalizeRsn(m.rsn ?? '');
    const date = joinDateFromDays(m.joinedDays, at);
    if (key && date) reported.set(key, date);
  }
  if (reported.size === 0) return 0;
  const seats = await db
    .select({ id: clanMemberships.id, stored: clanMemberships.ingameJoinedOn, rsnNormalized: accounts.rsnNormalized })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(and(eq(clanMemberships.clanId, clanId), isNull(clanMemberships.leftAt)));
  const writes = seats
    .map((s) => ({ id: s.id, date: reported.get(s.rsnNormalized) ?? null, stored: s.stored }))
    .filter((s): s is { id: number; date: string; stored: string | null } => !!s.date && joinDateChanged(s.stored, s.date));
  for (let i = 0; i < writes.length; i += 500) {
    const chunk = writes.slice(i, i + 500);
    await db.execute(sql`
      update clan_memberships as cm set ingame_joined_on = v.d
      from (values ${sql.join(chunk.map((w) => sql`(${w.id}::int, ${w.date}::text)`), sql`, `)}) as v(id, d)
      where cm.id = v.id`);
  }
  return writes.length;
}

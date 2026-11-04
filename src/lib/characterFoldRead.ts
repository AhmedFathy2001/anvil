import { eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, accountStatSnapshots } from '@/db/schema';
import { levelAndXp } from '@/lib/characterFold';

/** Total level and XP per account, for the person card's character list. One query. */
export async function foldStats(
  accountIds: number[],
): Promise<Map<number, { totalLevel: number | null; totalXp: number | null }>> {
  if (accountIds.length === 0) return new Map();
  // clan-scope: global -- the viewer's OWN characters (the page passes only theirs); an account's stats are global.
  const rows = await db
    .select({
      id: accounts.id,
      statsLastSnapshot: accountStatSnapshots.snapshot,
      liveStats: accounts.liveStats,
      statsOverallXp: accounts.statsOverallXp,
    })
    .from(accounts)
    .leftJoin(accountStatSnapshots, eq(accountStatSnapshots.accountId, accounts.id))
    .where(inArray(accounts.id, accountIds));
  return new Map(rows.map((r) => [r.id, levelAndXp(r)]));
}

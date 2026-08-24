import { db } from '@/db';
import { memberProgress, memberProgressItems } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { progressSummary, type ProgressSummary } from '@/lib/memberProgress';
import { parseItems, type ItemCategory, type ProgressItem } from '@/lib/memberProgressItems';

// The database half of lib/memberProgress, kept apart so the registry and its rules stay importable
// from tests and from the client without dragging a connection along.

/** One member's progress, folded into what a profile card draws. `empty` when nothing was pushed. */
/**
 * TAKES AN ACCOUNT ID. The parameter used to be called `clanMemberId`.
 *
 * That was not a naming nit, it was the bug. Every caller obediently passed a SEAT id, the query
 * below asks for `account_id`, and Postgres answered happily with somebody else's rows. On the
 * preview 456 of 456 live seats had an id that differed from their account's, so this was wrong for
 * every member on every profile: Drenvox mdps' page drew A Fish Taco's history, and Denoverse's drew
 * a blank, because the account whose id happened to match their seat had never been tracked.
 *
 * Nothing failed and nothing looked broken. Both ids are small positive integers from adjacent
 * sequences, so the wrong one is always a plausible answer — which is exactly why the name has to be
 * the true one.
 */
export async function getMemberProgress(accountId: number): Promise<ProgressSummary> {
  const rows = await db
    .select({ key: memberProgress.key, value: memberProgress.value, updatedAt: memberProgress.updatedAt })
    .from(memberProgress)
    .where(eq(memberProgress.accountId, accountId));
  return progressSummary(rows);
}

export interface MemberItemSet {
  items: ProgressItem[];
  done: number;
  total: number;
  updatedAt: string | null;
}

/** One member's item list for a category — the quests they've done, and which they haven't. */
/**
 * TAKES AN ACCOUNT ID. The parameter used to be called `clanMemberId`.
 *
 * That was not a naming nit, it was the bug. Every caller obediently passed a SEAT id, the query
 * below asks for `account_id`, and Postgres answered happily with somebody else's rows. On the
 * preview 456 of 456 live seats had an id that differed from their account's, so this was wrong for
 * every member on every profile: Drenvox mdps' page drew A Fish Taco's history, and Denoverse's drew
 * a blank, because the account whose id happened to match their seat had never been tracked.
 *
 * Nothing failed and nothing looked broken. Both ids are small positive integers from adjacent
 * sequences, so the wrong one is always a plausible answer — which is exactly why the name has to be
 * the true one.
 */
export async function getMemberItems(
  accountId: number,
  category: ItemCategory,
): Promise<MemberItemSet | null> {
  const row = await db.query.memberProgressItems.findFirst({
    where: and(
      eq(memberProgressItems.accountId, accountId),
      eq(memberProgressItems.category, category),
    ),
  });
  if (!row) return null;
  const items = parseItems(row.payload);
  if (items.length === 0) return null;
  return { items, done: row.doneCount, total: row.totalCount, updatedAt: row.updatedAt };
}

import { db } from '@/db';
import { memberProgress, memberProgressItems } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { progressSummary, type ProgressSummary } from '@/lib/memberProgress';
import { parseItems, type ItemCategory, type ProgressItem } from '@/lib/memberProgressItems';

// The database half of lib/memberProgress, kept apart so the registry and its rules stay importable
// from tests and from the client without dragging a connection along.

/** One member's progress, folded into what a profile card draws. `empty` when nothing was pushed. */
export async function getMemberProgress(clanMemberId: number): Promise<ProgressSummary> {
  const rows = await db
    .select({ key: memberProgress.key, value: memberProgress.value, updatedAt: memberProgress.updatedAt })
    .from(memberProgress)
    .where(eq(memberProgress.clanMemberId, clanMemberId));
  return progressSummary(rows);
}

export interface MemberItemSet {
  items: ProgressItem[];
  done: number;
  total: number;
  updatedAt: string | null;
}

/** One member's item list for a category — the quests they've done, and which they haven't. */
export async function getMemberItems(
  clanMemberId: number,
  category: ItemCategory,
): Promise<MemberItemSet | null> {
  const row = await db.query.memberProgressItems.findFirst({
    where: and(
      eq(memberProgressItems.clanMemberId, clanMemberId),
      eq(memberProgressItems.category, category),
    ),
  });
  if (!row) return null;
  const items = parseItems(row.payload);
  if (items.length === 0) return null;
  return { items, done: row.doneCount, total: row.totalCount, updatedAt: row.updatedAt };
}

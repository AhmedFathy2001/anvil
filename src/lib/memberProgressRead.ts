import { db } from '@/db';
import { memberProgress } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { progressSummary, type ProgressSummary } from '@/lib/memberProgress';

// The database half of lib/memberProgress, kept apart so the registry and its rules stay importable
// from tests and from the client without dragging a connection along.

/** One member's progress, folded into what a profile card draws. `empty` when nothing was pushed. */
export async function getMemberProgress(clanMemberId: number): Promise<ProgressSummary> {
  const rows = await db
    .select({ key: memberProgress.key, value: memberProgress.value, updatedAt: memberProgress.updatedAt })
    .from(memberProgress)
    .where(eq(memberProgress.accountId, clanMemberId));
  return progressSummary(rows);
}

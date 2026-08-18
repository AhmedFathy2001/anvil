import { db } from '@/db';
import { memberProgress } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { progressView, type ProgressView } from '@/lib/memberProgress';

// The database half of lib/memberProgress, kept apart so the registry and its rules stay importable
// from tests and from the client without dragging a connection along.

/** One member's progress, in registry order. Empty for a member whose plugin never pushed any. */
export async function getMemberProgress(clanMemberId: number): Promise<ProgressView[]> {
  const rows = await db
    .select({ key: memberProgress.key, value: memberProgress.value, updatedAt: memberProgress.updatedAt })
    .from(memberProgress)
    .where(eq(memberProgress.clanMemberId, clanMemberId));
  return progressView(rows);
}

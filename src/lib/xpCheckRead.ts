import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { verificationAttempts } from '@/db/schema';
import { pendingXpCheck, type PendingXpCheck } from '@/lib/xpCheck';

/** The signed-in person's running XP check, if they left one open (nothing is stored beyond the attempt row). */
export async function runningXpCheck(userId: number): Promise<PendingXpCheck | null> {
  const rows = await db
    .select({
      id: verificationAttempts.id,
      rsn: verificationAttempts.rsn,
      expiresAt: verificationAttempts.expiresAt,
      completedAt: verificationAttempts.completedAt,
      minDelta: verificationAttempts.minDelta,
      baselineSnapshot: verificationAttempts.baselineSnapshot,
    })
    .from(verificationAttempts)
    .where(and(eq(verificationAttempts.userId, userId), isNull(verificationAttempts.completedAt)))
    .orderBy(desc(verificationAttempts.id))
    .limit(5);
  return pendingXpCheck(rows, Date.now());
}

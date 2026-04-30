import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, verificationAttempts } from '@/db/schema';
import { and, eq, gt, sql } from 'drizzle-orm';
import { normalizeRsn, verifyUser } from '@/lib/auth';
import { fetchHiscoresSnapshot, snapshotXpMap } from '@/lib/hiscores';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

const WINDOW_MS = 30 * 60 * 1000;
const MIN_DELTA = 1000;

// POST /api/auth/verify-stat-delta/start { rsn }
// Snapshots Hiscores XP for the RSN, stores the baseline, returns the attempt id +
// expiry. The user then plays the game for ≥minDelta XP in any skill within the window
// and calls /check to confirm.
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session || session.userId <= 0) {
    return NextResponse.json({ error: 'Sign in with Discord first' }, { status: 401 });
  }

  const rl = await rateLimit(request, 'stat-delta-start', { limit: 5, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many verification attempts — wait a bit before trying again.' },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: { rsn?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rsn = (body.rsn || '').trim();
  if (!rsn || rsn.length < 1 || rsn.length > 12) {
    return NextResponse.json({ error: 'Provide a valid RSN' }, { status: 400 });
  }

  const rsnNormalized = normalizeRsn(rsn);

  // If this RSN is already owned by another user, refuse before burning a Hiscores call.
  const conflict = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.rsnNormalized, rsnNormalized),
  });
  if (conflict?.userId && conflict.userId !== session.userId) {
    return NextResponse.json(
      { error: 'This account is already linked to a different user. Ask a moderator if you think this is wrong.' },
      { status: 409 },
    );
  }

  // Cancel any other open attempts by this user for the same RSN.
  const nowIso = new Date().toISOString();
  await db
    .update(verificationAttempts)
    .set({ completedAt: nowIso, succeeded: 0, failureReason: 'superseded' })
    .where(
      and(
        eq(verificationAttempts.userId, session.userId),
        eq(verificationAttempts.rsnNormalized, rsnNormalized),
        sql`${verificationAttempts.completedAt} IS NULL`,
        gt(verificationAttempts.expiresAt, nowIso),
      ),
    );

  const snapshot = await fetchHiscoresSnapshot(rsn);
  if (!snapshot) {
    return NextResponse.json(
      { error: 'Could not fetch Hiscores. Make sure your account is ranked (gain a bit of XP first) and try again.' },
      { status: 502 },
    );
  }
  const xpMap = snapshotXpMap(snapshot);
  if (Object.keys(xpMap).length === 0) {
    return NextResponse.json(
      { error: 'Hiscores returned no skill data. Account may be unranked or hidden.' },
      { status: 422 },
    );
  }

  const expiresAt = new Date(Date.now() + WINDOW_MS).toISOString();
  const inserted = await db
    .insert(verificationAttempts)
    .values({
      userId: session.userId,
      rsn,
      rsnNormalized,
      baselineSnapshot: JSON.stringify(xpMap),
      minDelta: MIN_DELTA,
      expiresAt,
    })
    .returning({ id: verificationAttempts.id, expiresAt: verificationAttempts.expiresAt });

  return NextResponse.json({
    attemptId: inserted[0].id,
    expiresAt: inserted[0].expiresAt,
    minDelta: MIN_DELTA,
    windowMinutes: WINDOW_MS / 60_000,
    rsn,
  });
}

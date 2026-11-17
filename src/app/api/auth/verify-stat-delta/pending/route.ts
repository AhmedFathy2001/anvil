import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { runningXpCheck } from '@/lib/xpCheckRead';
import { db } from '@/db';
import { verificationAttempts } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

// GET /api/auth/verify-stat-delta/pending
// The person's open XP check, so the page can pick it up again after they left and came back.
export async function GET() {
  const session = await verifyUser();
  if (!session || session.userId <= 0) return NextResponse.json({ attempt: null });
  return NextResponse.json({ attempt: await runningXpCheck(session.userId) }, { headers: { 'Cache-Control': 'no-store' } });
}

// DELETE /api/auth/verify-stat-delta/pending
// Cancel: ends every open XP check of the caller's own. The page's Cancel used to only forget the
// check locally, so it was still running (and still announced on every page) after a reload.
export async function DELETE(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'Not allowed from another site.' }, { status: 403 });
  const session = await verifyUser();
  if (!session || session.userId <= 0) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  await db
    .update(verificationAttempts)
    .set({ completedAt: new Date().toISOString(), succeeded: 0, failureReason: 'cancelled' })
    .where(and(eq(verificationAttempts.userId, session.userId), isNull(verificationAttempts.completedAt)));
  return NextResponse.json({ ok: true });
}

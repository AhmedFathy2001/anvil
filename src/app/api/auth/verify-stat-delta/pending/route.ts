import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { runningXpCheck } from '@/lib/xpCheckRead';

// GET /api/auth/verify-stat-delta/pending
// The person's open XP check, so the page can pick it up again after they left and came back.
export async function GET() {
  const session = await verifyUser();
  if (!session || session.userId <= 0) return NextResponse.json({ attempt: null });
  return NextResponse.json({ attempt: await runningXpCheck(session.userId) }, { headers: { 'Cache-Control': 'no-store' } });
}

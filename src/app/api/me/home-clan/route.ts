import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { chooseHomeClan } from '@/lib/homeClan';

/**
 * POST /api/me/home-clan { seatId }
 *
 * Two in-game rosters list one of your characters; make the clan behind `seatId` the one it is a
 * member of (lib/homeClan). Your own characters only — chooseHomeClan matches on the session's person.
 */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.playerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const seatId = Number(body?.seatId);
  if (!Number.isInteger(seatId) || seatId <= 0) return NextResponse.json({ error: 'seatId is required' }, { status: 400 });
  if (!(await chooseHomeClan(session.playerId, seatId, session.userId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

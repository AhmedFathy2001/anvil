import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { leaveClan } from '@/lib/guestAdmission';

/**
 * Leaving a clan yourself.
 *
 * Until now only an admin could remove someone, which was survivable when a person belonged to one
 * clan and stopped being survivable the moment they could be demoted into another. Joining clan B
 * turns your seat in clan A into a guest one; without this, being a guest of a clan you have left is
 * a state only that clan's staff can clear, and they have no reason to notice.
 *
 * Scoped to the caller's OWN seats — the session names the person, and leaveClan matches on it. There
 * is no path here to remove anybody else.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session?.playerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const seatId = Number((await params).id);
  if (!Number.isInteger(seatId) || seatId <= 0) {
    return NextResponse.json({ error: 'Invalid seat' }, { status: 400 });
  }

  const done = await leaveClan(seatId, session.playerId);
  if (!done) {
    // Same answer for "not yours" and "not there": a caller probing seat ids learns nothing either
    // way, and for the legitimate case the two are indistinguishable anyway.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

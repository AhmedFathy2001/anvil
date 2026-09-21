import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { requireClanFromRequest } from '@/lib/clanContext';
import { leaveClanAsPerson } from '@/lib/leaveClan';

// POST /api/profile/leave-clan
//
// Take yourself off this clan's roster.
//
// THE CLAN IS THE ADDRESS, not a number in the body: this is the person acting on the clan whose
// site they are standing in, and accepting an id here would be a route for taking somebody out of a
// clan by guessing — the one thing a self-service control must not become. The person is the
// session's, for the same reason.
//
// Refusals are explained rather than silent, because both of them are things the caller can act on:
// no seat here at all, or a seat the in-game roster is holding open (see lib/leaveClan).
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const result = await leaveClanAsPerson({
    clanId: clan.id,
    playerId: session.playerId,
    actorUserId: session.userId,
    clanName: clan.name,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
  }

  return NextResponse.json(result);
}

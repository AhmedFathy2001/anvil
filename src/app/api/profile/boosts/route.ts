import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { moveBoost, myBoosts, placeBoost, removeBoost } from '@/lib/clanBoosts';

export const dynamic = 'force-dynamic';

// A person's clan boosts (lib/clanBoosts). A platform path: the slots are the person's, whichever
// clan's page they're standing on. Every rule (paid tier, member seat ≥14 days, one move a week, the
// slot count under a double submit) is enforced in lib/clanBoosts; the UI only reflects it.
//
//   GET                                       → MyBoosts
//   POST { action: 'place', seatId }          → place a free slot on that seat's clan
//   POST { action: 'move', boostId, seatId }  → move a placed boost to another seat
//   POST { action: 'remove', boostId }        → take one off

export async function GET() {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  return NextResponse.json(await myBoosts(session.userId, session.playerId ?? null));
}

const id = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);

export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { action?: unknown; seatId?: unknown; boostId?: unknown } | null;
  const seatId = id(body?.seatId);
  const boostId = id(body?.boostId);
  let res;
  switch (body?.action) {
    case 'place':
      if (!seatId || !session.playerId) return NextResponse.json({ error: 'Pick a clan to boost.' }, { status: 400 });
      res = await placeBoost(session.userId, session.playerId, seatId);
      break;
    case 'move':
      if (!seatId || !boostId || !session.playerId) return NextResponse.json({ error: 'Pick where to move it.' }, { status: 400 });
      res = await moveBoost(session.userId, session.playerId, boostId, seatId);
      break;
    case 'remove':
      if (!boostId) return NextResponse.json({ error: 'Which boost?' }, { status: 400 });
      res = await removeBoost(session.userId, boostId);
      break;
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, id: res.id });
}

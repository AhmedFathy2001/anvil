import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { blockPlayer, cancelChallenge, respondToChallenge, setChallengePublic } from '@/lib/h2h';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';
import { db } from '@/db';
import { h2hChallenges } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// One challenge: accept, decline (optionally blocking the sender), cancel, or say whether the result
// may be shown publicly. Only the two people in it may act on it (lib/h2h checks the side).

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session?.playerId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const raw = (await params).id;
  const id = /^\d{1,9}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'No such challenge.' }, { status: 404 });
  const rl = await rateLimitByKey('h2h-act', String(session.playerId), { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Slow down a little.' }, { status: 429, headers: rateLimitHeaders(rl) });

  const body = (await request.json().catch(() => null)) as { action?: unknown; public?: unknown; block?: unknown } | null;
  const action = typeof body?.action === 'string' ? body.action : '';
  const pub = body?.public === true;

  let out;
  switch (action) {
    case 'accept':
      out = await respondToChallenge({ id, playerId: session.playerId, accept: true, public: pub });
      break;
    case 'decline': {
      out = await respondToChallenge({ id, playerId: session.playerId, accept: false });
      if (out.ok && body?.block === true) {
        const row = await db.query.h2hChallenges.findFirst({ where: eq(h2hChallenges.id, id), columns: { challengerPlayerId: true, opponentPlayerId: true } });
        if (row && row.opponentPlayerId === session.playerId) await blockPlayer(session.playerId, row.challengerPlayerId);
      }
      break;
    }
    case 'cancel':
      out = await cancelChallenge({ id, playerId: session.playerId });
      break;
    case 'public':
      out = await setChallengePublic({ id, playerId: session.playerId, on: pub });
      break;
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status ?? 400 });
  return NextResponse.json(out);
}

import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { rateLimitByKey } from '@/lib/rate-limit';
import { fileWrongClanReport } from '@/lib/wrongClan';

// POST /api/profile/wrong-clan { accountId, clanId | null, note? } — "Wrong clan? Tell Anvil".
//
// A player saying their character is a member of the wrong clan (lib/wrongClan). Membership comes
// from the in-game roster and a sync never moves it between clans, so this goes to Anvil staff, who
// can move it to the clan named here. Only the character's owner may file; idempotent per character
// while one is open. Nothing about the membership changes here.
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId || !session.playerId) return NextResponse.json({ error: 'Sign in with Discord first' }, { status: 401 });

  const rl = await rateLimitByKey('wrong-clan', String(session.userId), { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many reports — try again in a while.' }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { accountId?: unknown; clanId?: unknown; note?: unknown } | null;
  const accountId = Number(body?.accountId);
  if (!Number.isInteger(accountId) || accountId <= 0) return NextResponse.json({ error: 'Which character?' }, { status: 400 });
  const clanId = body?.clanId == null ? null : Number(body.clanId);
  if (clanId != null && (!Number.isInteger(clanId) || clanId <= 0)) return NextResponse.json({ error: 'Which clan?' }, { status: 400 });
  const note = typeof body?.note === 'string' ? body.note : null;

  const res = await fileWrongClanReport({ accountId, playerId: session.playerId, userId: session.userId, claimedClanId: clanId, note });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, reportId: res.reportId, alreadyOpen: res.alreadyOpen });
}

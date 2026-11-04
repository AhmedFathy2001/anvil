import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { issueKickCode } from '@/lib/gates/kickDb';
import { anvilKickChannel, ensureAnvilKickChat } from '@/lib/gates/kickAnvilChannel';
import { kickConfigured } from '@/lib/kick';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';

// POST /api/profile/connected-accounts/kick-code → { code, expiresAt, channel }
//
// A Kick link code from settings, with no event involved. `channel` is the official Anvil Kick
// channel's slug when its chat is subscribed (lib/gates/kickAnvilChannel) — type the code there — or
// null, and the page says to type it in any Anvil-connected streamer's Kick chat instead (the webhook
// redeems a code in any connected channel). Polling is the gate flow's GET /api/auth/kick/code?code=.
export async function POST() {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!kickConfigured()) return NextResponse.json({ error: 'Kick is not set up on this server.' }, { status: 503 });
  // The same bucket as the gate flow's codes: a code is bound to the login, which is what an abuser cycles.
  const rl = await rateLimitByKey('kick-code', String(session.userId), { limit: 8, windowMs: 60 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many codes — try again later.' }, { status: 429, headers: rateLimitHeaders(rl) });
  const [issued, subscribed] = await Promise.all([issueKickCode(session.userId), ensureAnvilKickChat().catch(() => false)]);
  const channel = subscribed ? await anvilKickChannel().catch(() => null) : null;
  return NextResponse.json({ ...issued, channel: channel?.slug ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}

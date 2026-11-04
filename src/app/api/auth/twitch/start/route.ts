import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { apexDomain, isApexHost, originForHost, sessionCookieDomain } from '@/lib/apexHost';
import { resolveClanFromRequest } from '@/lib/clanContext';
import { isAdminOfCreatorSpace } from '@/lib/entryGatesDb';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { safeReturnPath } from '@/lib/safe-redirect';
import {
  STATE_TTL_MS,
  TWITCH_NONCE_COOKIE,
  authorizeUrl,
  newNonce,
  signState,
  twitchConfig,
  type LinkMode,
} from '@/lib/twitch';


// GET /api/auth/twitch/start?as=viewer|host[&space=<clanId>]&return=/c/slug/events/12
//
// Starts linking a Twitch account (lib/twitch). Two kinds:
//   viewer — "this is my Twitch", for a creator event's follower/sub gate. No scopes.
//   host   — a creator space's admin connecting the space's channel, whose token runs the checks.
//
// Runs on the APEX, like the Discord login: TWITCH_REDIRECT_URI is one URL, so a request that
// arrives on a clan's own host is bounced there first. The state is signed, names the user who
// pressed it, and is bound to a nonce cookie; the callback re-checks all three plus (host) that the
// person is still an admin of that space. The return path is sanitized here and again there.
export async function GET(request: Request) {
  const rl = await rateLimit(request, 'twitch-start', { limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many attempts — try again shortly.' }, { status: 429, headers: rateLimitHeaders(rl) });
  }
  const cfg = twitchConfig();
  if (!cfg) return NextResponse.json({ error: 'Twitch is not set up on this server.' }, { status: 503 });

  const url = new URL(request.url);
  const mode: LinkMode = url.searchParams.get('as') === 'host' ? 'host' : 'viewer';
  const returnTo = safeReturnPath(url.searchParams.get('return'));
  const space = Number(url.searchParams.get('space'));
  const host = request.headers.get('host');

  if (!isApexHost(host)) {
    const clan = await resolveClanFromRequest(request);
    const apexStart = new URL('/api/auth/twitch/start', originForHost(apexDomain()));
    apexStart.searchParams.set('as', mode);
    apexStart.searchParams.set('return', returnTo);
    if (mode === 'host' && Number.isInteger(space)) apexStart.searchParams.set('space', String(space));
    if (clan) apexStart.searchParams.set('clan', clan.host);
    return NextResponse.redirect(apexStart);
  }

  const session = await verifyUser();
  if (!session) return NextResponse.redirect(new URL(`/login?return=${encodeURIComponent(returnTo)}`, request.url));

  let clanId: number | null = null;
  if (mode === 'host') {
    if (!Number.isInteger(space) || space <= 0 || !(await isAdminOfCreatorSpace(space, session.userId))) {
      return NextResponse.json({ error: 'Only the space’s admins can connect its Twitch channel.' }, { status: 403 });
    }
    clanId = space;
  }

  const nonce = newNonce();
  const state = signState(
    {
      u: session.userId,
      m: mode,
      c: clanId,
      r: returnTo,
      h: url.searchParams.get('clan')?.slice(0, 253) || null,
      n: nonce,
      e: Date.now() + STATE_TTL_MS,
    },
    cfg.tokenKey,
  );

  const res = NextResponse.redirect(authorizeUrl(cfg, mode, state));
  res.cookies.set(TWITCH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth/twitch',
    maxAge: Math.floor(STATE_TTL_MS / 1000),
    ...(sessionCookieDomain() ? { domain: sessionCookieDomain()! } : {}),
  });
  return res;
}

import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { apexDomain, isApexHost, originForHost, sessionCookieDomain } from '@/lib/apexHost';
import { resolveClanFromRequest } from '@/lib/clanContext';
import { isAdminOfCreatorSpace } from '@/lib/entryGatesDb';
import {
  KICK_NONCE_COOKIE,
  KICK_STATE_TTL_MS,
  kickAuthorizeUrl,
  kickConfig,
  newKickNonce,
  pkceChallenge,
  pkceVerifier,
  signKickState,
} from '@/lib/kick';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { safeReturnPath } from '@/lib/safe-redirect';

// GET /api/auth/kick/start?space=<clanId>&return=/c/slug/admin/clan
//
// A creator space's admin connecting the space's Kick channel (lib/kick, lib/gates/kickDb). Viewers
// never come here — they prove their Kick account with a chat code (api/auth/kick/code).
//
// The same protections as the Twitch start: runs on the APEX (one redirect URI), the state is signed
// and names the user and space, it is bound to an httpOnly nonce cookie, and the callback re-checks
// all of it plus that the person is still an admin. PKCE (S256) as Kick requires; the verifier is
// derived from the nonce with a server-only key, so it is never stored or sent to the browser.
export async function GET(request: Request) {
  const rl = await rateLimit(request, 'kick-start', { limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many attempts — try again shortly.' }, { status: 429, headers: rateLimitHeaders(rl) });
  }
  const cfg = kickConfig();
  if (!cfg) return NextResponse.json({ error: 'Kick is not set up on this server.' }, { status: 503 });

  const url = new URL(request.url);
  const returnTo = safeReturnPath(url.searchParams.get('return'));
  const space = Number(url.searchParams.get('space'));
  const host = request.headers.get('host');

  if (!isApexHost(host)) {
    const clan = await resolveClanFromRequest(request);
    const apexStart = new URL('/api/auth/kick/start', originForHost(apexDomain()));
    apexStart.searchParams.set('return', returnTo);
    if (Number.isInteger(space)) apexStart.searchParams.set('space', String(space));
    if (clan) apexStart.searchParams.set('clan', clan.host);
    return NextResponse.redirect(apexStart);
  }

  const session = await verifyUser();
  if (!session) return NextResponse.redirect(new URL(`/login?return=${encodeURIComponent(returnTo)}`, request.url));
  if (!Number.isInteger(space) || space <= 0 || !(await isAdminOfCreatorSpace(space, session.userId))) {
    return NextResponse.json({ error: 'Only the space’s admins can connect its Kick channel.' }, { status: 403 });
  }

  const nonce = newKickNonce();
  const state = signKickState(
    {
      u: session.userId,
      c: space,
      r: returnTo,
      h: url.searchParams.get('clan')?.slice(0, 253) || null,
      n: nonce,
      e: Date.now() + KICK_STATE_TTL_MS,
    },
    cfg.tokenKey,
  );

  const res = NextResponse.redirect(kickAuthorizeUrl(cfg, state, pkceChallenge(pkceVerifier(nonce, cfg.tokenKey))));
  res.cookies.set(KICK_NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth/kick',
    maxAge: Math.floor(KICK_STATE_TTL_MS / 1000),
    ...(sessionCookieDomain() ? { domain: sessionCookieDomain()! } : {}),
  });
  return res;
}

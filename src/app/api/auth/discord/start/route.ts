import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildAuthorizeUrl, getOAuthMode } from '@/lib/discord-oauth';
import { safeReturnPath } from '@/lib/safe-redirect';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import {
  apexDomain,
  isApexHost,
  originForHost,
  resolveClanFromRequest,
  sessionCookieDomain,
} from '@/lib/clanContext';

const STATE_COOKIE = 'discord_oauth_state';
const RETURN_COOKIE = 'discord_oauth_return';
const RETURN_HOST_COOKIE = 'discord_oauth_return_host';
const STATE_TTL_SECONDS = 600; // 10 minutes

// GET /api/auth/discord/start?return=/profile
//
// Login runs on the APEX, always. One deployment means one Discord app with one registered redirect
// URI, so the callback cannot land on a clan's own host — Discord refuses any callback that is not
// the single allowlisted one. A request that arrives on a clan host is therefore bounced to the
// apex, carrying where it came from, and handed back after the session exists.
//
// The session cookie is set on the apex DOMAIN, so every clan beneath it can read it. That is only
// safe because clans are children of the apex: on sibling hosts the nearest shared parent would be
// the whole registrable domain, and one deployment's login would be readable by another's.
export async function GET(request: Request) {
  const rl = await rateLimit(request, 'oauth-start', { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many login attempts — try again shortly.' },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const url = new URL(request.url);
  const returnTo = safeReturnPath(url.searchParams.get('return'));
  const isProd = process.env.NODE_ENV === 'production';
  const host = request.headers.get('host');

  // On a clan host: hand off to the apex, naming this clan as where to come back to. The clan is
  // resolved from the request rather than trusted from a parameter, so the value that travels is
  // one we looked up.
  if (!isApexHost(host)) {
    const clan = await resolveClanFromRequest(request);
    if (!clan) {
      return NextResponse.json({ error: 'Unknown clan for this host.' }, { status: 404 });
    }
    const apexStart = new URL('/api/auth/discord/start', originForHost(apexDomain()));
    apexStart.searchParams.set('return', returnTo);
    apexStart.searchParams.set('clan', clan.host);
    return NextResponse.redirect(apexStart);
  }

  // On the apex: run the actual OAuth round trip.
  if (getOAuthMode() !== 'own') {
    return NextResponse.json({ error: 'Discord login is not configured on the server.' }, { status: 503 });
  }

  // Where to send them afterwards. Validated below at the callback too — this cookie only records
  // an intent, and a tampered value can still only resolve to a real clan or to the apex.
  const requestedClanHost = url.searchParams.get('clan');

  const state = crypto.randomBytes(24).toString('hex');
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  const cookie = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
    maxAge: STATE_TTL_SECONDS,
    // Apex-scoped like the session, so the round trip survives the hand-off.
    ...(sessionCookieDomain() ? { domain: sessionCookieDomain()! } : {}),
  };

  res.cookies.set(STATE_COOKIE, state, cookie);
  if (returnTo !== '/') res.cookies.set(RETURN_COOKIE, returnTo, cookie);
  if (requestedClanHost) res.cookies.set(RETURN_HOST_COOKIE, requestedClanHost, cookie);
  return res;
}

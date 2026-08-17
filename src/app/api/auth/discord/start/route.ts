import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildAuthorizeUrl, getOAuthMode } from '@/lib/discord-oauth';
import { safeReturnPath } from '@/lib/safe-redirect';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

const STATE_COOKIE = 'discord_oauth_state';
const RETURN_COOKIE = 'discord_oauth_return';
const STATE_TTL_SECONDS = 600; // 10 minutes

// GET /api/auth/discord/start?return=/profile
// Kicks off login by redirecting to Discord with a CSRF state we round-trip in a cookie.
//
// This used to fork: a managed instance handed the round trip to the federation broker, which
// authenticated the Discord identity and posted a signed assertion back to /broker-callback, and
// `?mode=broker` forced that path as a recovery hatch for a misconfigured BYO app. Federation is
// gone and one deployment means one Discord app, so there is a single path again.
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

  if (getOAuthMode() !== 'own') {
    return NextResponse.json({ error: 'Discord login is not configured on the server.' }, { status: 503 });
  }

  const state = crypto.randomBytes(24).toString('hex');
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  });
  if (returnTo !== '/') {
    res.cookies.set(RETURN_COOKIE, returnTo, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: STATE_TTL_SECONDS,
    });
  }
  return res;
}

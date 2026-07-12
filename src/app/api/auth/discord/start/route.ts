import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildAuthorizeUrl, isDiscordOAuthConfigured } from '@/lib/discord-oauth';
import { safeReturnPath } from '@/lib/safe-redirect';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

const STATE_COOKIE = 'discord_oauth_state';
const RETURN_COOKIE = 'discord_oauth_return';
const STATE_TTL_SECONDS = 600; // 10 minutes

// GET /api/auth/discord/start?return=/profile
// Generates a CSRF state, stores it as an HTTP-only cookie, and redirects to Discord.
export async function GET(request: Request) {
  const rl = await rateLimit(request, 'oauth-start', { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many login attempts — try again shortly.' }, { status: 429, headers: rateLimitHeaders(rl) });
  if (!isDiscordOAuthConfigured()) {
    return NextResponse.json(
      { error: 'Discord OAuth is not configured on the server.' },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  // Sanitize to a same-origin path so it can't be weaponized into an open redirect after login.
  const returnTo = safeReturnPath(url.searchParams.get('return'));

  const state = crypto.randomBytes(24).toString('hex');
  const authorizeUrl = buildAuthorizeUrl(state);

  const res = NextResponse.redirect(authorizeUrl);
  const isProd = process.env.NODE_ENV === 'production';
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  });
  // returnTo is already normalized to a safe same-origin path by safeReturnPath above, so it can't
  // be turned into an open redirect after login. Skip the cookie for the default "/" (nothing to
  // remember).
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

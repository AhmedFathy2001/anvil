import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildAuthorizeUrl, isDiscordOAuthConfigured } from '@/lib/discord-oauth';

const STATE_COOKIE = 'discord_oauth_state';
const RETURN_COOKIE = 'discord_oauth_return';
const STATE_TTL_SECONDS = 600; // 10 minutes

// GET /api/auth/discord/start?return=/profile
// Generates a CSRF state, stores it as an HTTP-only cookie, and redirects to Discord.
export async function GET(request: Request) {
  if (!isDiscordOAuthConfigured()) {
    return NextResponse.json(
      { error: 'Discord OAuth is not configured on the server.' },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const returnTo = url.searchParams.get('return') || '/';

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
  // Only allow same-origin paths in the return cookie. Reject anything containing
  // a scheme or "//" so this can't be turned into an open redirect.
  if (returnTo.startsWith('/') && !returnTo.startsWith('//')) {
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

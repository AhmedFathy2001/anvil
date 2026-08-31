import { NextResponse } from 'next/server';
import { safeReturnPath } from '@/lib/safe-redirect';
import { originForHost, resolveClanFromRequest, sessionCookieDomain } from '@/lib/clanContext';
import { publicOrigin } from '@/lib/request-origin';

const SESSION_COOKIE = 'admin_session';

// POST /api/auth/logout — clears the session cookie. Accepts GET for convenience from a plain anchor
// tag, since this is an idempotent state-clearing action.
//
// The delete MUST carry the same domain the cookie was set with. The session is apex-scoped so every
// clan beneath the apex can read it (see lib/clanContext), and a browser only removes a cookie when
// the delete matches its domain — clearing host-only here would leave the session intact and sign
// nobody out, on every clan at once.
async function clear(request: Request) {
  const url = new URL(request.url);
  const safeReturn = safeReturnPath(url.searchParams.get('return'));

  // Stay on the clan they logged out from; fall back to the apex when the host names no clan.
  //
  // NOT `new URL(request.url).host`. Behind Caddy the standalone server sees its own BIND address,
  // so that fallback sent anyone signing out from an apex page — /, /profile, /clans, /staff — to
  // https://0.0.0.0:3000/, which exists nowhere off this machine. lib/request-origin was written for
  // exactly this trap and says so in its own header; login two files over already used it, and this
  // route was the one that missed it.
  const clan = await resolveClanFromRequest(request);
  const origin = clan ? originForHost(clan.host) : publicOrigin(request);

  const res = NextResponse.redirect(new URL(safeReturn, origin));
  const domain = sessionCookieDomain();
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0, ...(domain ? { domain } : {}) });
  return res;
}

export const GET = clear;
export const POST = clear;

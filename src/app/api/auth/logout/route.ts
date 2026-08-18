import { NextResponse } from 'next/server';
import { safeReturnPath } from '@/lib/safe-redirect';
import { originForHost, resolveClanFromRequest, sessionCookieDomain } from '@/lib/clanContext';

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
  const clan = await resolveClanFromRequest(request);
  const origin = originForHost(clan?.host ?? new URL(request.url).host);

  const res = NextResponse.redirect(new URL(safeReturn, origin));
  const domain = sessionCookieDomain();
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0, ...(domain ? { domain } : {}) });
  return res;
}

export const GET = clear;
export const POST = clear;

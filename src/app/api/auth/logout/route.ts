import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'admin_session';

// POST /api/auth/logout — clears the session cookie. Accepts GET for convenience
// from a plain anchor tag, since this is an idempotent state-clearing action.
async function clear(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('return') || '/';
  const safeReturn = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  const res = NextResponse.redirect(new URL(safeReturn, request.url));
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

export const GET = clear;
export const POST = clear;

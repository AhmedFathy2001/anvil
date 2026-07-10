import { NextResponse } from 'next/server';
import { publicOrigin } from '@/lib/request-origin';
import { safeReturnPath } from '@/lib/safe-redirect';

const SESSION_COOKIE = 'admin_session';

// POST /api/auth/logout — clears the session cookie. Accepts GET for convenience
// from a plain anchor tag, since this is an idempotent state-clearing action.
async function clear(request: Request) {
  const url = new URL(request.url);
  const safeReturn = safeReturnPath(url.searchParams.get('return'));
  const res = NextResponse.redirect(new URL(safeReturn, publicOrigin(request)));
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

export const GET = clear;
export const POST = clear;

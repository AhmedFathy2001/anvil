import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { sessionCookieDomain } from '@/lib/clanContext';

// POST /api/auth/logout-everywhere — end every session this login holds, on every device.
//
// Plain logout only deletes THIS browser's cookie; the token itself stays valid for its 30 days, so
// a cookie lifted off another machine kept working however often its owner signed out. Bumping
// users.session_version makes every token minted before now stale — verifyUser refuses a token
// whose version is behind the row's — which is the one revocation a stateless session has.
//
// POST only. A GET would let any page sign a visitor out of everything with an <img> tag.
export async function POST() {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, session.userId));

  const res = NextResponse.json({ ok: true });
  const domain = sessionCookieDomain();
  res.cookies.set('admin_session', '', { path: '/', maxAge: 0, ...(domain ? { domain } : {}) });
  return res;
}

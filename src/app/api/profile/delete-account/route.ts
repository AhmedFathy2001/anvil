import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { LAB_VIEW_AS_COOKIE, sessionIssuedAt, verifyUser } from '@/lib/auth';
import { sessionCookieDomain } from '@/lib/clanContext';
import { erasePerson } from '@/lib/erasePerson';
import { log } from '@/lib/logger';
import { confirmPhraseMatches, sessionIsRecent } from '@/lib/personData';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';

// POST /api/profile/delete-account — the signed-in person deletes their own account. Body: { confirm }.
//
// ONLY THEMSELVES. The id comes from the session and from nowhere else: there is no id in the body,
// no staff path, and it is refused while staff are viewing the site as someone else or acting with a
// borrowed grant, because then "the signed-in person" is not the human at the keyboard.
//
// A RECENT SIGN-IN, not a second factor. The session cookie lasts 30 days; an unlocked laptop should
// not be able to end an account. Past the window they sign in with Discord again, which is the only
// sign-in there is, and come back.
//
// POST only, and never from another site.
export async function POST(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Not allowed from another site.' }, { status: 403 });
  }
  const session = await verifyUser();
  if (!session || session.userId <= 0) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (session.labViewAs || session.actingAs) {
    return NextResponse.json({ error: 'Not while you are viewing or acting as someone else.' }, { status: 403 });
  }

  const rl = await rateLimitByKey('account-delete', String(session.userId), { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many tries. Wait an hour and try again.' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  // The cookie's own sign-in time, and it must be this login's cookie.
  const issued = await sessionIssuedAt();
  if (!issued || issued.userId !== session.userId || !sessionIsRecent(issued.issuedAtMs)) {
    return NextResponse.json(
      { error: 'Sign in again first. It has been a while since you signed in.', code: 'reauth' },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;
  const [user] = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!confirmPhraseMatches(body?.confirm, user.displayName)) {
    return NextResponse.json({ error: 'Type DELETE, or your display name, to confirm.', code: 'confirm' }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof erasePerson>>;
  try {
    result = await erasePerson({ userId: session.userId });
  } catch (err) {
    // Nothing was deleted: it is one transaction. No id in the log line beyond the login's number.
    log.error('account.erase.failed', { userId: session.userId }, err);
    return NextResponse.json({ error: 'Nothing was deleted. Something went wrong on our side, try again.' }, { status: 500 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.blockers[0]?.message ?? 'This account cannot be deleted yet.', code: 'blocked', blockers: result.blockers }, { status: 409 });
  }

  // Every session and every plugin sign-in died with the row. This clears the cookies this browser
  // still holds, with the domain they were set on, so it does not keep sending a dead one.
  const res = NextResponse.json({ ok: true });
  const domain = sessionCookieDomain();
  for (const name of ['admin_session', LAB_VIEW_AS_COOKIE, 'captain_session']) {
    res.cookies.set(name, '', { path: '/', maxAge: 0, ...(domain ? { domain } : {}) });
  }
  return res;
}

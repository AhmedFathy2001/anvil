import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, clanAuditLog } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { exchangeCodeForToken, fetchDiscordUser } from '@/lib/discord-oauth';
import { signUserToken } from '@/lib/auth';

const STATE_COOKIE = 'discord_oauth_state';
const RETURN_COOKIE = 'discord_oauth_return';
const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function fail(message: string, status = 400) {
  // Render a minimal HTML page so users get a readable error rather than raw JSON,
  // since this endpoint is hit via top-level browser navigation.
  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;background:#1a1410;color:#f5f0e8;padding:40px;"><h1 style="color:#f0c674">Login failed</h1><p>${message}</p><p><a href="/login" style="color:#f0c674">Try again</a></p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

// GET /api/auth/discord/callback?code=…&state=…
// Verifies CSRF state, exchanges the code for a token, fetches the Discord user,
// finds-or-creates a users row, and sets the session cookie.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) return fail(`Discord returned: ${error}`);
  if (!code || !state) return fail('Missing code or state.');

  const cookieHeader = request.headers.get('cookie') || '';
  const cookieMap = new Map(
    cookieHeader
      .split(';')
      .map((c) => c.trim().split('='))
      .filter((p) => p.length === 2)
      .map(([k, v]) => [k, decodeURIComponent(v)]),
  );
  const expectedState = cookieMap.get(STATE_COOKIE);
  const returnTo = cookieMap.get(RETURN_COOKIE) || '/';

  if (!expectedState || expectedState !== state) {
    return fail('OAuth state mismatch — please retry from the login page.');
  }

  let discordUser;
  try {
    const accessToken = await exchangeCodeForToken(code);
    discordUser = await fetchDiscordUser(accessToken);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Discord exchange failed.', 502);
  }

  const nowIso = new Date().toISOString();
  const displayName = discordUser.globalName || discordUser.username;

  // Find existing user by Discord ID
  let user = await db.query.users.findFirst({
    where: eq(users.discordId, discordUser.id),
  });

  // Bootstrap path: if ADMIN_DISCORD_ID matches and there is no admin yet, this user
  // gets promoted to admin so we never end up locked out of staff functions.
  const seedAdminDiscordId = process.env.ADMIN_DISCORD_ID?.trim();
  let role: 'admin' | 'moderator' | 'member' = 'member';
  if (seedAdminDiscordId && seedAdminDiscordId === discordUser.id) {
    role = 'admin';
  }

  if (!user) {
    const inserted = await db
      .insert(users)
      .values({
        displayName,
        discordId: discordUser.id,
        discordUsername: discordUser.username,
        discordAvatar: discordUser.avatar,
        email: discordUser.email,
        role,
        lastLoginAt: nowIso,
      })
      .returning();
    user = inserted[0];

    // Audit: new user signed up via Discord
    db.insert(clanAuditLog)
      .values({
        eventType: 'user_signed_up',
        actorUserId: user.id,
        newValue: JSON.stringify({
          userId: user.id,
          discordId: user.discordId,
          discordUsername: user.discordUsername,
          role: user.role,
        }),
        notes: 'Discord OAuth first login',
      })
      .catch(() => {});
  } else {
    // Refresh Discord-side fields on every login so renamed avatars/usernames stay current.
    // Keep their existing role unless the seed-admin condition applied above.
    const nextRole = role === 'admin' && user.role !== 'admin' ? 'admin' : user.role;
    await db
      .update(users)
      .set({
        discordUsername: discordUser.username,
        discordAvatar: discordUser.avatar,
        email: discordUser.email,
        displayName: user.displayName || displayName,
        lastLoginAt: nowIso,
        role: nextRole,
      })
      .where(eq(users.id, user.id));
  }

  if (!user) return fail('Could not load or create user.', 500);

  const token = signUserToken(user.id, user.discordUsername || user.username || 'user', user.role);
  const isProd = process.env.NODE_ENV === 'production';

  const res = NextResponse.redirect(new URL(returnTo, request.url));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  // Clear the temporary OAuth cookies
  res.cookies.set(STATE_COOKIE, '', { path: '/', maxAge: 0 });
  res.cookies.set(RETURN_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

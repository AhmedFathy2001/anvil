import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, clanAuditLog, clanMembers } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { exchangeCodeForToken, fetchDiscordUser } from '@/lib/discord-oauth';
import { signUserToken } from '@/lib/auth';
import { applyPendingRole } from '@/lib/pending-role';
import { syncRolesForClanMemberFireAndForget } from '@/lib/discord-roles';
import { log } from '@/lib/logger';

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

  // Genesis ownership: on a brand-new instance, the very first ADMIN_DISCORD_ID login becomes the
  // protected owner (see users.isOwner). Gated on "no owner exists yet" purely to avoid ever minting
  // a second owner — this is NOT a reclaim path. If the owner is later removed, ownership is restored
  // out-of-band (edit the DB on self-host; the provider handles it on managed hosting), never by env.
  // Only fires while inserting a brand-new user, so a returning user never silently regains the crown.
  const grantOwner =
    !user &&
    role === 'admin' &&
    (await db.query.users.findFirst({ where: eq(users.isOwner, true) })) == null;

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
        isOwner: grantOwner,
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

  // Auto-claim unlinked clan_members whose RSN matches the Discord display name.
  // Supports the "name1 / name2 / name3" alt convention by splitting on / | ,. Combined
  // with the admin-side `pending_role` pre-assignment, this is what lets a user log in
  // via Discord and immediately have moderator/admin on the site without a separate
  // plugin handshake.
  //
  // Trust model: Discord OAuth proves the Discord identity; the admin's pre-assignment
  // is the assertion that *this RSN* belongs to *this person*. The display-name match
  // closes the loop. Without an admin pre-assignment we still claim the clan_member —
  // the user just doesn't gain any elevated site role.
  //
  // Matching is OSRS-aware: underscores and whitespace are treated as equivalent,
  // matching how Jagex renders RSNs in URLs vs in-game (Discord usernames can't
  // contain spaces, so users substitute `_` — "KPX_Nisbro" must claim "KPX Nisbro").
  // We do this in memory rather than via the rsn_normalized index because the column
  // preserves underscores ("Skaterz_boi2"); pushing _↔space equivalence into the
  // unique index would require a one-time backfill we don't want to bundle here.
  try {
    const osrsNormalize = (s: string): string =>
      s.trim().toLowerCase().replace(/[\s_]+/g, ' ');

    const aliasSources = [discordUser.globalName, discordUser.username].filter(
      (s): s is string => typeof s === 'string' && s.length > 0,
    );
    const fuzzyAliases = new Set<string>();
    for (const src of aliasSources) {
      for (const part of src.split(/[\/|,]/).map((s) => s.trim()).filter((s) => s.length > 0)) {
        const norm = osrsNormalize(part);
        if (norm) fuzzyAliases.add(norm);
      }
    }

    if (fuzzyAliases.size > 0) {
      // Pull all unlinked active clan_members and filter in memory. Roster size for
      // a single clan is small enough that this is faster than several round-trips,
      // and there's no clean SQL way to express "treat _ as space" in the WHERE.
      const unlinked = await db
        .select()
        .from(clanMembers)
        .where(and(isNull(clanMembers.userId), isNull(clanMembers.leftAt)));
      const candidates = unlinked.filter((cm) => fuzzyAliases.has(osrsNormalize(cm.rsn)));

      for (const cm of candidates) {
        await db
          .update(clanMembers)
          .set({
            userId: user.id,
            claimedAt: cm.claimedAt ?? nowIso,
            verifiedAt: cm.verifiedAt ?? nowIso,
            verificationMethod: cm.verificationMethod ?? 'discord_name_match',
            // Provisional only if the admin hasn't pre-vetted this RSN with a pending role.
            // A pre-assigned role means the admin has already asserted "this RSN is this
            // person"; combined with OAuth, that's enough to skip the watchlist.
            provisional: cm.pendingRole ? 0 : 1,
          })
          .where(eq(clanMembers.id, cm.id));

        db.insert(clanAuditLog)
          .values({
            clanMemberId: cm.id,
            eventType: 'claimed',
            newValue: JSON.stringify({
              userId: user.id,
              discordId: user.discordId,
              method: 'discord_name_match',
              matchedAlias: cm.rsn,
              provisional: cm.pendingRole ? 0 : 1,
            }),
            actorUserId: user.id,
            notes: 'Discord OAuth login matched display name against pre-assigned RSN',
          })
          .catch(() => {});

        if (cm.pendingRole) {
          await applyPendingRole(cm.id, user.id, 'manual_approval');
        }

        // Sync Discord roles for the newly-claimed member (fire-and-forget; no-op when
        // the role-sync feature flag isn't enabled or the bot token isn't configured).
        syncRolesForClanMemberFireAndForget(cm.id);
      }

      // Refresh the user row so the session token below carries any role promotion.
      const refreshed = await db.query.users.findFirst({ where: eq(users.id, user.id) });
      if (refreshed) user = refreshed;
    }
  } catch (err) {
    // Never block sign-in on a claim failure. The user can re-trigger via plugin link
    // or stat-delta verification.
    log.warn('oauth.claim-fail', { userId: user.id, discordId: user.discordId }, err);
  }

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

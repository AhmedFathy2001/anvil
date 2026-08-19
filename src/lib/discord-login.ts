import { NextResponse } from 'next/server';
import { personOfOrCreate } from '@/lib/roster';
import { db } from '@/db';
import { accounts, clanAuditLog, clanRoster, players, users } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { DiscordUser } from '@/lib/discord-oauth';
import { signUserToken } from '@/lib/auth';
import { publicOrigin } from '@/lib/request-origin';
import { originForHost, sessionCookieDomain } from '@/lib/clanContext';
import { applyPendingRole } from '@/lib/pending-role';
import { syncRolesForClanMemberFireAndForget } from '@/lib/discord-roles';
import { log } from '@/lib/logger';

const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Escape text before it goes into the raw HTML error page. `message` can carry attacker-controlled
// content (reflected `?error=`), so interpolating it unescaped is a reflected-XSS sink.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// A readable HTML error page for the login endpoints (hit via top-level browser navigation, so JSON
// would be unfriendly). Shared by both the direct-OAuth and brokered callbacks.
export function loginFailPage(message: string, status = 400): NextResponse {
  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;background:#1a1410;color:#f5f0e8;padding:40px;"><h1 style="color:#f0c674">Login failed</h1><p>${escapeHtml(message)}</p><p><a href="/login" style="color:#f0c674">Try again</a></p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/**
 * The post-identity login pipeline. Given a VERIFIED Discord identity — obtained EITHER via a direct
 * OAuth code exchange OR a broker-signed login assertion — find-or-create the users row, run the RSN
 * auto-claim, enforce bans, and issue the `admin_session`. Kept in one place so the two login sources
 * (direct + brokered) can never diverge on authorization: bans, roles and ownership are decided HERE,
 * on the site, exactly as a self-hosted instance does. Throws only on an unexpected DB failure (the
 * caller renders loginFailPage); a banned user gets a cookieless redirect, never a session.
 */
export async function completeDiscordLogin(
  discordUser: DiscordUser,
  opts: { returnTo: string; returnHost?: string; request: Request; clearCookies?: string[] },
): Promise<NextResponse> {
  const { returnTo, returnHost, request, clearCookies = [] } = opts;
  const nowIso = new Date().toISOString();
  const displayName = discordUser.globalName || discordUser.username;

  // Find existing user by Discord ID
  let user = await db.query.users.findFirst({ where: eq(users.discordId, discordUser.id) });
  const isNewUser = !user;

  // Bootstrap path: if ADMIN_DISCORD_ID matches, this user is promoted to admin so we never end up
  // locked out of staff functions.
  const seedAdminDiscordId = process.env.ADMIN_DISCORD_ID?.trim();
  let role: 'admin' | 'moderator' | 'member' = 'member';
  if (seedAdminDiscordId && seedAdminDiscordId === discordUser.id) {
    role = 'admin';
  }

  // Genesis ownership: on a brand-new instance, the very first ADMIN_DISCORD_ID login becomes the
  // protected owner (users.isOwner). Gated on "no owner exists yet" purely to avoid ever minting a
  // second owner — NOT a reclaim path. Only fires while inserting a brand-new user.
  const grantOwner =
    !user &&
    role === 'admin' &&
    (await db.query.users.findFirst({ where: eq(users.isOwner, true) })) == null;

  if (!user) {
    // The PERSON first. A login is how someone signs in, not who they are — accounts hang off the
    // person, so a user without one has no identity to attach an OSRS account to.
    //
    // Not optional and not deferred: users.id and players.id come from separate sequences, so a user
    // whose player_id is null cannot be compared against account ownership without matching an
    // unrelated person who happens to share the number.
    const [person] = await db.insert(players).values({ displayName }).returning();

    const inserted = await db
      .insert(users)
      .values({
        playerId: person.id,
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
    // Refresh Discord-side fields on every login. Keep their role unless the seed-admin condition
    // applied above. `email` may be null on a brokered login (broker doesn't request the email scope)
    // — don't overwrite a previously-captured email with null.
    const nextRole = role === 'admin' && user.role !== 'admin' ? 'admin' : user.role;
    await db
      .update(users)
      .set({
        discordUsername: discordUser.username,
        discordAvatar: discordUser.avatar,
        email: discordUser.email ?? user.email,
        displayName: user.displayName || displayName,
        lastLoginAt: nowIso,
        role: nextRole,
      })
      .where(eq(users.id, user.id));
  }

  if (!user) throw new Error('Could not load or create user.');

  // Auto-claim unlinked clan_members whose RSN matches the Discord display name. See the original
  // trust-model notes: OAuth proves the Discord identity, the admin's pending-role pre-assignment
  // asserts the RSN belongs to this person, the OSRS-aware (_↔space) display-name match closes it.
  try {
    const osrsNormalize = (s: string): string => s.trim().toLowerCase().replace(/[\s_]+/g, ' ');

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
      // clan-scope: global -- an account belongs to a person, not to a clan, so claiming one by
      // name match is a global question. Narrowing this to the clan whose site they happened to log
      // in from would leave their own accounts unclaimed everywhere else.
      const unlinked = await db
        .select()
        .from(clanRoster)
        .where(and(isNull(clanRoster.claimedAt), isNull(clanRoster.leftAt)));
      const candidates = unlinked.filter((cm) => fuzzyAliases.has(osrsNormalize(cm.rsn)));

      for (const cm of candidates) {
        await db
          .update(accounts)
          .set({
            playerId: await personOfOrCreate(user.id),
            claimedAt: cm.claimedAt ?? nowIso,
            verifiedAt: cm.verifiedAt ?? nowIso,
            verificationMethod: cm.verificationMethod ?? 'discord_name_match',
            provisional: cm.pendingRole ? 0 : 1,
          })
          .where(eq(accounts.id, cm.accountId));

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

        syncRolesForClanMemberFireAndForget(cm.id);
      }

      // Refresh the user row so the session token below carries any role promotion.
      const refreshed = await db.query.users.findFirst({ where: eq(users.id, user.id) });
      if (refreshed) user = refreshed;
    }
  } catch (err) {
    log.warn('oauth.claim-fail', { userId: user.id, discordId: user.discordId }, err);
  }

  const isProd = process.env.NODE_ENV === 'production';

  // Banned users complete the identity step but get no session cookie — refused at the door.
  if (user.banned) {
    // Same origin and cookie domain as the success path: a cookie set with a domain is only cleared
    // by a delete carrying that same domain, so omitting it here would leave the state cookies behind.
    const bannedOrigin = returnHost ? originForHost(returnHost) : publicOrigin(request);
    const bannedDomain = sessionCookieDomain();
    const banned = NextResponse.redirect(new URL('/login?error=banned', bannedOrigin));
    for (const c of clearCookies) {
      banned.cookies.set(c, '', { path: '/', maxAge: 0, ...(bannedDomain ? { domain: bannedDomain } : {}) });
    }
    return banned;
  }

  const token = signUserToken(
    user.id,
    user.discordUsername || user.username || 'user',
    user.role,
    user.editorScope ?? 'all',
    // Admins author implicitly; everyone else needs the explicit capability. It rides in the token
    // so edge middleware can route a moderator-who-builds-boards without a DB read.
    user.role === 'admin' || user.canEditTiles === true,
  );

  // First-ever login lands on the getting-started checklist unless a deep link was requested — but
  // only when we are returning to a CLAN. The apex has no /profile: profiles belong to a clan's
  // roster, so a first login that started at the directory goes back to the directory.
  const returningToClan = Boolean(returnHost);
  const destination = isNewUser && returnTo === '/' && returningToClan ? '/profile?welcome=1' : returnTo;

  // Back to the clan they started from. `returnHost` has already been resolved against the clans
  // table by the caller, so it is a host we produced rather than one a query parameter asked for.
  const origin = returnHost ? originForHost(returnHost) : publicOrigin(request);
  const res = NextResponse.redirect(new URL(destination, origin));

  // Scoped to the apex DOMAIN, not this host: the callback runs on the apex, and the session has to
  // be readable by the clan it redirects to. Safe only because clans live beneath the apex — see the
  // note in lib/clanContext.
  const cookieDomain = sessionCookieDomain();
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
  // Clear on the same domain they were set with, or they linger.
  for (const c of clearCookies) {
    res.cookies.set(c, '', { path: '/', maxAge: 0, ...(cookieDomain ? { domain: cookieDomain } : {}) });
  }
  return res;
}

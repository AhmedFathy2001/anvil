import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, clanAuditLog, clanMembers } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { DiscordUser } from '@/lib/discord-oauth';
import { signUserToken } from '@/lib/auth';
import { publicOrigin } from '@/lib/request-origin';
import { applyPendingRole } from '@/lib/pending-role';
import { syncRolesForClanMemberFireAndForget } from '@/lib/discord-roles';
import { pushMemberAssociations } from '@/lib/federation';
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
  opts: { returnTo: string; request: Request; clearCookies?: string[] },
): Promise<NextResponse> {
  const { returnTo, request, clearCookies = [] } = opts;
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

  // Federation: a rostered member logging in is a "member here" signal — advertise the association
  // to the trusted broker(s) so this clan can auto-populate in the member's plugin at their other
  // homes. Gated (enabled + associationPush + linked membership) and fire-and-forget inside.
  void pushMemberAssociations(user.id);

  // Banned users complete the identity step but get no session cookie — refused at the door.
  if (user.banned) {
    const banned = NextResponse.redirect(new URL('/login?error=banned', publicOrigin(request)));
    for (const c of clearCookies) banned.cookies.set(c, '', { path: '/', maxAge: 0 });
    return banned;
  }

  const token = signUserToken(user.id, user.discordUsername || user.username || 'user', user.role, user.editorScope ?? 'all');

  // First-ever login lands on the getting-started checklist unless a deep link was requested.
  const destination = isNewUser && returnTo === '/' ? '/profile?welcome=1' : returnTo;

  const res = NextResponse.redirect(new URL(destination, publicOrigin(request)));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  for (const c of clearCookies) res.cookies.set(c, '', { path: '/', maxAge: 0 });
  return res;
}

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { requireClanFromRequest } from '@/lib/clanContext';
import { accounts, clanAuditLog, clanMemberships, clanRoster, pluginLinkCodes, pluginLinks, users } from '@/db/schema';
import { findOrCreateAccount, findOrCreateSeat, findRosterSeat, findRosterSeats, personOf, personOfOrCreate } from '@/lib/roster';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { generateAdminPluginToken, normalizeRsn, sanitizeRsn } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { applyPendingRole } from '@/lib/pending-role';
import { applyRenameToActiveWeeklyParticipants } from '@/lib/weekly';
import { syncRolesForClanMemberFireAndForget } from '@/lib/discord-roles';
import { atLeast } from '@/lib/clanRoles';
import { admit } from '@/lib/guestAdmission';

// Plugin exchanges {code, rsn, accountHash} for a confirmed account link.
// The RSN comes from Client.getLocalPlayer().getName() inside RuneLite — we trust that value
// because the plugin is our client. accountHash (from client.getAccountHash()) is the stable
// Jagex identifier; passing it lets us detect renames and survive RSN changes.
//
// Admin issuers additionally receive a long-lived pluginLinks token that the plugin
// uses for clan-sync and other admin actions.
export async function POST(request: Request) {
  // Unauthenticated, so the Host is the only thing that names the clan being written to.
  const clan = await requireClanFromRequest(request);
  const rl = await rateLimit(request, 'plugin-link', { limit: 20, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: { code?: string; rsn?: string; accountHash?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const code = (body.code || '').trim().toUpperCase();
  const rsn = sanitizeRsn(body.rsn || '');
  const accountHash = typeof body.accountHash === 'string' ? body.accountHash.trim() : '';
  if (!code || code.length !== 6 || !rsn) {
    return NextResponse.json({ error: 'A 6-character code and rsn are required' }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  // Atomic consume — only one request flips consumedAt from null → now.
  const consumed = await db
    .update(pluginLinkCodes)
    .set({ consumedAt: nowIso })
    .where(
      and(
        eq(pluginLinkCodes.code, code),
        isNull(pluginLinkCodes.consumedAt),
        sql`${pluginLinkCodes.expiresAt} > ${nowIso}`,
      ),
    )
    .returning();

  const codeRow = consumed[0];
  if (!codeRow) {
    return NextResponse.json(
      { error: 'Invalid, already-used, or expired code' },
      { status: 400 },
    );
  }

  const issuingUser = await db.query.users.findFirst({ where: eq(users.id, codeRow.userId) });
  if (!issuingUser) {
    return NextResponse.json({ error: 'Issuer user no longer exists' }, { status: 403 });
  }

  const rsnNormalized = normalizeRsn(rsn);

  // Pick the existing clanMember row that this link should attach to:
  //   1) accountHash match — strongest, survives renames
  //   2) rsnNormalized match — for ghosts or members imported via sync
  let existing = accountHash
    ? await findRosterSeat(eq(clanRoster.accountHash, accountHash))
    : null;
  if (!existing) {
    existing = (await findRosterSeat(eq(clanRoster.rsnNormalized, rsnNormalized))) ?? null;
  }

  // Detect rename: accountHash matches a row whose RSN no longer matches what the plugin reports.
  const renamed =
    existing && accountHash && existing.accountHash === accountHash && existing.rsnNormalized !== rsnNormalized;
  // Ghost being claimed: a row exists but has no user attached yet.
  const claimingGhost = existing && existing.claimedAt == null;

  let clanMemberId: number;

  if (existing) {
    const previousRsns: string[] = (() => {
      if (!existing!.previousRsns) return [];
      try {
        const parsed = JSON.parse(existing!.previousRsns);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();
    if (renamed && existing.rsn) previousRsns.push(existing.rsn);

    // If another user already owns this clanMember, refuse to overwrite — the link
    // belongs to whoever first claimed it. The site can offer a transfer flow elsewhere.
    if (existing.claimedAt && existing.playerId !== (await personOf(issuingUser.id))) {
      return NextResponse.json(
        { error: 'This RuneScape account is already linked to a different site user.' },
        { status: 409 },
      );
    }

    // The name, the rename history and the proof are all facts about the ACCOUNT — so a rename
    // detected here is visible in every clan this account plays in, not just this one.
    await db
      .update(accounts)
      .set({
        rsn: renamed ? rsn : existing.rsn,
        rsnNormalized: renamed ? rsnNormalized : existing.rsnNormalized,
        previousRsns: previousRsns.length ? JSON.stringify(previousRsns) : existing.previousRsns,
        accountHash: accountHash || existing.accountHash,
        playerId: await personOfOrCreate(issuingUser.id),
        verifiedAt: nowIso,
        verificationMethod: 'plugin',
        provisional: 0,
        claimedAt: claimingGhost ? nowIso : existing.claimedAt,
        // The first account a user links becomes their primary unless one is already set.
        isPrimary: existing.isPrimary,
      })
      .where(eq(accounts.id, existing.accountId));
    await db
      .update(clanMemberships)
      .set({
        // If this seat was previously soft-deleted (left clan) and is now linking, treat them as
        // returned. Admin removals stay marked-left.
        leftAt: existing.source === 'admin' ? existing.leftAt : null,
        lastSeenInClan: nowIso,
      })
      .where(eq(clanMemberships.id, existing.id));

    clanMemberId = existing.id;

    if (renamed) {
      db.insert(clanAuditLog)
        .values({
          clanMemberId,
          eventType: 'renamed',
          oldValue: JSON.stringify({ rsn: existing.rsn }),
          newValue: JSON.stringify({ rsn }),
          actorUserId: issuingUser.id,
          notes: 'Detected via plugin link (accountHash matched)',
        })
        .catch(() => {});
      if (existing.rsn) {
        applyRenameToActiveWeeklyParticipants(clanMemberId, existing.rsn, rsn).catch(() => {});
      }
    }
    if (claimingGhost) {
      db.insert(clanAuditLog)
        .values({
          clanMemberId,
          eventType: 'claimed',
          newValue: JSON.stringify({ userId: issuingUser.id, rsn }),
          actorUserId: issuingUser.id,
        })
        .catch(() => {});
    }
    db.insert(clanAuditLog)
      .values({
        clanMemberId,
        eventType: 'verified',
        newValue: JSON.stringify({ method: 'plugin', accountHash: accountHash || null }),
        actorUserId: issuingUser.id,
      })
      .catch(() => {});
  } else {
    const account = await findOrCreateAccount({ rsn, rsnNormalized, accountHash: accountHash || null });
    await db
      .update(accounts)
      .set({
        playerId: await personOfOrCreate(issuingUser.id),
        verifiedAt: nowIso,
        verificationMethod: 'plugin',
        provisional: 0,
        claimedAt: nowIso,
        isPrimary: 0,
      })
      .where(eq(accounts.id, account.id));
    // Linking a plugin proves account ownership, not clan membership. Only the in-game roster sync
    // promotes a seat to 'member'.
    // Linking a character is a claim about WHO YOU ARE, not a claim on this clan's roster. Under
    // the default policy this raises a request instead of seating them; the account is still linked
    // to them either way, which is what they actually asked for.
    const admission = await admit({ clanId: clan.id, accountId: account.id });
    if (admission.outcome !== 'seated') {
      return NextResponse.json(
        {
          error:
            admission.outcome === 'refused'
              ? 'This clan is not taking guests.'
              : 'Sent to this clan’s staff — you’ll appear once they accept.',
          admission: admission.outcome,
        },
        { status: admission.outcome === 'refused' ? 403 : 202 },
      );
    }
    clanMemberId = admission.seatId;
    await db
      .update(clanMemberships)
      .set({ lastSeenInClan: nowIso })
      .where(eq(clanMemberships.id, clanMemberId));

    db.insert(clanAuditLog)
      .values({
        clanMemberId,
        eventType: 'verified',
        newValue: JSON.stringify({ method: 'plugin', accountHash: accountHash || null, rsn }),
        actorUserId: issuingUser.id,
      })
      .catch(() => {});
  }

  // First account becomes primary automatically. Done after the upsert so we can count
  // existing rows owned by this user.
  const issuingPlayerId = await personOf(issuingUser.id);
  const userAccounts = issuingPlayerId
    ? await findRosterSeats(and(eq(clanRoster.playerId, issuingPlayerId), isNull(clanRoster.leftAt)))
    : [];
  const hasPrimary = userAccounts.some((a) => a.isPrimary === 1);
  if (!hasPrimary) {
    await db.update(accounts).set({ isPrimary: 1 }).where(eq(clanMemberships.id, clanMemberId));
  }

  // Apply any pre-assigned pending role. Plugin-verified claims are high-trust so we
  // promote immediately. Won't downgrade — if the user already has a higher role
  // (e.g. existing admin claiming a "moderator"-tagged member) we skip.
  await applyPendingRole(clanMemberId, issuingUser.id, 'plugin');

  // Admins additionally get a long-lived pluginLinks token for clan-sync etc.
  // One active token per admin user — reused across in-game characters.
  let adminToken: string | null = null;
  if (atLeast(issuingUser.role, 'admin')) {
    const existing = await db.query.pluginLinks.findFirst({
      where: and(eq(pluginLinks.userId, issuingUser.id), isNull(pluginLinks.revokedAt)),
    });
    if (existing) {
      adminToken = existing.token;
    } else {
      adminToken = generateAdminPluginToken();
      await db.insert(pluginLinks).values({
        userId: issuingUser.id,
        token: adminToken,
      });
    }
  }

  // Now that this clan_member is linked to a Discord-authenticated user, we have
  // a high-confidence Discord id for role sync. Fire-and-forget — the response to
  // the plugin should not block on Discord round-trips.
  syncRolesForClanMemberFireAndForget(clanMemberId);

  return NextResponse.json({
    success: true,
    userId: issuingUser.id,
    username: issuingUser.username ?? issuingUser.discordUsername ?? null,
    displayName: issuingUser.displayName,
    role: issuingUser.role,
    rsn,
    clanMemberId,
    isAdmin: atLeast(issuingUser.role, 'admin'),
    adminToken,
  });
}

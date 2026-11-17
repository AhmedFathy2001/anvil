import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clanRoster } from '@/db/schema';
import { requireClan } from '@/lib/clanContext';
import { seatInClan, updateAccountOfSeat } from '@/lib/roster';
import { verifyUser } from '@/lib/auth';
import { discordProvenForOtherSeat, isGuildMember, syncRolesForClanMember } from '@/lib/discord-roles';
import { handLinkRefusal, mayHandLink, storedDiscordLink } from '@/lib/discordRoleSafety';
import { removeHandLink, roleRemovalMessage, takeBackRoles } from '@/lib/discordUnlinkRoles';
import { rosterClanSeat } from '@/lib/seatScope';

// Linking a roster member to a Discord account BY HAND, for the stragglers a sign-in has not reached.
//
// The link is stored on the character with its source ('admin'), who made it, when, and for which
// clan (drizzle/0265). Role sync trusts it in THIS clan whether or not nickname matching is on; no
// other clan that seats the same character reads it as a link. It never links a site login: that is
// the player's own act, and their sign-in beats this link the moment they make it.
//
// Owner and admin only. A moderator runs the roster but does not decide who a member is on Discord.

/** The signed-in admin (or owner) of this clan, or null. */
async function handLinker(): Promise<{ userId: number } | null> {
  const user = await verifyUser();
  return user && mayHandLink(user.role) ? { userId: user.userId } : null;
}

// GET — this clan's hand-made links, for the list an admin removes them from. Character names and
// dates only: which Discord account each points at is not repeated here.
export async function GET() {
  const clan = await requireClan();
  if (!(await handLinker())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const links = await db
    .select({ memberId: clanRoster.id, rsn: clanRoster.rsn, linkedAt: accounts.discordIdLinkedAt })
    .from(clanRoster)
    .innerJoin(accounts, eq(accounts.id, clanRoster.accountId))
    .where(
      and(
        eq(clanRoster.clanId, clan.id),
        eq(accounts.discordIdSource, 'admin'),
        eq(accounts.discordIdLinkedClanId, clan.id),
        isNull(clanRoster.leftAt),
        rosterClanSeat(),
      ),
    )
    .orderBy(clanRoster.rsn);
  return NextResponse.json({ links });
}

// POST { clanMemberId, discordUserId, removeOldRoles? } — point an UNCLAIMED roster entry at a Discord user.
// Validates the user is in the guild, stores the link with its source, then syncs their roles.
// `removeOldRoles: true`, when this REPLACES a link this clan made to a different Discord account,
// also takes this clan's Anvil roles off that old account (lib/discordUnlinkRoles).
export async function POST(request: Request) {
  const clan = await requireClan();
  const actor = await handLinker();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { clanMemberId?: unknown; discordUserId?: unknown; removeOldRoles?: unknown }
    | null;
  const clanMemberId = Number(body?.clanMemberId);
  const discordUserId = typeof body?.discordUserId === 'string' ? body.discordUserId : '';
  if (!Number.isFinite(clanMemberId) || !/^\d+$/.test(discordUserId)) {
    return NextResponse.json({ error: 'clanMemberId and a numeric discordUserId are required' }, { status: 400 });
  }

  // This clan's seat only — binding a Discord account to another clan's member is not this
  // admin's call, and the id arrived in the request body.
  const member = await seatInClan(clan.id, clanMemberId);
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  if (!(await isGuildMember(clan.id, discordUserId))) {
    return NextResponse.json({ error: "That Discord user isn't in the server." }, { status: 400 });
  }

  // ONLY an entry nobody has claimed: once a player owns the character, their own Discord login is
  // the answer, and a clan overwriting it would be one clan deciding who that person is everywhere.
  // Those go to Anvil (lib/characterReports).
  // AND NEVER an account a sign-in already ties to a different member here: the link hands over the
  // seat's rank roles, so it must not be a way to give one person another's standing.
  const refusal = handLinkRefusal({
    seatClaimed: member.claimedAt != null,
    provenForOtherSeat: member.claimedAt == null && (await discordProvenForOtherSeat(clan.id, member.id, discordUserId)),
  });
  if (refusal) {
    return NextResponse.json(
      { error: refusal, ...(member.claimedAt != null ? { code: 'reportToAnvil' } : {}) },
      { status: member.claimedAt != null ? 403 : 409 },
    );
  }

  // The hand link this one replaces, if this clan made one to a DIFFERENT account: that account
  // keeps its roles unless the admin asks for them back.
  const [replaced] = await db
    .select({ discordId: accounts.discordId })
    .from(accounts)
    .where(and(eq(accounts.id, member.accountId), eq(accounts.discordIdSource, 'admin'), eq(accounts.discordIdLinkedClanId, clan.id)))
    .limit(1);
  const oldDiscordId = replaced?.discordId && replaced.discordId !== discordUserId ? replaced.discordId : null;

  await updateAccountOfSeat(
    clanMemberId,
    storedDiscordLink(discordUserId, 'admin', { userId: actor.userId, clanId: clan.id, at: new Date().toISOString() }),
  );
  // The character and who did it. Not the Discord account: every staff member reads this log.
  await db
    .insert(clanAuditLog)
    .values({
      clanId: clan.id,
      clanMemberId: member.id,
      eventType: 'discord_linked_by_hand',
      actorUserId: actor.userId,
      newValue: JSON.stringify({ rsn: member.rsn, source: 'admin' }),
      notes: `Discord account linked by hand to ${member.rsn}`,
    })
    .catch(() => {});

  // Assign roles only — do NOT rename them. The site RSN can be stale (renames) or an alt, so
  // clobbering their current Discord nick on a manual link is wrong (skipNickname = true).
  const report = await syncRolesForClanMember(clanMemberId, undefined, true);
  if (!oldDiscordId) return NextResponse.json({ success: true, report });
  // After the new link is stored, so the old account is judged on what it still holds here.
  if (body?.removeOldRoles !== true) {
    return NextResponse.json({ success: true, report, replaced: true, oldAccountMessage: 'The Discord account linked before keeps its roles until you remove them in Discord.' });
  }
  const oldRoles = await takeBackRoles({ clanId: clan.id, seatId: member.id, rsn: member.rsn, actorUserId: actor.userId, discordUserId: oldDiscordId });
  return NextResponse.json({ success: true, report, replaced: true, oldRoles, oldAccountMessage: `The account linked before: ${roleRemovalMessage(oldRoles)}` });
}

// DELETE { clanMemberId, removeRoles? } — remove a link this clan's admin made by hand. The stored
// id is cleared, so role sync stops giving that Discord account this member's roles.
// `removeRoles: true` also takes back the roles Anvil gave that account in this clan's server
// (lib/discordUnlinkRoles): only roles in this clan's own mapping, and not while the account still
// earns them another way. The link is removed whatever Discord says; `message` tells the admin what
// happened to the roles, per role.
export async function DELETE(request: Request) {
  const clan = await requireClan();
  const actor = await handLinker();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { clanMemberId?: unknown; removeRoles?: unknown } | null;
  const clanMemberId = Number(body?.clanMemberId);
  if (!Number.isInteger(clanMemberId)) return NextResponse.json({ error: 'clanMemberId is required' }, { status: 400 });

  const result = await removeHandLink({ clanId: clan.id, clanMemberId, actorUserId: actor.userId, removeRoles: body?.removeRoles === true });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true, roles: result.roles, message: result.message });
}

import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clanRoster } from '@/db/schema';
import { requireClan } from '@/lib/clanContext';
import { seatInClan, updateAccountOfSeat } from '@/lib/roster';
import { verifyUser } from '@/lib/auth';
import { discordProvenForOtherSeat, isGuildMember, syncRolesForClanMember } from '@/lib/discord-roles';
import { handLinkRefusal, mayHandLink, storedDiscordLink } from '@/lib/discordRoleSafety';
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

// POST { clanMemberId, discordUserId } — point an UNCLAIMED roster entry at a Discord user.
// Validates the user is in the guild, stores the link with its source, then syncs their roles.
export async function POST(request: Request) {
  const clan = await requireClan();
  const actor = await handLinker();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { clanMemberId?: unknown; discordUserId?: unknown }
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
  return NextResponse.json({ success: true, report });
}

// DELETE { clanMemberId } — remove a link this clan's admin made by hand. The stored id is cleared,
// so role sync stops giving that Discord account this member's roles. Roles it already holds in the
// server are not taken away here: remove them in Discord.
export async function DELETE(request: Request) {
  const clan = await requireClan();
  const actor = await handLinker();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { clanMemberId?: unknown } | null;
  const clanMemberId = Number(body?.clanMemberId);
  if (!Number.isInteger(clanMemberId)) return NextResponse.json({ error: 'clanMemberId is required' }, { status: 400 });

  const member = await seatInClan(clan.id, clanMemberId);
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // Only a link THIS clan made. Anything else stored on the character (a sign-in's id, another
  // clan's link) is not this clan's to clear.
  const [removed] = await db
    .update(accounts)
    .set(storedDiscordLink(null, null))
    .where(and(eq(accounts.id, member.accountId), eq(accounts.discordIdSource, 'admin'), eq(accounts.discordIdLinkedClanId, clan.id)))
    .returning({ id: accounts.id });
  if (!removed) return NextResponse.json({ error: 'This member has no link made by hand here.' }, { status: 409 });

  await db
    .insert(clanAuditLog)
    .values({
      clanId: clan.id,
      clanMemberId: member.id,
      eventType: 'discord_link_removed',
      actorUserId: actor.userId,
      oldValue: JSON.stringify({ rsn: member.rsn, source: 'admin' }),
      notes: `Hand-made Discord link removed from ${member.rsn}`,
    })
    .catch(() => {});
  return NextResponse.json({ success: true });
}

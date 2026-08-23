import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { clanRoster, users } from '@/db/schema';
import { findRosterSeat, seatInClan, updateAccountOfSeat } from '@/lib/roster';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { onCharacterLinked } from '@/lib/identity';
import { isGuildMember, syncRolesForClanMember } from '@/lib/discord-roles';

// POST { clanMemberId, discordUserId } — manually bind a clan member to a Discord user (for the
// stragglers auto-resolution can't reach). Validates the user is in the guild, caches the id on the
// member (and links the site user if one owns that Discord account), then syncs their roles.
export async function POST(request: Request) {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  const linkedUser = await db.query.users.findFirst({ where: eq(users.discordId, discordUserId) });

  // Associate the Discord account with the whole ACCOUNT, not just this row: every clan_member row
  // for this RSN (the self-report + drafted duplicates that otherwise leave a drafted player
  // unlinked) gets the id, plus the site user if one owns that Discord login. The picked row is
  // always updated (admin override); other same-RSN rows only when they aren't already linked to a
  // DIFFERENT user, so we never hijack someone else's account.
  await updateAccountOfSeat(clanMemberId, { discordId: discordUserId, ...(linkedUser && member.playerId == null ? { userId: linkedUser.id } : {}) });
  // Newly attached to an owner → adopt any guest sign-ups this character already had.
  if (linkedUser && member.playerId == null) await onCharacterLinked(clanMemberId, linkedUser.id);

  if (member.rsnNormalized) {
    const siblings = await db
      .select({ id: clanRoster.id, userId: clanRoster.playerId })
      .from(clanRoster)
      .where(and(eq(clanRoster.rsnNormalized, member.rsnNormalized), isNull(clanRoster.leftAt)));
    for (const row of siblings) {
      if (row.id === clanMemberId) continue;
      if (row.userId != null && (!linkedUser || row.userId !== linkedUser.id)) continue; // linked elsewhere — leave it
      await updateAccountOfSeat(row.id, { discordId: discordUserId, ...(linkedUser && row.userId == null ? { userId: linkedUser.id } : {}) });
      if (linkedUser && row.userId == null) await onCharacterLinked(row.id, linkedUser.id);
    }
  }

  // Assign roles only — do NOT rename them. The site RSN can be stale (renames) or an alt, so
  // clobbering their current Discord nick on a manual link is wrong (skipNickname = true).
  const report = await syncRolesForClanMember(clanMemberId, undefined, true);
  return NextResponse.json({ success: true, report });
}

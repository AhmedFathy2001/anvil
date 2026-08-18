import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { clanMembers, users } from '@/db/schema';
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

  const member = await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, clanMemberId) });
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
  await db
    .update(clanMembers)
    .set({ discordId: discordUserId, ...(linkedUser && member.userId == null ? { userId: linkedUser.id } : {}) })
    .where(eq(clanMembers.id, clanMemberId));
  // Newly attached to an owner → adopt any guest sign-ups this character already had.
  if (linkedUser && member.userId == null) await onCharacterLinked(clanMemberId, linkedUser.id);

  if (member.rsnNormalized) {
    const siblings = await db
      .select({ id: clanMembers.id, userId: clanMembers.userId })
      .from(clanMembers)
      .where(and(eq(clanMembers.rsnNormalized, member.rsnNormalized), isNull(clanMembers.leftAt)));
    for (const row of siblings) {
      if (row.id === clanMemberId) continue;
      if (row.userId != null && (!linkedUser || row.userId !== linkedUser.id)) continue; // linked elsewhere — leave it
      await db
        .update(clanMembers)
        .set({ discordId: discordUserId, ...(linkedUser && row.userId == null ? { userId: linkedUser.id } : {}) })
        .where(eq(clanMembers.id, row.id));
      if (linkedUser && row.userId == null) await onCharacterLinked(row.id, linkedUser.id);
    }
  }

  // Assign roles only — do NOT rename them. The site RSN can be stale (renames) or an alt, so
  // clobbering their current Discord nick on a manual link is wrong (skipNickname = true).
  const report = await syncRolesForClanMember(clanMemberId, undefined, true);
  return NextResponse.json({ success: true, report });
}

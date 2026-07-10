import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { isGuildMember, syncRolesForClanMember } from '@/lib/discord-roles';

// POST { clanMemberId, discordUserId } — manually bind a clan member to a Discord user (for the
// stragglers auto-resolution can't reach). Validates the user is in the guild, caches the id on the
// member (and links the site user if one owns that Discord account), then syncs their roles.
export async function POST(request: Request) {
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

  if (!(await isGuildMember(discordUserId))) {
    return NextResponse.json({ error: "That Discord user isn't in the server." }, { status: 400 });
  }

  // Cache the id; also link the site user if one already owns that Discord account and the member
  // isn't linked yet (so future resolution goes straight through the OAuth path).
  const linkedUser = await db.query.users.findFirst({ where: eq(users.discordId, discordUserId) });
  await db
    .update(clanMembers)
    .set({ discordId: discordUserId, ...(linkedUser && member.userId == null ? { userId: linkedUser.id } : {}) })
    .where(eq(clanMembers.id, clanMemberId));

  // Assign roles only — do NOT rename them. The site RSN can be stale (renames) or an alt, so
  // clobbering their current Discord nick on a manual link is wrong (skipNickname = true).
  const report = await syncRolesForClanMember(clanMemberId, undefined, true);
  return NextResponse.json({ success: true, report });
}

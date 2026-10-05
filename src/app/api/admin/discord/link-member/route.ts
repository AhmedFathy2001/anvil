import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { seatInClan, updateAccountOfSeat } from '@/lib/roster';
import { verifyAdmin } from '@/lib/auth';
import { isGuildMember, syncRolesForClanMember } from '@/lib/discord-roles';

// POST { clanMemberId, discordUserId } — point an UNCLAIMED roster entry at a Discord user (for the
// stragglers auto-resolution can't reach). Validates the user is in the guild, caches the id on the
// entry, then syncs their roles. Never links a site login — that is the player's own act.
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

  // ONLY an entry nobody has claimed. The Discord id here is a name-match cache that lets role sync
  // reach a roster straggler; once a player owns the character, their own Discord login is the
  // answer, and a clan overwriting it (or, as this used to try, attaching a site login to it) would be
  // one clan deciding who that person is everywhere. Those go to Anvil (lib/characterReports).
  if (member.claimedAt != null) {
    return NextResponse.json(
      {
        error: 'This character belongs to a player, so their Discord comes from their own login. Report it to Anvil if it is wrong.',
        code: 'reportToAnvil',
      },
      { status: 403 },
    );
  }
  await updateAccountOfSeat(clanMemberId, { discordId: discordUserId });

  // Assign roles only — do NOT rename them. The site RSN can be stale (renames) or an alt, so
  // clobbering their current Discord nick on a manual link is wrong (skipNickname = true).
  const report = await syncRolesForClanMember(clanMemberId, undefined, true);
  return NextResponse.json({ success: true, report });
}

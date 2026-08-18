import { NextResponse } from 'next/server';
import { db } from '@/db';
import { eventParticipants, clanRoster } from '@/db/schema';
import { findRosterSeat } from '@/lib/roster';
import { and, eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';

// Lists the RuneScape accounts (clan members) linked to the SAME Discord owner as this player's
// current account — the candidates an admin can swap the player's tracked account to (e.g. when an
// RSN gets banned and they play on an alt). Admin only.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; playerId: string }> },
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId, playerId } = await params;
  const eId = parseInt(eventId, 10);
  const pId = parseInt(playerId, 10);

  const player = await db.query.eventParticipants.findFirst({
    where: and(eq(eventParticipants.id, pId), eq(eventParticipants.eventId, eId)),
  });
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const current = player.clanMemberId != null
    ? await findRosterSeat(eq(clanRoster.id, player.clanMemberId))
    : null;

  // Every RSN owned by the same Discord user is a swap candidate. Ghost accounts (no userId) have
  // no owner to gather siblings from, so only their own row is offered.
  const ownerUserId = current?.playerId ?? null;
  let members = ownerUserId != null
    ? await db.select().from(clanRoster).where(eq(clanRoster.playerId, ownerUserId))
    : current
      ? [current]
      : [];

  // Keep the currently-linked account in the list even if it somehow isn't in the owner's set.
  if (current && !members.some((m) => m.id === current.id)) {
    members = [current, ...members];
  }

  const accounts = members
    .map((m) => ({
      clanMemberId: m.id,
      rsn: m.rsn,
      status: m.status,
      isCurrent: m.id === player.clanMemberId,
    }))
    // Show the current account first, then the rest alphabetically.
    .sort((a, b) => (a.isCurrent ? -1 : b.isCurrent ? 1 : a.rsn.localeCompare(b.rsn)));

  return NextResponse.json({ accounts, ownerUserId });
}

import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { eventParticipants, clanRoster } from '@/db/schema';
import { findRosterSeat } from '@/lib/roster';
import { acceptedCohostClanIds } from '@/lib/coHost';
import { accountChoices } from '@/lib/accountChoices';
import { and, eq, inArray } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';

/**
 * The characters this player could be tracked as instead — one entry per CHARACTER.
 *
 * TWO BUGS LIVED HERE, and they are the same bug twice: `clan_roster` is a SEAT view, meaning
 * (account × clan), and this read treated a seat as a character.
 *
 *   1. DUPLICATES. Somebody who plays two accounts and is a member of one clan while guesting in
 *      the clan hosting the board holds four seats — two accounts × two clans — so the dropdown
 *      offered "Alt, Main, Alt, Main". Each name twice, one of the pair marked "current", and
 *      nothing on screen to say why there were two or which to pick.
 *
 *   2. SEATS THE SWAP WOULD REFUSE. The query had no clan filter at all, so it offered seats in
 *      every clan on the platform. The PATCH that performs the swap scopes to the host plus its
 *      accepted co-hosts, so choosing one of those answered "Account not found" — an option that
 *      exists only to fail.
 *
 * So: narrow to the clans this board can legitimately seat somebody from, then fold the seats down
 * to one row per account. The seat id is still what goes back, because that is what the swap takes;
 * the one chosen is the current seat where there is one, else a seat in the host's own clan, so a
 * swap moves the character being tracked without also moving which clan's seat the row hangs off.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string; playerId: string }> },
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId, playerId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  const scopedEvent = await eventForRequest(request, eId);
  if (!scopedEvent) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const pId = parseInt(playerId, 10);

  const player = await db.query.eventParticipants.findFirst({
    where: and(eq(eventParticipants.id, pId), eq(eventParticipants.eventId, eId)),
  });
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const current = player.clanMemberId != null
    // clan-scope: global -- the id came from a row this request already established, so the clan is settled upstream.
    ? await findRosterSeat(eq(clanRoster.id, player.clanMemberId))
    : null;

  // Exactly the set the swap will accept — see the PATCH in ../../players. Offering anything else
  // is offering a choice that errors.
  const seatClans = [scopedEvent.clanId, ...(await acceptedCohostClanIds(eId))];

  // Every seat this person holds, in those clans. Ghost accounts (no owner) have no siblings to
  // gather, so only their own row is offered.
  const ownerPlayerId = current?.playerId ?? null;
  let seats = ownerPlayerId != null
    ? await db
        .select()
        .from(clanRoster)
        .where(and(eq(clanRoster.playerId, ownerPlayerId), inArray(clanRoster.clanId, seatClans)))
    : current
      ? [current]
      : [];

  // The seat they are on now stays offered even if it sits outside that set — a board can carry a
  // player seated before a co-host was removed, and hiding their current account would read as
  // though it had been taken away.
  if (current && !seats.some((m) => m.id === current.id)) {
    seats = [current, ...seats];
  }

  // ONE ROW PER CHARACTER. Two seats for one character is a fact about clan membership and has
  // nothing to say about which character to follow, so it must not reach the dropdown. The rule
  // lives in lib/accountChoices so it can be tested without a database.
  const accounts = accountChoices(seats, {
    currentSeatId: player.clanMemberId,
    eventClanId: scopedEvent.clanId,
  });

  return NextResponse.json({ accounts, ownerUserId: ownerPlayerId });
}

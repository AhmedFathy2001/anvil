import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { clanRoster, eventSignups, eventParticipants, teams } from '@/db/schema';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { verifyAdmin, generatePlayerToken } from '@/lib/auth';
import { onAccountConflict } from '@/lib/participants';
import { assertEventEditable } from '@/lib/eventLock';

// Bulk: turn every still-eligible signup into a draft pool entry. Captains already have
// player rows on their teams (created by promote-captain) — those are skipped.
//
// "Eligible" = pending or approved status. Withdrawn/rejected are skipped.
//
// Idempotent: a signup whose clanMemberId already has a players row in this event is
// skipped (so re-running this after adding a few latecomers Just Works).
//
// Returns the count of new player rows created.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }

  const { eventId } = await params;
  const evtId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, evtId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // A finished event's roster is part of its recorded result. Adding a player to one changes team
  // composition after the fact — and `settlementForEvent` derives each clan's fees from participant
  // counts, so on a co-hosted board it moves money. The lock's own docs list "players" as covered;
  // these three routes create them and were never asked.
  const locked = await assertEventEditable(evtId);
  if (locked) return locked;
  if (!Number.isFinite(evtId)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  // Eligible signups (status in pending/approved).
  const eligible = await db
    .select()
    .from(eventSignups)
    .where(
      and(
        eq(eventSignups.eventId, evtId),
        or(eq(eventSignups.status, 'pending'), eq(eventSignups.status, 'approved')),
      ),
    );

  if (eligible.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0, captains: 0 });
  }

  // WHO IS ALREADY ON THIS BOARD — by seat, by account AND by person.
  //
  // Keyed on the seat alone this skipped nobody whose character had been swapped: an admin can
  // re-point a player row at another of somebody's characters, and the sign-up keeps the seat it
  // was made on. The two then disagree, this set does not contain the sign-up's seat, and the
  // promotion inserts a SECOND row for a player who is already drafted — the account index cannot
  // refuse it either, because the row being inserted carries the account they SIGNED UP with while
  // the row already there carries the one they were swapped to. Two rows, two stat gains, two fees.
  const existingPlayers = await db
    .select({ clanMemberId: eventParticipants.clanMemberId })
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, evtId), isNull(eventParticipants.teamId)));
  const enrolledRows = await db
    .select({
      clanMemberId: eventParticipants.clanMemberId,
      accountId: eventParticipants.accountId,
      personId: clanRoster.playerId,
    })
    .from(eventParticipants)
    // clan-scope: this clan -- the driving query is already narrowed to this event's participants.
    .leftJoin(clanRoster, eq(eventParticipants.clanMemberId, clanRoster.id))
    .where(eq(eventParticipants.eventId, evtId));
  const enrolledSeats = new Set(enrolledRows.map((p) => p.clanMemberId).filter((id): id is number => id !== null));
  const enrolledAccounts = new Set(enrolledRows.map((p) => p.accountId).filter((id): id is number => id !== null));
  const enrolledPeople = new Set(enrolledRows.map((p) => p.personId).filter((id): id is number => id !== null));

  // Captains have teams in this event — those signups are already represented on the roster.
  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, evtId));
  const captainUserIds = new Set(
    eventTeams.map((t) => t.captainUserId).filter((id): id is number => id !== null),
  );

  // The seats the eligible sign-ups sit on, so a sign-up can be asked about its account and the
  // human behind it rather than only about the seat id it happens to carry.
  const eligibleSeats = await db
    .select({ id: clanRoster.id, accountId: clanRoster.accountId, personId: clanRoster.playerId })
    .from(clanRoster)
    // clan-scope: global -- the ids come from sign-ups on an event this request has already scoped.
    .where(inArray(clanRoster.id, eligible.map((s) => s.clanMemberId)));
  const seatFacts = new Map(eligibleSeats.map((m) => [m.id, m]));

  const toInsertSignups = eligible.filter((s) => {
    if (s.userId != null && captainUserIds.has(s.userId)) return false;
    if (enrolledSeats.has(s.clanMemberId)) return false;
    const facts = seatFacts.get(s.clanMemberId);
    if (facts?.accountId != null && enrolledAccounts.has(facts.accountId)) return false;
    // Last: the person. This is what a swapped character is still recognisable by, since swapping
    // a character does not change who is playing.
    if (facts?.personId != null && enrolledPeople.has(facts.personId)) return false;
    return true;
  });

  if (toInsertSignups.length === 0) {
    return NextResponse.json({
      created: 0,
      skipped: eligible.length - existingPlayers.length,
      captains: captainUserIds.size,
    });
  }

  // Batch-load the clanRoster rows for display names.
  const memberIds = toInsertSignups.map((s) => s.clanMemberId);
  // clan-scope: global -- the id came from a row this request already established, so the clan is settled upstream.
  const memberRows = await db
    .select()
    .from(clanRoster)
    .where(inArray(clanRoster.id, memberIds));
  const memberById = new Map(memberRows.map((m) => [m.id, m]));

  const inserts = toInsertSignups
    .map((s) => {
      const member = memberById.get(s.clanMemberId);
      if (!member) return null;
      return {
        eventId: evtId,
        clanMemberId: member.id,
        // The board is keyed by account, not by seat — see lib/participants.
        accountId: member.accountId,
        name: member.rsn,
        playerToken: generatePlayerToken(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  let created = 0;
  if (inserts.length > 0) {
    // Anyone the index refuses is already on this board under another seat, which is the answer this
    // promotion wanted anyway — so it is not counted as created, and not treated as a failure.
    const inserted = await db
      .insert(eventParticipants)
      .values(inserts)
      .onConflictDoNothing(onAccountConflict)
      .returning();
    created = inserted.length;
  }

  // Bump status to 'approved' for any pending signups that got pulled in (matches what
  // captains already get when promoted).
  const pendingIds = toInsertSignups
    .filter((s) => s.status === 'pending')
    .map((s) => s.id);
  if (pendingIds.length > 0) {
    await db
      .update(eventSignups)
      .set({ status: 'approved', updatedAt: new Date().toISOString() })
      .where(inArray(eventSignups.id, pendingIds));
  }

  return NextResponse.json({
    created,
    skipped: eligible.length - toInsertSignups.length,
    captains: captainUserIds.size,
  });
}

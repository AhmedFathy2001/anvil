import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, eventSignups, players, teams } from '@/db/schema';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { verifyAdmin, generatePlayerToken } from '@/lib/auth';

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
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }

  const { eventId } = await params;
  const evtId = parseInt(eventId, 10);
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

  // Existing player rows in this event keyed by clanMemberId so we know who to skip.
  const existingPlayers = await db
    .select({ clanMemberId: players.clanMemberId })
    .from(players)
    .where(and(eq(players.eventId, evtId), isNull(players.teamId)));
  const captainPlayers = await db
    .select({ clanMemberId: players.clanMemberId })
    .from(players)
    .where(eq(players.eventId, evtId));
  const allEnrolledClanIds = new Set(
    captainPlayers.map((p) => p.clanMemberId).filter((id): id is number => id !== null),
  );

  // Captains have teams in this event — those signups are already represented on the roster.
  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, evtId));
  const captainUserIds = new Set(
    eventTeams.map((t) => t.captainUserId).filter((id): id is number => id !== null),
  );

  const toInsertSignups = eligible.filter((s) => {
    if (captainUserIds.has(s.userId)) return false;
    if (allEnrolledClanIds.has(s.clanMemberId)) return false;
    return true;
  });

  if (toInsertSignups.length === 0) {
    return NextResponse.json({
      created: 0,
      skipped: eligible.length - existingPlayers.length,
      captains: captainUserIds.size,
    });
  }

  // Batch-load the clanMembers rows for display names.
  const memberIds = toInsertSignups.map((s) => s.clanMemberId);
  const memberRows = await db
    .select()
    .from(clanMembers)
    .where(inArray(clanMembers.id, memberIds));
  const memberById = new Map(memberRows.map((m) => [m.id, m]));

  const inserts = toInsertSignups
    .map((s) => {
      const member = memberById.get(s.clanMemberId);
      if (!member) return null;
      return {
        eventId: evtId,
        clanMemberId: member.id,
        name: member.rsn,
        playerToken: generatePlayerToken(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  let created = 0;
  if (inserts.length > 0) {
    const inserted = await db.insert(players).values(inserts).returning();
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

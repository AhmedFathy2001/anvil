import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, eventSignups, players, teams } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { generatePlayerToken } from '@/lib/auth';

// Per-signup admin actions. All admin-only — captain selection is high-stakes and we
// don't want a moderator accidentally locking the wrong person in.
//
// Actions:
//   approve         → status = 'approved'
//   reject          → status = 'rejected'
//   promote-captain → create a team with captainUserId = signup.userId, and a players
//                     row for the captain on that team. Idempotent: re-running upgrades
//                     the existing assignment if the user already has a team.
//   demote-captain  → strip captain status, delete that captain's team if empty.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; signupId: string }> },
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }

  const { eventId, signupId } = await params;
  const evtId = parseInt(eventId, 10);
  const sigId = parseInt(signupId, 10);
  if (!Number.isFinite(evtId) || !Number.isFinite(sigId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: 'approve' | 'reject' | 'promote-captain' | 'demote-captain';
    teamName?: string;
    teamColor?: string;
  } | null;
  if (!body || !body.action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }

  const signup = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.id, sigId), eq(eventSignups.eventId, evtId)),
  });
  if (!signup) {
    return NextResponse.json({ error: 'Signup not found' }, { status: 404 });
  }

  const now = new Date().toISOString();

  switch (body.action) {
    case 'approve': {
      const [updated] = await db
        .update(eventSignups)
        .set({ status: 'approved', updatedAt: now })
        .where(eq(eventSignups.id, sigId))
        .returning();
      return NextResponse.json({ signup: updated });
    }

    case 'reject': {
      const [updated] = await db
        .update(eventSignups)
        .set({ status: 'rejected', updatedAt: now })
        .where(eq(eventSignups.id, sigId))
        .returning();
      return NextResponse.json({ signup: updated });
    }

    case 'promote-captain': {
      if (!body.teamName || typeof body.teamName !== 'string' || !body.teamName.trim()) {
        return NextResponse.json({ error: 'teamName is required' }, { status: 400 });
      }
      if (!body.teamColor || typeof body.teamColor !== 'string') {
        return NextResponse.json({ error: 'teamColor is required' }, { status: 400 });
      }
      if (signup.status === 'withdrawn' || signup.status === 'rejected') {
        return NextResponse.json(
          { error: 'Cannot promote a withdrawn or rejected sign-up' },
          { status: 400 },
        );
      }

      // Refuse if this user already captains a team in this event — they'd accidentally
      // get duplicated. The admin should demote first if they want to re-seat them.
      const existingCaptain = await db.query.teams.findFirst({
        where: and(eq(teams.eventId, evtId), eq(teams.captainUserId, signup.userId)),
      });
      if (existingCaptain) {
        return NextResponse.json(
          {
            error: 'User already captains a team in this event',
            teamId: existingCaptain.id,
          },
          { status: 409 },
        );
      }

      const account = await db.query.clanMembers.findFirst({
        where: eq(clanMembers.id, signup.clanMemberId),
      });
      if (!account) {
        return NextResponse.json(
          { error: "Captain's chosen account no longer exists" },
          { status: 400 },
        );
      }

      // Create the team and seat the captain on it as their own first pick. Pre-existing
      // player rows for the same clanMemberId are reused so we don't double-up the roster.
      const [team] = await db
        .insert(teams)
        .values({
          eventId: evtId,
          name: body.teamName.trim(),
          color: body.teamColor,
          captainUserId: signup.userId,
        })
        .returning();

      const existingPlayer = await db.query.players.findFirst({
        where: and(eq(players.eventId, evtId), eq(players.clanMemberId, signup.clanMemberId)),
      });
      if (existingPlayer) {
        await db
          .update(players)
          .set({ teamId: team.id, pickNumber: 0, pickedAt: now })
          .where(eq(players.id, existingPlayer.id));
      } else {
        await db.insert(players).values({
          eventId: evtId,
          clanMemberId: signup.clanMemberId,
          name: account.rsn,
          teamId: team.id,
          pickNumber: 0,
          pickedAt: now,
          playerToken: generatePlayerToken(),
        });
      }

      const [updated] = await db
        .update(eventSignups)
        .set({ status: 'approved', updatedAt: now })
        .where(eq(eventSignups.id, sigId))
        .returning();

      return NextResponse.json({ signup: updated, team });
    }

    case 'demote-captain': {
      const captainTeam = await db.query.teams.findFirst({
        where: and(eq(teams.eventId, evtId), eq(teams.captainUserId, signup.userId)),
      });
      if (!captainTeam) {
        return NextResponse.json(
          { error: 'This sign-up is not currently a captain' },
          { status: 400 },
        );
      }

      // Yank the captain's player row off the team so the team is genuinely "empty"
      // before we try to delete it. If other players have been drafted to this team
      // already, refuse — wholesale undoing draft results is a separate, riskier action.
      const teamPlayers = await db
        .select()
        .from(players)
        .where(eq(players.teamId, captainTeam.id));
      const onlyCaptain =
        teamPlayers.length <= 1 &&
        (teamPlayers.length === 0 ||
          teamPlayers[0].clanMemberId === signup.clanMemberId);
      if (!onlyCaptain) {
        return NextResponse.json(
          { error: 'Team has other players drafted; reset the draft before demoting.' },
          { status: 409 },
        );
      }

      // Reset the captain's player row back to the pool (keep the row so re-promotion
      // doesn't re-issue a new token).
      const captainPlayer = teamPlayers.find(
        (p) => p.clanMemberId === signup.clanMemberId,
      );
      if (captainPlayer) {
        await db
          .update(players)
          .set({ teamId: null, pickNumber: null, pickedAt: null })
          .where(eq(players.id, captainPlayer.id));
      }

      await db.delete(teams).where(eq(teams.id, captainTeam.id));

      return NextResponse.json({ signup, removedTeamId: captainTeam.id });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

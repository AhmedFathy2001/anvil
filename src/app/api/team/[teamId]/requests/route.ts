import { NextResponse } from 'next/server';
import { findRosterSeat } from '@/lib/roster';
import { db } from '@/db';
import { clanRoster, eventSignups, players, users, eventParticipants } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { generatePlayerToken } from '@/lib/auth';
import { requireTeamManager } from '@/lib/teamStaff';
import { enrolParticipant, participantForSeat } from '@/lib/participants';
import { parseProfile } from '@/lib/signup';

/**
 * People asking to join THIS team, on an event the host runs by application (rules.teamChoice).
 *
 * The alternative to a draft and to invite links: the teams exist up front, sign-ups stay open to
 * everyone, and each applicant names the team they're joining. That request has to be answered by
 * someone, and the person who actually knows whether they want them is the captain — so this is the
 * same team-staff surface as the roster, not an admin queue. The host can still answer it from the
 * Sign-ups tab; whoever gets there first wins, and the other side sees the request disappear.
 *
 * Declining does NOT reject them from the event. It clears the team they asked for and leaves the
 * sign-up pending, so they're still a player the host can place — a captain saying "not for my
 * team" isn't a captain deciding who plays.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const tId = parseInt(teamId, 10);
  if (!Number.isFinite(tId)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });

  const guard = await requireTeamManager(tId);
  if ('response' in guard) return guard.response;

  // clan-scope: global -- reached through team membership or a token, not through a clan — that is what lets a visiting clan's people use it.
  const rows = await db
    .select({
      id: eventSignups.id,
      status: eventSignups.status,
      signedUpAt: eventSignups.signedUpAt,
      profileData: eventSignups.profileData,
      rsn: clanRoster.rsn,
      displayName: users.displayName,
    })
    .from(eventSignups)
    .innerJoin(clanRoster, eq(eventSignups.clanMemberId, clanRoster.id))
    .leftJoin(users, eq(eventSignups.userId, users.id))
    .where(and(eq(eventSignups.requestedTeamId, tId), eq(eventSignups.status, 'pending')));

  return NextResponse.json({
    requests: rows.map((r) => ({
      id: r.id,
      rsn: r.rsn,
      displayName: r.displayName,
      signedUpAt: r.signedUpAt,
      profile: parseProfile(r.profileData),
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const tId = parseInt(teamId, 10);
  if (!Number.isFinite(tId)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });

  const guard = await requireTeamManager(tId);
  if ('response' in guard) return guard.response;
  const { management } = guard;

  const body = (await request.json().catch(() => null)) as {
    signupId?: unknown;
    action?: unknown;
  } | null;
  const signupId = Number(body?.signupId);
  const action = body?.action;
  if (!Number.isFinite(signupId) || (action !== 'approve' && action !== 'decline')) {
    return NextResponse.json({ error: 'signupId and action (approve|decline) are required' }, { status: 400 });
  }

  // Re-read the request rather than trusting the id: this must only ever touch a sign-up that
  // asked for THIS team, or a captain could approve their way through somebody else's queue.
  const signup = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.id, signupId), eq(eventSignups.requestedTeamId, tId)),
  });
  if (!signup || signup.eventId !== management.eventId) {
    return NextResponse.json({ error: 'That request is no longer open.' }, { status: 404 });
  }
  if (signup.status !== 'pending') {
    return NextResponse.json({ error: `That sign-up is already ${signup.status}.` }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (action === 'decline') {
    await db
      .update(eventSignups)
      .set({ requestedTeamId: null, updatedAt: now })
      .where(eq(eventSignups.id, signup.id));
    return NextResponse.json({ ok: true, action: 'decline' });
  }

  await db
    .update(eventSignups)
    .set({ status: 'approved', updatedAt: now })
    .where(eq(eventSignups.id, signup.id));

  // Seat them. Same rule as the admin approve path: create the player row on this team, or move a
  // pooled one onto it. Someone already on another team is left where they are — that placement
  // was a decision too, and undoing it isn't this captain's call.
  // By ACCOUNT, not by seat: the same player can hold a seat in their own clan and a guest seat in
  // the host's, and asking by seat would find neither and enrol them twice. See lib/participants.
  const existingPlayer = await participantForSeat(signup.eventId, signup.clanMemberId);
  if (!existingPlayer) {
    // clan_roster is a VIEW, so it is not in db.query (Drizzle's relational API needs a table).
    // clan-scope: global -- the id came from a row this request already established, so the clan is settled upstream.
    const account = await findRosterSeat(eq(clanRoster.id, signup.clanMemberId));
    await enrolParticipant({
      eventId: signup.eventId,
      clanMemberId: signup.clanMemberId,
      accountId: account?.accountId ?? null,
      name: account?.rsn ?? 'Unknown',
      teamId: tId,
      playerToken: generatePlayerToken(),
    });
  } else if (existingPlayer.teamId == null) {
    await db.update(eventParticipants).set({ teamId: tId }).where(eq(eventParticipants.id, existingPlayer.id));
  }

  return NextResponse.json({ ok: true, action: 'approve' });
}

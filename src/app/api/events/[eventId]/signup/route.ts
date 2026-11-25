import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { eventSignups, events, signupFees, teams } from '@/db/schema';
import { signupSeatsFor } from '@/lib/eventSeats';
import { and, eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { parseProfile, signupWindowState } from '@/lib/signup';
import { parseEventRules } from '@/lib/eventRules';
import { isTeamFull, placementOf } from '@/lib/teamPlacement';
import { teamLoads } from '@/lib/teamPlacementDb';
import { friendsHostOfEvent } from '@/lib/friendEvents';
import { refusePractice } from '@/lib/practiceGuard';
import { submitEventSignup, withdrawEventSignup, type SignupBody } from '@/lib/eventSignupSubmit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  // A practice board (lib/practice) has none of this (lib/practiceGuard).
  const practiceRefused = await refusePractice(params);
  if (practiceRefused) return practiceRefused;
  const session = await verifyUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  // A friends host's undated event is open to its invite link's people (lib/signup signupWindowState).
  const friendsKind = event && (await friendsHostOfEvent(event.id)) != null ? 'friends' : null;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Verified, currently-in-clan accounts the user owns. Unverified accounts can't be
  // used to sign up — verification is the gate that proves "this user controls this RSN".
  //
  // The event's own clan, or a clan co-hosting it (lib/eventSeats). Never any other clan the person
  // happens to sit in: that would put a foreign seat into this event's sign-ups and onto its board.
  // Entering another clan's event is a real thing, but it goes through admission and gets a seat
  // HERE first; it is not done by naming a seat that belongs somewhere else.
  const myAccounts = session.playerId == null
    ? []
    : (await signupSeatsFor(event, session.playerId)).map((a) => ({
        id: a.id,
        rsn: a.rsn,
        isPrimary: a.isPrimary,
        verifiedAt: a.verifiedAt,
        verificationMethod: a.verificationMethod,
        provisional: a.provisional,
      }));

  // Existing signup for this user/event (if any).
  const signup = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.eventId, id), eq(eventSignups.userId, session.userId)),
  });

  const fee = signup
    ? await db.query.signupFees.findFirst({ where: eq(signupFees.signupId, signup.id) })
    : null;

  // Prefill from the user's most recent prior signup (different event), so a returning
  // signup-form view shows their last answers as the starting point. Only computed when
  // the user hasn't already submitted for THIS event.
  let prefill: { clanMemberId: number | null; profile: ReturnType<typeof parseProfile> } | null =
    null;
  if (!signup) {
    const prior = await db.query.eventSignups.findFirst({
      where: eq(eventSignups.userId, session.userId),
      orderBy: (s, { desc }) => [desc(s.signedUpAt)],
    });
    if (prior) {
      prefill = {
        clanMemberId: prior.clanMemberId,
        profile: parseProfile(prior.profileData),
      };
    }
  }

  const window = signupWindowState({
    signupOpensAt: event.signupOpensAt,
    signupDeadline: event.signupDeadline,
    startDate: event.startDate,
    signupsEnabled: event.signupsEnabled,
    hostKind: friendsKind,
  });

  // Team-choice events (rules.teamChoice): the host built the teams up front and applicants name
  // the one they're joining. Sent only when the rule is on, so a drafted event's form is unchanged.
  //
  // Players-pick boards (teamPlacement 'pick', lib/teamPlacement) send the same list, with how full
  // each team is against the host's cap, because there the choice seats them immediately.
  const rules = parseEventRules(event.rules);
  const placement = placementOf(event);
  const choosableTeams =
    placement === 'pick'
      ? await teamLoads(id).then((ls) => ls.map((t) => ({ id: t.id, name: t.name, color: t.color ?? '', size: t.size, full: isTeamFull(t, event.teamCap, ls) })))
      : rules.teamChoice
        ? await db
            .select({ id: teams.id, name: teams.name, color: teams.color })
            .from(teams)
            .where(eq(teams.eventId, id))
            .orderBy(teams.name)
        : [];

  return NextResponse.json({
    teamChoice: rules.teamChoice || placement === 'pick',
    placement,
    teamCap: event.teamCap,
    teams: choosableTeams,
    event: {
      id: event.id,
      name: event.name,
      signupFee: event.signupFee,
      signupOpensAt: event.signupOpensAt,
      signupDeadline: event.signupDeadline,
      captainSelectionDeadline: event.captainSelectionDeadline,
      startDate: event.startDate,
    },
    window,
    myAccounts,
    signup: signup
      ? {
          ...signup,
          profile: parseProfile(signup.profileData),
        }
      : null,
    fee,
    prefill,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  // A practice board (lib/practice) has none of this (lib/practiceGuard).
  const practiceRefused = await refusePractice(params);
  if (practiceRefused) return practiceRefused;
  const rl = await rateLimit(request, 'signup', { limit: 20, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });

  const session = await verifyUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as SignupBody;

  return submitEventSignup(session, id, body);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  // A practice board (lib/practice) has none of this (lib/practiceGuard).
  const practiceRefused = await refusePractice(params);
  if (practiceRefused) return practiceRefused;
  const session = await verifyUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  return withdrawEventSignup(session, id);
}

import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { clanAuditLog, clanRoster, events, eventSignups, eventParticipants, signupFees, teams, users } from '@/db/schema';
import { findRosterSeat } from '@/lib/roster';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { generatePlayerToken } from '@/lib/auth';
import { sanitizeProfile, serializeProfile } from '@/lib/signup';
import { notifySignupApproved } from '@/lib/discord';

// Per-signup admin actions. All admin-only — captain selection is high-stakes and we
// don't want a moderator accidentally locking the wrong person in.
//
// Actions:
//   approve         → status = 'approved'
//   reject          → status = 'rejected'
//   withdraw        → status = 'withdrawn'. The manual "remove from the event" action for
//                     when a player who already paid asks to drop (self-withdraw is blocked
//                     for them). Clears an untouched fee; keeps a paid one for the refund
//                     trail. Removes them from the draft pool if not yet on a team.
//   promote-captain → create a team with captainUserId = signup.userId, and a players
//                     row for the captain on that team. Idempotent: re-running upgrades
//                     the existing assignment if the user already has a team.
//   demote-captain  → strip captain status, delete that captain's team if empty.
//   edit-answers    → overwrite profileData with the supplied profile. The admin escape
//                     hatch for "they told me on Discord" — no window check, unlike the
//                     member's own edit flow.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; signupId: string }> },
) {
  const clan = await requireClan();
  const session = await verifyUser();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }

  const { eventId, signupId } = await params;
  const evtId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, evtId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const sigId = parseInt(signupId, 10);
  if (!Number.isFinite(evtId) || !Number.isFinite(sigId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: 'approve' | 'reject' | 'withdraw' | 'promote-captain' | 'demote-captain' | 'edit-answers' | 'set-prize-exclusion';
    teamName?: string;
    teamColor?: string;
    profile?: Record<string, unknown>;
    excludeFromPrizePool?: boolean;
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

  // Audit trail: record who did the sign-up action against the member's history so the
  // dashboard/audit feed can name names. Fire-and-forget — a logging hiccup must not block
  // the action itself.
  const logAction = (eventType: string, extra?: Record<string, unknown>) => {
    db.insert(clanAuditLog)
      .values({
        clanMemberId: signup.clanMemberId,
        eventType,
        newValue: JSON.stringify({ eventId: evtId, signupId: sigId, ...extra }),
        actorUserId: session.userId > 0 ? session.userId : null,
      })
      .catch(() => {});
  };

  switch (body.action) {
    case 'approve': {
      const [updated] = await db
        .update(eventSignups)
        .set({ status: 'approved', updatedAt: now })
        .where(eq(eventSignups.id, sigId))
        .returning();
      logAction('signup_approved');

      // Approving = eligible for the draft, so make sure they're in the player pool. Idempotent —
      // skips if a player row already exists (self-serve signup / admin-on-behalf already added
      // one). This is what keeps "approved sign-ups" and "the draft pool" consistent.
      const existingPlayer = await db.query.eventParticipants.findFirst({
        where: and(eq(eventParticipants.eventId, evtId), eq(eventParticipants.clanMemberId, signup.clanMemberId)),
      });
      if (!existingPlayer) {
        const account = await findRosterSeat(eq(clanRoster.id, signup.clanMemberId));
        let timezone: string | null = null;
        try {
          const p = JSON.parse(signup.profileData) as { timezone?: unknown };
          if (typeof p?.timezone === 'string') timezone = p.timezone;
        } catch {
          /* profileData not JSON — leave timezone null */
        }
        await db.insert(eventParticipants).values({
          eventId: evtId,
          clanMemberId: signup.clanMemberId,
          name: account?.rsn ?? 'Unknown',
          timezone,
          playerToken: generatePlayerToken(),
        }); // teamId defaults null → lands in the pool, draftable/assignable
      }

      // Nudge the approved member to pay their fee (incentive to convert + stay active).
      // Only on a real transition into 'approved' — re-approving an already-approved sign-up
      // shouldn't re-ping. Fire-and-forget: gather the post's data, then post without blocking
      // the response; a missing/unconfigured webhook just no-ops, and a Discord hiccup never
      // fails approval.
      if (signup.status !== 'approved') void (async () => {
        try {
          const [event, user, account, fee] = await Promise.all([
            db.query.events.findFirst({ where: eq(events.id, evtId) }),
            // Guest sign-ups have no user — no one to ping, so this stays null.
            signup.userId != null
              ? db.query.users.findFirst({ where: eq(users.id, signup.userId) })
              : Promise.resolve(undefined),
            findRosterSeat(eq(clanRoster.id, signup.clanMemberId)),
            db.query.signupFees.findFirst({ where: eq(signupFees.signupId, sigId) }),
          ]);
          if (!event) return;
          await notifySignupApproved({
            clanId: clan.id,
            eventId: evtId,
            eventName: event.name,
            displayName: user?.displayName ?? account?.rsn ?? 'A member',
            discordId: user?.discordId ?? null,
            rsn: account?.rsn ?? '—',
            feeAmount: event.signupFee ?? null,
            feeAlreadyPaid: fee?.status === 'collected' || fee?.status === 'confirmed',
          });
        } catch {
          /* fire-and-forget */
        }
      })();

      return NextResponse.json({ signup: updated });
    }

    case 'set-prize-exclusion': {
      // Toggle whether this sign-up counts toward the entry-fee prize pool. For non-paying entries
      // (a sub-in replacing someone who already paid, a comped player) so the pool reflects real money.
      const exclude = body.excludeFromPrizePool === true;
      const [updated] = await db
        .update(eventSignups)
        .set({ excludeFromPrizePool: exclude, updatedAt: now })
        .where(eq(eventSignups.id, sigId))
        .returning();
      logAction('signup_prize_exclusion', { excluded: exclude });
      return NextResponse.json({ signup: updated });
    }

    case 'reject': {
      const [updated] = await db
        .update(eventSignups)
        .set({ status: 'rejected', updatedAt: now })
        .where(eq(eventSignups.id, sigId))
        .returning();
      logAction('signup_rejected');
      return NextResponse.json({ signup: updated });
    }

    case 'withdraw': {
      // Don't strand a team without its captain — make the admin demote first. (A guest with
      // no user can't be a captain, so skip the check.)
      const captainTeam = signup.userId == null
        ? undefined
        : await db.query.teams.findFirst({
            where: and(eq(teams.eventId, evtId), eq(teams.captainUserId, signup.userId)),
          });
      if (captainTeam) {
        return NextResponse.json(
          { error: 'This sign-up captains a team — demote them first.' },
          { status: 409 },
        );
      }

      const [updated] = await db
        .update(eventSignups)
        .set({ status: 'withdrawn', updatedAt: now })
        .where(eq(eventSignups.id, sigId))
        .returning();

      // Clear an untouched fee request; keep one with payment activity so the refund
      // stays on the books.
      const fee = await db.query.signupFees.findFirst({
        where: eq(signupFees.signupId, sigId),
      });
      if (fee && fee.status === 'pending') {
        await db.delete(signupFees).where(eq(signupFees.id, fee.id));
      }

      // Remove from the draft pool if they aren't already drafted onto a team.
      await db
        .delete(eventParticipants)
        .where(
          and(
            eq(eventParticipants.eventId, evtId),
            eq(eventParticipants.clanMemberId, signup.clanMemberId),
            isNull(eventParticipants.teamId),
          ),
        );

      logAction('signup_withdrawn', { by: 'admin' });
      return NextResponse.json({ signup: updated });
    }

    case 'promote-captain': {
      // A captain logs in to run their draft, so they must have a linked account. A guest
      // sign-up (no user) can't be one until they link their Discord.
      if (signup.userId == null) {
        return NextResponse.json(
          { error: 'This is a guest sign-up with no linked Discord account — they must log in before they can captain a team.' },
          { status: 400 },
        );
      }
      const captainUserId = signup.userId; // narrowed to number by the guard above
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
        where: and(eq(teams.eventId, evtId), eq(teams.captainUserId, captainUserId)),
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

      const account = await findRosterSeat(eq(clanRoster.id, signup.clanMemberId));
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
          captainUserId,
        })
        .returning();

      const existingPlayer = await db.query.eventParticipants.findFirst({
        where: and(eq(eventParticipants.eventId, evtId), eq(eventParticipants.clanMemberId, signup.clanMemberId)),
      });
      if (existingPlayer) {
        await db
          .update(eventParticipants)
          .set({ teamId: team.id, pickNumber: 0, pickedAt: now })
          .where(eq(eventParticipants.id, existingPlayer.id));
      } else {
        await db.insert(eventParticipants).values({
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

      logAction('captain_promoted', { teamId: team.id, teamName: team.name });
      return NextResponse.json({ signup: updated, team });
    }

    case 'edit-answers': {
      if (!body.profile || typeof body.profile !== 'object') {
        return NextResponse.json({ error: 'profile is required' }, { status: 400 });
      }
      const [updated] = await db
        .update(eventSignups)
        .set({
          profileData: serializeProfile(sanitizeProfile(body.profile)),
          updatedAt: now,
        })
        .where(eq(eventSignups.id, sigId))
        .returning();
      logAction('signup_answers_edited');
      return NextResponse.json({ signup: updated });
    }

    case 'demote-captain': {
      // A guest (no user) can never be a captain, so there's nothing to demote.
      const captainTeam = signup.userId == null
        ? undefined
        : await db.query.teams.findFirst({
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
        .from(eventParticipants)
        .where(eq(eventParticipants.teamId, captainTeam.id));
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
          .update(eventParticipants)
          .set({ teamId: null, pickNumber: null, pickedAt: null })
          .where(eq(eventParticipants.id, captainPlayer.id));
      }

      await db.delete(teams).where(eq(teams.id, captainTeam.id));

      logAction('captain_demoted', { teamId: captainTeam.id, teamName: captainTeam.name });
      return NextResponse.json({ signup, removedTeamId: captainTeam.id });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

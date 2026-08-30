import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanAuditLog, clanMembers, events, eventSignups, players, signupFees, teams, users } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { generatePlayerToken } from '@/lib/auth';
import { sanitizeProfile, serializeProfile } from '@/lib/signup';
import { notifySignupApproved } from '@/lib/discord';
import { assertEventEditable } from '@/lib/eventLock';

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
  const session = await verifyUser();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }

  const { eventId, signupId } = await params;
  const evtId = parseInt(eventId, 10);
  const sigId = parseInt(signupId, 10);
  if (!Number.isFinite(evtId) || !Number.isFinite(sigId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: 'approve' | 'reject' | 'withdraw' | 'promote-captain' | 'demote-captain' | 'edit-answers' | 'set-prize-exclusion' | 'set-team';
    teamName?: string;
    teamColor?: string;
    profile?: Record<string, unknown>;
    excludeFromPrizePool?: boolean;
    /** set-team: the team to place them on, or null to clear the request. */
    teamId?: number | null;
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
    // Correct which team a sign-up asked for — a mistyped pick, or a captain and applicant who
    // agreed something different after the fact. The applicant's own answer stays as they wrote it
    // (profileData is theirs); this is the placement, which was always the host's to decide.
    case 'set-team': {
      // This moves teams and players, so it answers to the same two locks every other roster
      // edit does. Finished events are read-only (lib/eventLock) so recorded results can't
      // drift, and mid-draft the snake pick flow owns placements — but before the draft and
      // once it's complete a roster edit is fine, mirroring /events/[eventId]/players.
      const locked = await assertEventEditable(evtId);
      if (locked) return locked;
      const evt = await db.query.events.findFirst({ where: eq(events.id, evtId) });
      if (evt && (evt.draftStatus === 'active' || evt.draftStatus === 'paused')) {
        return NextResponse.json(
          { error: 'Cannot edit rosters while the draft is in progress.' },
          { status: 409 },
        );
      }

      const raw = body.teamId;
      // null clears the request: back to no preference, draftable from the pool like anyone else.
      const wantedId = raw == null ? null : Number(raw);
      if (wantedId != null && !Number.isFinite(wantedId)) {
        return NextResponse.json({ error: 'teamId must be a team id or null' }, { status: 400 });
      }

      // Re-read the team rather than trusting the id: a team from ANOTHER event would otherwise
      // seat somebody onto a board they never signed up for.
      let team: { id: number; name: string } | null = null;
      if (wantedId != null) {
        const found = await db.query.teams.findFirst({ where: eq(teams.id, wantedId) });
        if (!found || found.eventId !== evtId) {
          return NextResponse.json({ error: 'That team is not on this event.' }, { status: 400 });
        }
        team = { id: found.id, name: found.name };
      }

      await db
        .update(eventSignups)
        .set({ requestedTeamId: team?.id ?? null, updatedAt: now })
        .where(eq(eventSignups.id, sigId));

      // If they're already seated, move them with it. A pending sign-up has no player row yet, and
      // approving reads requestedTeamId — so the correction lands either way, before or after.
      //
      // Deliberately moves a player who is ALREADY on a team, unlike approve (which leaves an
      // existing placement alone). Approve is answering a request; this IS the host changing the
      // placement, and refusing to move them would make the action useless for the case it exists
      // for — fixing a mistake that has already been approved.
      const seated = await db.query.players.findFirst({
        where: and(eq(players.eventId, evtId), eq(players.clanMemberId, signup.clanMemberId)),
      });
      if (seated && seated.teamId !== (team?.id ?? null)) {
        // Pick metadata belongs to the seat, not the player: returning someone to the pool has to
        // drop their draft pick or they'd keep a pickNumber for a team they're no longer on.
        await db
          .update(players)
          .set(
            team
              ? { teamId: team.id, pickedAt: now }
              : { teamId: null, pickNumber: null, pickedAt: null },
          )
          .where(eq(players.id, seated.id));
      }

      logAction('signup_team_changed', { teamId: team?.id ?? null, teamName: team?.name ?? null });
      return NextResponse.json({ ok: true, teamId: team?.id ?? null, teamName: team?.name ?? null });
    }
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
      //
      // On a team-choice event (rules.teamChoice) they named a team when they applied, and
      // approving IS the answer to that request — so they land on it rather than in the pool. The
      // team is re-checked here: it can be deleted between the application and the decision.
      let seatTeamId: number | null = null;
      if (signup.requestedTeamId != null) {
        const wanted = await db.query.teams.findFirst({ where: eq(teams.id, signup.requestedTeamId) });
        if (wanted && wanted.eventId === evtId) seatTeamId = wanted.id;
      }

      const existingPlayer = await db.query.players.findFirst({
        where: and(eq(players.eventId, evtId), eq(players.clanMemberId, signup.clanMemberId)),
      });
      if (!existingPlayer) {
        const account = await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, signup.clanMemberId) });
        let timezone: string | null = null;
        try {
          const p = JSON.parse(signup.profileData) as { timezone?: unknown };
          if (typeof p?.timezone === 'string') timezone = p.timezone;
        } catch {
          /* profileData not JSON — leave timezone null */
        }
        await db.insert(players).values({
          eventId: evtId,
          clanMemberId: signup.clanMemberId,
          name: account?.rsn ?? 'Unknown',
          timezone,
          teamId: seatTeamId, // null → the pool, draftable/assignable
          playerToken: generatePlayerToken(),
        });
      } else if (seatTeamId != null && existingPlayer.teamId == null) {
        // Signed up before the teams existed, or applied and waited: the approval seats them now.
        // Someone already ON a team is left alone — that placement was a decision too.
        await db.update(players).set({ teamId: seatTeamId }).where(eq(players.id, existingPlayer.id));
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
            db.query.clanMembers.findFirst({ where: eq(clanMembers.id, signup.clanMemberId) }),
            db.query.signupFees.findFirst({ where: eq(signupFees.signupId, sigId) }),
          ]);
          if (!event) return;
          await notifySignupApproved({
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
        .delete(players)
        .where(
          and(
            eq(players.eventId, evtId),
            eq(players.clanMemberId, signup.clanMemberId),
            isNull(players.teamId),
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
          captainUserId,
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

      logAction('captain_demoted', { teamId: captainTeam.id, teamName: captainTeam.name });
      return NextResponse.json({ signup, removedTeamId: captainTeam.id });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

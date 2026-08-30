import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { clanRoster, eventParticipants, eventSignups, events, signupFees, teams, players } from '@/db/schema';
import { generatePlayerToken } from '@/lib/auth';
import { seatsOwnedBy } from '@/lib/roster';

/**
 * Seat a team's captain on their own team.
 *
 * Being made captain IS the entry: the host has just named this person to run a team, so making
 * them fill in a sign-up form to prove they're playing is a step that only ever gets forgotten —
 * and a captain left in the draft pool can be picked onto somebody else's team, which is the bug
 * that used to follow from forgetting it. So this enrols them if they aren't already in, and pins
 * their player row to their own team either way.
 *
 * What it will NOT do:
 *  - move a captain who is already on a DIFFERENT team. That's a mid-draft roster the host built
 *    on purpose; yanking it from under them is worse than the inconsistency.
 *  - invent an account. A captain with no roster account at all can't be a player here — that's a
 *    non-playing captain, and it stays a valid case.
 *
 * Their sign-up is created (or promoted) as APPROVED with empty answers — the host naming them is
 * the approval — and it carries the event's entry fee like any other entry, so the prize pool still
 * counts the same money. A host who comps their captains marks it on the Sign-ups tab.
 *
 * Returns the player now sitting on the team, or why nobody is. The caller surfaces that reason:
 * seating a captain that silently does nothing is how you end up with a captain who is told to go
 * and sign up like everyone else. Idempotent.
 */
export type CaptainSeatResult =
  | { playerId: number; reason: null }
  | {
      playerId: null;
      /**
       * no-account — the user has no roster account at all (nothing to play as).
       * other-team — already playing on a different team; the host put them there on purpose.
       * no-team    — the team id doesn't belong to this event.
       */
      reason: 'no-account' | 'other-team' | 'no-team';
    };

export async function placeCaptainOnTeam(
  eventId: number,
  teamId: number,
  captainUserId: number,
): Promise<CaptainSeatResult> {
  const memberRows = await db
    .select({
      id: clanRoster.id,
      accountId: clanRoster.accountId,
      rsn: clanRoster.rsn,
      isPrimary: clanRoster.isPrimary,
      verifiedAt: clanRoster.verifiedAt,
    })
    .from(clanRoster)
    .where(and(eq(clanRoster.playerId, captainUserId), isNull(clanRoster.leftAt)))
    .orderBy(desc(clanRoster.isPrimary), desc(clanRoster.verifiedAt));
  if (memberRows.length === 0) return { playerId: null, reason: 'no-account' };
  const memberIds = memberRows.map((m) => m.id);

  // Every player row this person already has in the event, across all their accounts.
  const existing = await db
    .select({ id: eventParticipants.id, teamId: eventParticipants.teamId, clanMemberId: eventParticipants.clanMemberId })
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), inArray(eventParticipants.clanMemberId, memberIds)));

  const alreadyHere = existing.find((p) => p.teamId === teamId);
  if (alreadyHere) {
    // A player row can belong to a guest with no roster account, hence the null check — there is
    // no sign-up to write for one of those.
    if (alreadyHere.clanMemberId != null) await enrolSignup(eventId, captainUserId, alreadyHere.clanMemberId);
    return { playerId: alreadyHere.id, reason: null };
  }

  const unassigned = existing.find((p) => p.teamId == null);
  if (unassigned) {
    await db.update(eventParticipants).set({ teamId }).where(eq(players.id, unassigned.id));
    if (unassigned.clanMemberId != null) await enrolSignup(eventId, captainUserId, unassigned.clanMemberId);
    return { playerId: unassigned.id, reason: null };
  }

  // On somebody else's team — the host put them there, so it isn't ours to undo.
  if (existing.length > 0) return { playerId: null, reason: 'other-team' };

  // Not entered at all: enrol them, on their verified account if they have one and on the account
  // the host was looking at when they named them if they don't.
  //
  // This used to insist on a verified RSN, the same gate the sign-up form enforces — and that gate
  // is about a STRANGER claiming an RSN. Here an admin has just pointed at a person and put them in
  // charge of a team, which is a stronger vouch than a verification code. It also failed exactly
  // where captains matter most: the visiting side of a clan-v-clan, whose players are guests on
  // this roster and verify nothing, so their captain silently never joined their own team.
  const account = memberRows.find((m) => m.verifiedAt) ?? memberRows[0];
  if (!account) return { playerId: null, reason: 'no-account' };

  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team || team.eventId !== eventId) return { playerId: null, reason: 'no-team' };

  const [player] = await db
    .insert(eventParticipants)
    .values({
      eventId,
      clanMemberId: account.id,
      // The board is keyed by account, not by seat (lib/participants).
      accountId: account.accountId,
      teamId,
      name: account.rsn,
      playerToken: generatePlayerToken(),
    })
    .returning({ id: eventParticipants.id });

  await enrolSignup(eventId, captainUserId, account.id);
  return player?.id != null ? { playerId: player.id, reason: null } : { playerId: null, reason: 'no-account' };
}

/**
 * Create-or-approve the sign-up a captain never filled in, plus the fee it would have carried.
 *
 * Every seating path runs this, not just the one that enrols a brand new player. The earlier
 * version only APPROVED an existing sign-up on the two paths where the captain already had a
 * player row — so a captain who was already in the draft pool (roster sync, or added by hand) came
 * out of this with a team, no sign-up, and a site still telling them to go and apply.
 */
async function enrolSignup(eventId: number, userId: number, clanMemberId: number): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.eventId, eventId), eq(eventSignups.clanMemberId, clanMemberId)),
  });
  const row = existing
    ? (await db
        .update(eventSignups)
        .set({ status: 'approved', updatedAt: now })
        .where(eq(eventSignups.id, existing.id))
        .returning())[0]
    : (await db
        .insert(eventSignups)
        .values({
          eventId,
          userId,
          clanMemberId,
          // No answers: nobody asked them any. The sign-up form's questions are for people the host
          // is deciding about, and this decision is already made.
          profileData: '{}',
          status: 'approved',
          signedUpAt: now,
          updatedAt: now,
        })
        .returning())[0];
  if (!row) return;

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event?.signupFee || event.signupFee <= 0) return;
  const fee = await db.query.signupFees.findFirst({ where: eq(signupFees.signupId, row.id) });
  if (!fee) {
    await db.insert(signupFees).values({ signupId: row.id, amount: event.signupFee, status: 'pending' });
  }
}

/**
 * One sentence for the host when a captain couldn't be seated.
 *
 * Naming a captain is supposed to BE their entry, so when it isn't, silence is the worst possible
 * answer — the captain finds out by being told to sign up like a stranger. Every reason here is
 * something the host can act on.
 */
export function captainSeatNotice(result: CaptainSeatResult, name = 'That captain'): string | null {
  switch (result.reason) {
    case null:
    // A team id that isn't in this event is a bug, not something to explain to a host.
    case 'no-team':
      return null;
    case 'no-account':
      return `${name} has no account on the roster, so they aren't entered as a player. Add their RSN to the roster and set them as captain again.`;
    case 'other-team':
      return `${name} is already playing on another team, so they were left there. Move them off it first if they should play for this one.`;
  }
}

/**
 * Seat every captain in an event on their own team.
 *
 * Called as the draft starts. Seating happens when a captain is NAMED, but that can fail at the
 * time (their RSN wasn't verified yet, they joined the event afterwards) and nothing retried it —
 * leaving a captain in the pool for another team to draft. Running it here means the pool the
 * draft opens with is captain-free, whatever happened earlier. Idempotent and best-effort: a
 * captain who still can't be seated (no verified account) is simply not a player.
 */
export async function seatEventCaptains(eventId: number): Promise<void> {
  const rows = await db
    .select({ id: teams.id, captainUserId: teams.captainUserId })
    .from(teams)
    .where(eq(teams.eventId, eventId));
  for (const row of rows) {
    if (row.captainUserId == null) continue;
    await placeCaptainOnTeam(eventId, row.id, row.captainUserId);
  }
}

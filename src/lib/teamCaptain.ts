import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { db } from '@/db';
import { clanMemberships, clanRoster, eventParticipants, eventSignups, events, signupFees, teams, users } from '@/db/schema';
import { standardFeeForAccount } from '@/lib/entryFee';
import { generatePlayerToken } from '@/lib/auth';
import { seatsOwnedBy } from '@/lib/roster';
import { rosterSeatOpensEventSql } from '@/lib/seatScope';
import { captureStartingStatsSoon } from '@/lib/startingStats';
import { PlanLimitError } from '@/lib/creatorPlansDb';
import { withHostEventRoom } from '@/lib/friendEvents';
import { acceptedCohostClanIds } from '@/lib/coHost';

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
/**
 * Why this person can't captain a team in this event, or null when they're free to.
 *
 * One person, one captaincy per event. Two teams with the same captain hand that person both
 * teams' picks on draft day and both teams' controls after it, and placeCaptainOnTeam can only
 * seat them on one of the two — the other is left with a captain who isn't playing for it.
 *
 * Checked by every route that names a captain (team create, team edit, the admin captain card).
 * There's deliberately no unique index behind it: events that already carry a duplicate would fail
 * the migration, and they get fixed by the host re-assigning one of the seats, which this allows.
 * `exceptTeamId` is the team being edited, so re-saving its own captain isn't a conflict.
 */
export async function captainConflict(
  eventId: number,
  userId: number,
  exceptTeamId?: number,
): Promise<string | null> {
  const where = and(
    eq(teams.eventId, eventId),
    eq(teams.captainUserId, userId),
    exceptTeamId != null ? ne(teams.id, exceptTeamId) : undefined,
  );
  const [other] = await db.select({ name: teams.name }).from(teams).where(where).limit(1);
  if (!other) return null;
  const person = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { displayName: true } });
  return `${person?.displayName ?? 'That person'} already captains ${other.name} in this event.`;
}

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
    }
  /**
   * full — the plan's cap on players at once across the host's overlapping events has no room for
   * them (lib/creatorPlansDb withEventRoom). Nothing was moved or seated; `error` says why.
   */
  | { playerId: null; reason: 'full'; error: string };

export async function placeCaptainOnTeam(
  eventId: number,
  teamId: number,
  captainUserId: number,
): Promise<CaptainSeatResult> {
  // A captain is a USER; their seats belong to the PLAYER behind the login (users.playerId). Matching
  // roster player ids against the user id found nobody, or the wrong person, whenever the two differ.
  const captain = await db.query.users.findFirst({ where: eq(users.id, captainUserId), columns: { playerId: true } });
  if (captain?.playerId == null) return { playerId: null, reason: 'no-account' };
  // ONLY SEATS IN A CLAN THAT IS IN THIS EVENT: the host, or a clan that ACCEPTED a co-host seat. The
  // read used to take any seat this person holds anywhere, so naming a captain who also sits in some
  // third clan could enter that clan's seat on the board — a clan that never agreed to the event.
  const ev = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { clanId: true } });
  if (!ev) return { playerId: null, reason: 'no-team' };
  const eventClanIds = [ev.clanId, ...(await acceptedCohostClanIds(eventId))];
  // clan-scope: this clan -- the person's seats, limited to the clans running this event (eventClanIds).
  const memberRows = await db
    .select({
      id: clanRoster.id,
      accountId: clanRoster.accountId,
      rsn: clanRoster.rsn,
      isPrimary: clanRoster.isPrimary,
      verifiedAt: clanRoster.verifiedAt,
    })
    .from(clanRoster)
    // Seats that may play THIS event: an event player's seat only for its own event.
    .where(and(eq(clanRoster.playerId, captain.playerId), inArray(clanRoster.clanId, eventClanIds), isNull(clanRoster.leftAt), rosterSeatOpensEventSql(eventId)))
    .orderBy(desc(clanRoster.isPrimary), desc(clanRoster.verifiedAt));
  if (memberRows.length === 0) return { playerId: null, reason: 'no-account' };
  const memberIds = memberRows.map((m) => m.id);

  // Every player row this person already has in the event, across all their accounts.
  const existing = await db
    .select({ id: eventParticipants.id, teamId: eventParticipants.teamId, clanMemberId: eventParticipants.clanMemberId })
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), inArray(eventParticipants.clanMemberId, memberIds)));

  // The sign-up is written FIRST on every path: it is what the plan's player cap can refuse, and a
  // refused captain must not be moved onto the team or given a player row.
  const alreadyHere = existing.find((p) => p.teamId === teamId);
  if (alreadyHere) {
    // A player row can belong to a guest with no roster account, hence the null check — there is
    // no sign-up to write for one of those.
    if (alreadyHere.clanMemberId != null) {
      const full = await enrolSignup(eventId, captainUserId, alreadyHere.clanMemberId);
      if (full) return { playerId: null, reason: 'full', error: full };
    }
    return { playerId: alreadyHere.id, reason: null };
  }

  const unassigned = existing.find((p) => p.teamId == null);
  if (unassigned) {
    if (unassigned.clanMemberId != null) {
      const full = await enrolSignup(eventId, captainUserId, unassigned.clanMemberId);
      if (full) return { playerId: null, reason: 'full', error: full };
    }
    await db.update(eventParticipants).set({ teamId }).where(eq(eventParticipants.id, unassigned.id));
    captureStartingStatsSoon(eventId, [unassigned.id]);
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

  const full = await enrolSignup(eventId, captainUserId, account.id);
  if (full) return { playerId: null, reason: 'full', error: full };

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

  if (player?.id != null) captureStartingStatsSoon(eventId, [player.id]);
  return player?.id != null ? { playerId: player.id, reason: null } : { playerId: null, reason: 'no-account' };
}

/**
 * Create-or-approve the sign-up a captain never filled in, plus the fee it would have carried.
 *
 * Every seating path runs this, not just the one that enrols a brand new player. The earlier
 * version only APPROVED an existing sign-up on the two paths where the captain already had a
 * player row — so a captain who was already in the draft pool (roster sync, or added by hand) came
 * out of this with a team, no sign-up, and a site still telling them to go and apply.
 *
 * Creating one, or bringing back a withdrawn or rejected one, puts the captain on the board: the
 * write runs under the event's room (lib/creatorPlansDb withEventRoom), so on a player-capped event
 * it is refused when the plan has no room for one more at once across the host's overlapping events.
 * Returns that refusal's message, or null when they're in.
 */
async function enrolSignup(eventId: number, userId: number, clanMemberId: number): Promise<string | null> {
  const now = new Date().toISOString();
  let row: typeof eventSignups.$inferSelect | undefined;
  try {
    // A friends host's Supporter tier, or a creator plan: one host, one gate (lib/friendEvents).
    row = await withHostEventRoom({ eventId, audience: 'host' }, async (tx) => {
      const [existing] = await tx
        .select({ id: eventSignups.id })
        .from(eventSignups)
        .where(and(eq(eventSignups.eventId, eventId), eq(eventSignups.clanMemberId, clanMemberId)))
        .limit(1);
      return existing
        ? (await tx.update(eventSignups).set({ status: 'approved', updatedAt: now }).where(eq(eventSignups.id, existing.id)).returning())[0]
        : (
            await tx
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
              .returning()
          )[0];
    });
  } catch (e) {
    if (e instanceof PlanLimitError) return e.message;
    throw e;
  }
  if (!row) return null;

  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope. Every route and page that reaches this is verified scoped.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return null;
  // clan-scope: global -- the seat this sign-up was just written with, by its id; only its character is read.
  const seat = await db.query.clanMemberships.findFirst({ where: eq(clanMemberships.id, clanMemberId) });
  // Member or guest fee, by the character's seats (lib/entryFee).
  const amount = seat ? await standardFeeForAccount(event, seat.accountId) : event.signupFee;
  if (!amount || amount <= 0) return null;
  const fee = await db.query.signupFees.findFirst({ where: eq(signupFees.signupId, row.id) });
  if (!fee) {
    await db.insert(signupFees).values({ signupId: row.id, amount, status: 'pending' });
  }
  return null;
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
    case 'full':
      return `${name} isn’t entered as a player. ${result.error}`;
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

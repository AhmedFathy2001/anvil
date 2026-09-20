// An admin signing a character up for someone — the "they told me on Discord but won't touch the
// site" case, behind "Add member" on a board's Sign-ups tab.
//
// Out of the route so it can be tested against a real database: the route only decides WHO may do
// this and WHICH board; everything about what the sign-up says lives here.
//
// It deliberately skips the sign-up window and the account-verification requirement that gate the
// self-serve flow — an admin adding someone IS the approval. It does not skip the board's own
// characters-per-person rule, and it mirrors the self-serve side effects: a fee row when the board
// charges one, and the draft-pool player row.

import { and, eq, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, eventParticipants, eventSignups, signupFees, teams } from '@/db/schema';
import { enrolParticipant, participantForSeat } from '@/lib/participants';
import { findRosterSeat, loginOf } from '@/lib/roster';
import { sanitizeProfile, serializeProfile } from '@/lib/signup';

export type SignupRow = typeof eventSignups.$inferSelect;

export type OnBehalfResult =
  | { ok: true; signup: SignupRow }
  | { ok: false; status: 404 | 409; error: string };

export async function signUpOnBehalf(input: {
  event: { id: number; clanId: number; signupFee: number | null; maxAccountsPerPerson: number | null };
  clanMemberId: number;
  profile: Record<string, unknown>;
  status: 'pending' | 'approved';
  /**
   * Put them straight on a team instead of in the draft pool. Null (the default) leaves them in the
   * pool, which is where a sign-up has always landed.
   */
  teamId?: number | null;
  /** Minted by the caller (lib/auth), used only if this character is new to the draft pool. */
  playerToken: string;
}): Promise<OnBehalfResult> {
  const { event, clanMemberId } = input;
  const teamId = input.teamId ?? null;

  // The team has to be one of THIS board's, since the id came in with the request. Same check the
  // Teams tab's add-player makes; refusing here keeps a stray id from seating someone on another
  // board's team.
  if (teamId != null) {
    const team = await db.query.teams.findFirst({ where: and(eq(teams.id, teamId), eq(teams.eventId, event.id)) });
    if (!team) return { ok: false, status: 404, error: 'Team not found in this event' };
  }

  // The seat has to be on the BOARD's clan roster. The member id came from the request body and
  // would otherwise seat another clan's member into it.
  const account = await findRosterSeat(
    and(eq(clanRoster.clanId, event.clanId), eq(clanRoster.id, clanMemberId), isNull(clanRoster.leftAt)),
  );
  if (!account) return { ok: false, status: 404, error: 'Clan member not found' };

  // Are they already playing, and where? By ACCOUNT, not by seat — see lib/participants for why one
  // player can hold two of the latter. Asked BEFORE anything is written: refusing halfway would
  // leave the sign-up saved and the team not, and the caller could not tell which.
  //
  // Someone already on a team keeps it — moving them is the Teams tab's job, and re-running a
  // sign-up should not quietly re-draft anybody. A player still in the POOL is seated below, which
  // is what was just asked for.
  const player = await participantForSeat(event.id, clanMemberId);
  if (teamId != null && player && player.teamId != null && player.teamId !== teamId) {
    return { ok: false, status: 409, error: `${account.rsn} is already on another team in this event.` };
  }

  // A linked member's sign-up hangs off their LOGIN; an unclaimed seat, or a person who has never
  // signed in, gets a GUEST sign-up (userId null) so they still show up in the draft pool.
  //
  // The login, not the person. eventSignups.userId is a foreign key to users.id and a seat names a
  // players.id — two separate sequences. This once passed the person id straight through, which does
  // not fail: some unrelated login usually holds that number, and the sign-up quietly became theirs
  // (or, where none did, the insert hit the foreign key and 500'd). lib/enroll made the same mistake
  // and resolves it the same way.
  const userId = account.claimedAt ? await loginOf(account.playerId) : null;

  // One sign-up per CHARACTER — the (event, seat) unique index — which is how self-serve counts them
  // since a person may enter several.
  const existing = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.eventId, event.id), eq(eventSignups.clanMemberId, clanMemberId)),
  });
  if (existing && existing.status !== 'withdrawn') {
    return {
      ok: false,
      status: 409,
      error: `${account.rsn} already has a ${existing.status} sign-up — edit their answers instead.`,
    };
  }

  // And no more characters per person than the board allows. Adding them by hand is a way past the
  // window, not past the board's own rule.
  if (userId != null) {
    const theirs = await db
      .select({ id: eventSignups.id })
      .from(eventSignups)
      .where(
        and(eq(eventSignups.eventId, event.id), eq(eventSignups.userId, userId), ne(eventSignups.status, 'withdrawn')),
      );
    const cap = event.maxAccountsPerPerson ?? 1;
    if (theirs.length >= cap) {
      return {
        ok: false,
        status: 409,
        error:
          cap === 1
            ? 'This person is already signed up with another character — edit that sign-up instead.'
            : `This person already has ${theirs.length} characters signed up, and this board allows ${cap}.`,
      };
    }
  }

  const profile = sanitizeProfile(input.profile);
  const profileJson = serializeProfile(profile);
  const now = new Date().toISOString();

  // A withdrawn sign-up is revived in place (the unique (event, seat) index means a second row can't
  // be inserted) — same as the self-serve re-join path. userId is rewritten too: a row revived before
  // the fix above may still name the wrong login.
  const [signup] = existing
    ? await db
        .update(eventSignups)
        .set({ userId, profileData: profileJson, status: input.status, updatedAt: now })
        .where(eq(eventSignups.id, existing.id))
        .returning()
    : await db
        .insert(eventSignups)
        .values({
          eventId: event.id,
          userId,
          clanMemberId,
          profileData: profileJson,
          status: input.status,
          signedUpAt: now,
          updatedAt: now,
        })
        .returning();

  // Mirror the self-serve side effects (see /api/events/[eventId]/signup POST): a fee row only when
  // the board charges one, the draft-pool row idempotently.
  if (event.signupFee && event.signupFee > 0) {
    const existingFee = await db.query.signupFees.findFirst({ where: eq(signupFees.signupId, signup.id) });
    if (!existingFee) {
      await db.insert(signupFees).values({ signupId: signup.id, amount: event.signupFee, status: 'pending' });
    }
  }

  // The draft-pool row, idempotently.
  if (!player) {
    await enrolParticipant({
      eventId: event.id,
      clanMemberId,
      accountId: account.accountId,
      name: account.rsn,
      timezone: profile.timezone ?? null,
      playerToken: input.playerToken,
      teamId,
    });
  } else if (teamId != null && player.teamId == null) {
    await db.update(eventParticipants).set({ teamId }).where(eq(eventParticipants.id, player.id));
  }

  return { ok: true, signup };
}

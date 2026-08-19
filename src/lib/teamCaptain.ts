import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { clanRoster, eventParticipants, eventSignups, events, signupFees, teams } from '@/db/schema';
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
 *  - invent an account. A captain with no verified, in-clan RSN can't be a player here — that's a
 *    non-playing captain, and it stays a valid case.
 *
 * Their sign-up is created (or promoted) as APPROVED with empty answers — the host naming them is
 * the approval — and it carries the event's entry fee like any other entry, so the prize pool still
 * counts the same money. A host who comps their captains marks it on the Sign-ups tab.
 *
 * Returns the player id now sitting on the team, or null when nothing could be done. Idempotent.
 */
export async function placeCaptainOnTeam(
  eventId: number,
  teamId: number,
  captainUserId: number,
): Promise<number | null> {
  // The captain's own accounts, seated on this event's clan — which the filter now actually says.
  // seatsOwnedBy resolves the login to the person who owns the accounts; the two are different id
  // sequences.
  const eventRow = await db
    .select({ clanId: events.clanId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!eventRow) return null;

  const memberRows = await db
    .select({
      id: clanRoster.id,
      rsn: clanRoster.rsn,
      isPrimary: clanRoster.isPrimary,
      verifiedAt: clanRoster.verifiedAt,
    })
    .from(clanRoster)
    .where(and(await seatsOwnedBy(eventRow.clanId, captainUserId), isNull(clanRoster.leftAt)))
    .orderBy(desc(clanRoster.isPrimary), desc(clanRoster.verifiedAt));
  if (memberRows.length === 0) return null;
  const memberIds = memberRows.map((m) => m.id);

  // Every player row this person already has in the event, across all their accounts.
  const existing = await db
    .select({ id: eventParticipants.id, teamId: eventParticipants.teamId, clanMemberId: eventParticipants.clanMemberId })
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), inArray(eventParticipants.clanMemberId, memberIds)));

  const alreadyHere = existing.find((p) => p.teamId === teamId);
  if (alreadyHere) {
    // A player row can belong to a guest with no roster account, hence the null check — there is
    // no sign-up to promote for one of those.
    if (alreadyHere.clanMemberId != null) await approveSignup(eventId, alreadyHere.clanMemberId);
    return alreadyHere.id;
  }

  const unassigned = existing.find((p) => p.teamId == null);
  if (unassigned) {
    await db.update(eventParticipants).set({ teamId }).where(eq(eventParticipants.id, unassigned.id));
    if (unassigned.clanMemberId != null) await approveSignup(eventId, unassigned.clanMemberId);
    return unassigned.id;
  }

  // On somebody else's team — the host put them there, so it isn't ours to undo.
  if (existing.length > 0) return null;

  // Not entered at all: enrol them. Only a verified account can play, same gate the sign-up form
  // enforces — the captaincy vouches for the person, not for an unverified RSN.
  const account = memberRows.find((m) => m.verifiedAt);
  if (!account) return null;

  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team || team.eventId !== eventId) return null;

  const [player] = await db
    .insert(eventParticipants)
    .values({
      eventId,
      clanMemberId: account.id,
      teamId,
      name: account.rsn,
      playerToken: generatePlayerToken(),
    })
    .returning({ id: eventParticipants.id });

  await enrolSignup(eventId, captainUserId, account.id);
  return player?.id ?? null;
}

/** Promote an existing sign-up to approved — a captain doesn't wait in the approval queue. */
async function approveSignup(eventId: number, clanMemberId: number): Promise<void> {
  const row = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.eventId, eventId), eq(eventSignups.clanMemberId, clanMemberId)),
  });
  if (!row || row.status === 'approved') return;
  await db
    .update(eventSignups)
    .set({ status: 'approved', updatedAt: new Date().toISOString() })
    .where(eq(eventSignups.id, row.id));
}

/** Create the sign-up a captain never filled in, plus the fee it would have carried. */
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

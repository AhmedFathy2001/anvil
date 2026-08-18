import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { clanMembers, eventParticipants } from '@/db/schema';

/**
 * Put a team's captain onto their own team as a player, so they show in the roster and aren't
 * left in the draft pool to be picked onto themselves. Resolves the captain's event player row
 * via their linked clan membership (captainUserId → clan_members.userId → eventParticipants.clanMemberId).
 *
 * Conservative on purpose:
 *  - Only acts when the captain actually has a player row in this event (a non-playing captain
 *    is a valid case — we just don't fabricate a player for them).
 *  - Only moves a player that is currently UNASSIGNED (teamId null). If they were already drafted
 *    onto some team we leave that alone rather than yank a mid-draft roster around.
 *
 * Returns the player id that was placed, or null if nothing changed. Safe to call repeatedly.
 */
export async function placeCaptainOnTeam(
  eventId: number,
  teamId: number,
  captainUserId: number,
): Promise<number | null> {
  const memberRows = await db
    .select({ id: clanMembers.id })
    .from(clanMembers)
    .where(and(eq(clanMembers.userId, captainUserId), isNull(clanMembers.leftAt)));
  const memberIds = memberRows.map((m) => m.id);
  if (memberIds.length === 0) return null;

  // The captain's player in this event that isn't on a team yet.
  const [captainPlayer] = await db
    .select({ id: eventParticipants.id, teamId: eventParticipants.teamId })
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, eventId),
        inArray(eventParticipants.clanMemberId, memberIds),
        isNull(eventParticipants.teamId),
      ),
    )
    .limit(1);
  if (!captainPlayer) return null;

  await db.update(eventParticipants).set({ teamId }).where(eq(eventParticipants.id, captainPlayer.id));
  return captainPlayer.id;
}

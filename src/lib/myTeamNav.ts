import { db } from '@/db';
import { clanMembers, eventSignups, events, players, teams, teamStaff } from '@/db/schema';
import { and, eq, inArray, isNull, isNotNull, or, gt } from 'drizzle-orm';

/**
 * How many team-shaped things this user still has going: a team on an event that hasn't ended, a
 * captain seat, or a sign-up that's still live.
 *
 * The "My Team" nav item used to show for anyone signed in, which between events is every member,
 * most of the time — a permanent link to a page whose only content is "you're not on a team for any
 * active event". Hiding it needs this count, and it runs on every page load for a signed-in user,
 * so it's deliberately three narrow indexed reads and no joins beyond the ones needed to date-filter.
 *
 * It counts INVOLVEMENTS, not distinct teams: a captain who also plays on that team is one. Past
 * teams are excluded on purpose — they stay reachable from the locker, which is where a finished
 * event belongs.
 */
export async function countLiveTeamInvolvements(userId: number, now: Date = new Date()): Promise<number> {
  const nowIso = now.toISOString();
  const live = or(isNull(events.endDate), gt(events.endDate, nowIso));
  const notForceEnded = isNull(events.forceEndedAt);

  const [captainRows, staffRows, playerRows, signupRows] = await Promise.all([
    db
      .select({ teamId: teams.id })
      .from(teams)
      .innerJoin(events, eq(teams.eventId, events.id))
      .where(and(eq(teams.captainUserId, userId), notForceEnded, live)),
    // A staff seat is a reason to reach a team even when you neither captain nor play on it —
    // which is exactly the visiting-clan moderator case the seat exists for.
    db
      .select({ teamId: teamStaff.teamId })
      .from(teamStaff)
      .innerJoin(teams, eq(teamStaff.teamId, teams.id))
      .innerJoin(events, eq(teams.eventId, events.id))
      .where(and(eq(teamStaff.userId, userId), notForceEnded, live)),
    db
      .select({ teamId: players.teamId })
      .from(players)
      .innerJoin(events, eq(players.eventId, events.id))
      .innerJoin(clanMembers, eq(players.clanMemberId, clanMembers.id))
      .where(
        and(
          eq(clanMembers.userId, userId),
          isNull(clanMembers.leftAt),
          isNotNull(players.teamId),
          notForceEnded,
          live,
        ),
      ),
    db
      .select({ id: eventSignups.id })
      .from(eventSignups)
      .innerJoin(events, eq(eventSignups.eventId, events.id))
      .where(
        and(
          eq(eventSignups.userId, userId),
          inArray(eventSignups.status, ['pending', 'approved']),
          notForceEnded,
          live,
        ),
      ),
  ]);

  const teamIds = new Set<number>();
  for (const r of captainRows) teamIds.add(r.teamId);
  for (const r of staffRows) teamIds.add(r.teamId);
  for (const r of playerRows) if (r.teamId != null) teamIds.add(r.teamId);

  // A sign-up for an event you're already on a team for is the same involvement, but a sign-up
  // with no team yet (pre-draft) is one of its own — and that's exactly when a member most needs
  // the link, so count those.
  const signupOnly = signupRows.length > 0 && teamIds.size === 0 ? 1 : 0;
  return teamIds.size + signupOnly;
}

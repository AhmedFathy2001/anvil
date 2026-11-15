import { db } from '@/db';
import { accounts, clanRoster, eventParticipants, eventSignups, teamStaff, teams } from '@/db/schema';
import { and, eq, exists, inArray, isNull, or } from 'drizzle-orm';

/**
 * Which of a list's board events the viewer is in, for the events page's "You're in" section.
 *
 * BATCHED: at most three queries however many events are listed. The events page is one every
 * member opens, and asking lib/standingsAccess `viewerTeamIds` once per listed event was several
 * reads times every running and scheduled board the clan has.
 *
 * SAME RULE as `viewerTeamIds`, which stays the per-event authority (tests/viewer-events.test.ts
 * holds the two together): a team counts as the viewer's when any of their characters plays on it
 * (a live seat of theirs, or an account they own), when they captain it, or when they hold a
 * team-staff seat on it. A sign-up with no team yet counts for an event that has not started, the
 * same rule the "My teams" badge uses (lib/myTeamNav).
 */
export interface ViewerEventEntry {
  /** The viewer's team(s) in the event. Empty when they are only signed up. */
  teamIds: number[];
  /** The same teams by name, sorted. */
  teamNames: string[];
  signedUp: boolean;
}

export async function viewerEventEntries(
  person: { userId: number | null; playerId: number | null },
  eventIds: number[],
  upcomingEventIds: number[],
): Promise<Map<number, ViewerEventEntry>> {
  const out = new Map<number, ViewerEventEntry>();
  // Signed out, or nothing listed: no lookup at all.
  if (eventIds.length === 0 || (person.userId == null && person.playerId == null)) return out;

  const { userId, playerId } = person;
  const [playing, running, signups] = await Promise.all([
    // 1. Teams any of their characters plays on: a participant row on a live seat of theirs, or on
    //    an account they own.
    // clan-scope: global -- the subject is a PERSON, whose seats span clans by design; scoped to the viewer's own and to the listed events.
    playerId != null
      ? db
          .select({ eventId: eventParticipants.eventId, teamId: teams.id, name: teams.name })
          .from(eventParticipants)
          .innerJoin(teams, eq(teams.id, eventParticipants.teamId))
          .where(
            and(
              inArray(eventParticipants.eventId, eventIds),
              or(
                inArray(
                  eventParticipants.clanMemberId,
                  db.select({ id: clanRoster.id }).from(clanRoster).where(and(eq(clanRoster.playerId, playerId), isNull(clanRoster.leftAt))),
                ),
                inArray(eventParticipants.accountId, db.select({ id: accounts.id }).from(accounts).where(eq(accounts.playerId, playerId))),
              ),
            ),
          )
      : [],
    // 2. Teams they captain or hold a team-staff seat on.
    // clan-scope: global -- the viewer's own captain and staff seats, in the listed events only.
    userId != null
      ? db
          .select({ eventId: teams.eventId, teamId: teams.id, name: teams.name })
          .from(teams)
          .where(
            and(
              inArray(teams.eventId, eventIds),
              or(
                eq(teams.captainUserId, userId),
                exists(db.select({ id: teamStaff.id }).from(teamStaff).where(and(eq(teamStaff.teamId, teams.id), eq(teamStaff.userId, userId)))),
              ),
            ),
          )
      : [],
    // 3. Their live sign-ups for the listed events that have not started.
    // clan-scope: global -- the viewer's own sign-ups, for the listed events only.
    userId != null && upcomingEventIds.length
      ? db
          .select({ eventId: eventSignups.eventId })
          .from(eventSignups)
          .where(
            and(
              eq(eventSignups.userId, userId),
              inArray(eventSignups.eventId, upcomingEventIds),
              inArray(eventSignups.status, ['pending', 'approved']),
            ),
          )
      : [],
  ]);

  const teamsByEvent = new Map<number, Map<number, string>>();
  for (const row of [...playing, ...running]) {
    let mine = teamsByEvent.get(row.eventId);
    if (!mine) teamsByEvent.set(row.eventId, (mine = new Map()));
    mine.set(row.teamId, row.name);
  }
  const signedUp = new Set(signups.map((s) => s.eventId));

  for (const id of eventIds) {
    const mine = [...(teamsByEvent.get(id) ?? [])].sort((a, b) => a[1].localeCompare(b[1]) || a[0] - b[0]);
    if (mine.length === 0 && !signedUp.has(id)) continue;
    out.set(id, { teamIds: mine.map(([teamId]) => teamId), teamNames: mine.map(([, name]) => name), signedUp: signedUp.has(id) });
  }
  return out;
}

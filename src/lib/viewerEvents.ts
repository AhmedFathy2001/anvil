import { db } from '@/db';
import { eventSignups, teams } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { viewerTeamIds } from '@/lib/standingsAccess';

/**
 * Which of a list's board events the viewer is in, for the events page's "You're in" section.
 *
 * The team lookup is the event page's own (lib/standingsAccess viewerTeamIds: plays on, captains
 * or holds a staff seat), asked once per listed event, so the list and the event page can never
 * disagree about whose team it is. A sign-up with no team yet counts for an event that has not
 * started, the same rule the "My teams" badge uses (lib/myTeamNav).
 */
export interface ViewerEventEntry {
  /** The viewer's team(s) in the event, by name. Empty when they are only signed up. */
  teamNames: string[];
  signedUp: boolean;
}

export async function viewerEventEntries(
  person: { userId: number | null; playerId: number | null },
  eventIds: number[],
  upcomingEventIds: number[],
): Promise<Map<number, ViewerEventEntry>> {
  const out = new Map<number, ViewerEventEntry>();
  if (eventIds.length === 0 || (person.userId == null && person.playerId == null)) return out;

  const perEvent = await Promise.all(eventIds.map(async (id) => ({ id, teamIds: await viewerTeamIds(id, person) })));
  const teamIds = perEvent.flatMap((e) => e.teamIds);
  const [nameRows, signupRows] = await Promise.all([
    teamIds.length
      ? // clan-scope: global -- ids come from viewerTeamIds, which is scoped to the listed events and the viewer.
        db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds))
      : [],
    person.userId != null && upcomingEventIds.length
      ? // clan-scope: global -- the viewer's own sign-ups, for the listed events only.
        db
          .select({ eventId: eventSignups.eventId })
          .from(eventSignups)
          .where(
            and(
              eq(eventSignups.userId, person.userId),
              inArray(eventSignups.eventId, upcomingEventIds),
              inArray(eventSignups.status, ['pending', 'approved']),
            ),
          )
      : [],
  ]);
  const nameById = new Map(nameRows.map((t) => [t.id, t.name]));
  const signedUp = new Set(signupRows.map((s) => s.eventId));

  for (const e of perEvent) {
    const teamNames = e.teamIds.map((id) => nameById.get(id)).filter((n): n is string => !!n).sort();
    if (teamNames.length > 0 || signedUp.has(e.id)) out.set(e.id, { teamNames, signedUp: signedUp.has(e.id) });
  }
  return out;
}

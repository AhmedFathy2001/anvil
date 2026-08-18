import { db } from '@/db';
import { requireEventForPage } from '@/lib/eventScope';
import { events, tiles, teams, eventParticipants, completions, users } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import TeamsDraftClient from './TeamsDraftClient';
import { loadEventProfiles, attachProfiles } from '@/lib/draftProfiles';
import { parseContributionSnapshot } from '@/lib/statTracking';
import { eventEditLocked } from '@/lib/eventLock';

export const dynamic = 'force-dynamic';

export default async function EventTeamsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  await requireEventForPage(id);
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const [eventTiles, eventTeams, rawPlayers, profiles] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, id)),
    db.select().from(teams).where(eq(teams.eventId, id)),
    db.select().from(eventParticipants).where(eq(eventParticipants.eventId, id)),
    loadEventProfiles(id),
  ]);
  // Join in each player's frozen sign-up answers for the draft-setup pool.
  const eventPlayers = attachProfiles(rawPlayers, profiles);

  const tileIds = new Set(eventTiles.map((t) => t.id));
  const eventCompletions = tileIds.size
    ? (await db.select().from(completions))
        .filter((c) => tileIds.has(c.tileId))
        .map((c) => ({
          id: c.id,
          teamId: c.teamId,
          tileId: c.tileId,
          completedAt: c.completedAt,
          statContributions: parseContributionSnapshot(c.statContributions),
        }))
    : [];

  // Surface each captain's display name so the team list can show who holds the seat.
  const captainIds = [...new Set(eventTeams.map((t) => t.captainUserId).filter((v): v is number => v != null))];
  const captainRows = captainIds.length
    ? await db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, captainIds))
    : [];
  const captainNameById = new Map(captainRows.map((u) => [u.id, u.displayName]));

  const safeTeams = eventTeams.map(({ captainPassword: _, ...rest }) => ({
    ...rest,
    captainName: rest.captainUserId != null ? captainNameById.get(rest.captainUserId) ?? null : null,
  }));

  return (
    <TeamsDraftClient
      event={event}
      tiles={eventTiles}
      teams={safeTeams}
      players={eventPlayers}
      completions={eventCompletions}
      editLocked={eventEditLocked(event)}
    />
  );
}

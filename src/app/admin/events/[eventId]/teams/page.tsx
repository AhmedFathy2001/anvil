import { db } from '@/db';
import { requireEventForPage } from '@/lib/eventScope';
import { events, tiles, teams, eventParticipants, completions, users } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import TeamsDraftClient from './TeamsDraftClient';
import CoHostPanel from './CoHostPanel';
import AccessPanel from './AccessPanel';
import { cohostsForEvent } from '@/lib/coHost';
import { settlementForEvent } from '@/lib/coHostSettlement';
import { loadEventProfiles, attachProfiles } from '@/lib/draftProfiles';
import { parseContributionSnapshot } from '@/lib/statTracking';
import { eventEditLocked } from '@/lib/eventLock';

export const dynamic = 'force-dynamic';

export default async function EventTeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ uninvited?: string }>;
}) {
  const { eventId } = await params;
  // Clans the create form could not invite — a typo, or the multi-clan plan gate. Carried here
  // rather than shown on the form, because the board exists either way and this is where an admin
  // fixes it. Silence was the old behaviour and it left an invite-only event with nobody invited.
  const uninvited = ((await searchParams).uninvited ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
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

  const [cohosts, settlement] = await Promise.all([cohostsForEvent(id), settlementForEvent(id)]);

  return (
    <>
      {uninvited.length > 0 && (
        <div className="mb-4 rounded-xl border border-accent-red/40 bg-accent-red/10 p-4">
          <div className="text-[14px] font-semibold text-accent-red">
            {uninvited.length === 1 ? 'One clan was not invited' : `${uninvited.length} clans were not invited`}
          </div>
          <div className="mt-0.5 text-[12.5px] text-text-muted">
            The board was created, but {uninvited.map((u) => `/c/${u}`).join(', ')} could not be
            reached — check the address and invite them below. This event is invite-only, so until
            somebody is invited, nobody outside your clan can see it.
          </div>
        </div>
      )}
      <AccessPanel eventId={id} />
      <CoHostPanel eventId={id} initial={cohosts} cashPolicy={event.cashPolicy} settlement={settlement} />
      <TeamsDraftClient
        event={event}
        tiles={eventTiles}
        teams={safeTeams}
        players={eventPlayers}
        completions={eventCompletions}
        editLocked={eventEditLocked(event)}
      />
    </>
  );
}

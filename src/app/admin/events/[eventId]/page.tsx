import { db } from '@/db';
import { events, tiles, teams, completions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { verifyUser } from '@/lib/auth';
import OverviewClient from './OverviewClient';
import EventEditorsPanel from './EventEditorsPanel';
import SaveAsPresetButton from '@/components/SaveAsPresetButton';
import { getTierBands } from '@/lib/pluginConfig';
import { parseContributionSnapshot } from '@/lib/statTracking';
import { getEventStartReadiness } from '@/lib/eventLifecycle';
import { startBlockerLabel } from '@/lib/eventReadiness';

export const dynamic = 'force-dynamic';

export default async function EventOverviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const [eventTiles, eventTeams, tierBands] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, id)),
    db.select().from(teams).where(eq(teams.eventId, id)),
    getTierBands(),
  ]);

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

  const session = await verifyUser();
  const isAdmin = session?.role === 'admin';

  // Start safeguard status: an event that hasn't gone live yet but isn't startable gets a warning
  // banner (and "held" once the scheduled start has actually been reached and deferred by the cron).
  const notStarted = !event.startNotified && !event.forceEndedAt;
  const readiness = notStarted ? await getEventStartReadiness(event.id, event.draftStatus) : null;
  const showStartWarning = readiness != null && !readiness.ready;
  const held = showStartWarning && event.startHoldNotified === 1;

  return (
    <>
      {showStartWarning && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          <div className="font-semibold">
            {held ? '⏸ Start is being held' : '⚠ Not ready to start'}
          </div>
          <p className="mt-1 text-sm">
            {held
              ? 'The scheduled start time was reached, but the event is being held back until it is ready:'
              : 'This event will not go live (scheduled or via "Start now") until:'}
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {readiness.blockers.map((b) => (
              <li key={b}>{startBlockerLabel(b)}</li>
            ))}
          </ul>
          {readiness.unassignedPlayerCount > 0 && (
            <p className="mt-2 text-sm text-amber-200/70">
              Heads up: {readiness.unassignedPlayerCount} signed-up player
              {readiness.unassignedPlayerCount === 1 ? ' has' : 's have'} no team yet.
            </p>
          )}
        </div>
      )}
      <OverviewClient
        event={event}
        tiles={eventTiles}
        teams={eventTeams}
        completions={eventCompletions}
      />
      {isAdmin && (
        <div className="mt-8 max-w-2xl">
          <EventEditorsPanel eventId={event.id} />
        </div>
      )}
      {isAdmin && <SaveAsPresetButton eventId={event.id} defaultName={event.name} />}
    </>
  );
}

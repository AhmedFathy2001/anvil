import { db } from '@/db';
import { events, tiles, teams, completions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { verifyUser } from '@/lib/auth';
import OverviewClient from './OverviewClient';
import SaveAsPresetButton from '@/components/SaveAsPresetButton';
import { getTierBands } from '@/lib/pluginConfig';
import { parseContributionSnapshot } from '@/lib/statTracking';

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

  return (
    <>
      <OverviewClient
        event={event}
        tiles={eventTiles}
        teams={eventTeams}
        completions={eventCompletions}
      />
      {isAdmin && <SaveAsPresetButton eventId={event.id} defaultName={event.name} />}
    </>
  );
}

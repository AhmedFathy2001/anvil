import { db } from '@/db';
import { events, tiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import TilesClient from './TilesClient';
import { getTierBands } from '@/lib/pluginConfig';
import { verifyUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function EventTilesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const [eventTiles, tierBands, user] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, id)),
    getTierBands(),
    verifyUser(),
  ]);

  return (
    <TilesClient
      event={event}
      tiles={eventTiles}
      tierBands={tierBands}
      isAdmin={user?.role === 'admin'}
    />
  );
}

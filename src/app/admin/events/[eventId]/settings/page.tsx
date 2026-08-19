import { db } from '@/db';
import { requireEventForPage } from '@/lib/eventScope';
import { events, tiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { verifyUser } from '@/lib/auth';
import SettingsClient from './SettingsClient';
import SaveAsPresetButton from '@/components/SaveAsPresetButton';
import { atLeast } from '@/lib/clanRoles';

export const dynamic = 'force-dynamic';

/**
 * Everything about an event you set once and then stop thinking about: its shape, its dates, when
 * tiles open, who may edit the board — plus the destructive corner (clone, delete).
 *
 * These used to sit at the top of the Overview, above the live board, which meant the surface you
 * check ten times a day opened on a configuration form.
 */
export default async function EventSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  await requireEventForPage(id);
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const [eventTiles, session] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, id)),
    verifyUser(),
  ]);
  const isAdmin = atLeast(session?.role, 'admin');

  return (
    <>
      <SettingsClient event={event} tiles={eventTiles} canManageEditors={isAdmin} />
      {isAdmin && <SaveAsPresetButton eventId={event.id} defaultName={event.name} />}
    </>
  );
}

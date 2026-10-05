import { db } from '@/db';
import { requireEventForParticipantPage } from '@/lib/eventScope';
import EventApiHost from '@/components/EventApiHost';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import DraftSpectatorClient from './DraftSpectatorClient';

export const dynamic = 'force-dynamic';

export default async function DraftSpectatorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  const { apiPrefix } = await requireEventForParticipantPage(id);
  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });
  if (!event) notFound();

  return (
    <>
      <EventApiHost eventId={event.id} prefix={apiPrefix} />
      <DraftSpectatorClient event={event} />
    </>
  );
}

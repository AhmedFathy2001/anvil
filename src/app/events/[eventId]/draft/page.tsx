import { db } from '@/db';
import { clientEvent } from '@/lib/clientRows';
import { requireEventForParticipantPage } from '@/lib/eventScope';
import EventApiHost from '@/components/EventApiHost';
import { events, teams } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
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
  // A captain here is not a spectator: the page says whose picks are theirs and where they make them.
  const user = await verifyUser();
  const captainOf = user
    ? await db.query.teams.findFirst({
        where: and(eq(teams.eventId, id), eq(teams.captainUserId, user.userId)),
        columns: { id: true, name: true },
      })
    : undefined;

  return (
    <>
      <EventApiHost eventId={event.id} prefix={apiPrefix} />
      <DraftSpectatorClient event={clientEvent(event)} captainOf={captainOf ?? null} />
    </>
  );
}

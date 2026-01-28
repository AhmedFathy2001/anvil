import { db } from '@/db';
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

  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });
  if (!event) notFound();

  return <DraftSpectatorClient event={event} />;
}

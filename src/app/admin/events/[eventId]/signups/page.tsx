import { db } from '@/db';
import { requireEventForPage } from '@/lib/eventScope';
import { requireClan } from '@/lib/clanContext';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { verifyAdminOrModerator } from '@/lib/auth';
import { getRequiredConfirmations } from '@/lib/feeConfirmations';
import SignupsClient from './SignupsClient';

export const dynamic = 'force-dynamic';

export default async function EventSignupsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const clan = await requireClan();
  const session = await verifyAdminOrModerator();
  if (!session) redirect('/admin');

  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  await requireEventForPage(id);
  const [event, confirmationsRequired] = await Promise.all([
    db.query.events.findFirst({ where: eq(events.id, id) }),
    getRequiredConfirmations(clan.id),
  ]);
  if (!event) notFound();

  return (
    <SignupsClient
      event={event}
      viewerRole={session.role}
      viewerId={session.userId}
      confirmationsRequired={confirmationsRequired}
    />
  );
}

import { db } from '@/db';
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
  const session = await verifyAdminOrModerator();
  if (!session) redirect('/admin');

  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const [event, confirmationsRequired] = await Promise.all([
    db.query.events.findFirst({ where: eq(events.id, id) }),
    getRequiredConfirmations(),
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

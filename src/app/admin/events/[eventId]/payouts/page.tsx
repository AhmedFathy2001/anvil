import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { verifyAdminOrModerator } from '@/lib/auth';
import PayoutsClient from './PayoutsClient';

export const dynamic = 'force-dynamic';

export default async function EventPayoutsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await verifyAdminOrModerator();
  if (!session) redirect('/admin');

  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  return <PayoutsClient eventId={id} viewerRole={session.role} />;
}

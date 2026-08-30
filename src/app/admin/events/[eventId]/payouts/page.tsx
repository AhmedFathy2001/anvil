import { db } from '@/db';
import { requireEventForPage } from '@/lib/eventScope';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { verifyEventTreasurer } from '@/lib/auth';
import PayoutsClient from './PayoutsClient';
import { clanHref } from '@/lib/clanPath';

export const dynamic = 'force-dynamic';

export default async function EventPayoutsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  // Per board, not per clan: this is the page a treasurer granted one event actually comes for.
  const session = await verifyEventTreasurer(id);
  if (!session) redirect(await clanHref('/admin'));

  // Scoped, not just fetched by id — see the layout above for what an unguarded read let through.
  await requireEventForPage(id);

  return <PayoutsClient eventId={id} viewerRole={session.role} />;
}

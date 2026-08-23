import { db } from '@/db';
import { requireEventForPage } from '@/lib/eventScope';
import { requireClan } from '@/lib/clanContext';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { verifyAdminOrModerator, verifyEventTreasurer } from '@/lib/auth';
import { getRequiredConfirmations } from '@/lib/feeConfirmations';
import SignupsClient from './SignupsClient';
import { clanHref } from '@/lib/clanPath';

export const dynamic = 'force-dynamic';

export default async function EventSignupsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  // Clan staff, or whoever runs THIS board's money — the fees they were granted live on this tab.
  const session = (await verifyAdminOrModerator()) ?? (await verifyEventTreasurer(id));
  if (!session) redirect(await clanHref('/admin'));

  // Settings are per clan, so the clan has to be resolved before anything reads one.
  const clan = await requireClan();

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

import { notFound } from 'next/navigation';

import EventPageHeader from '@/components/events/EventPageHeader';
import { verifyUser } from '@/lib/auth';
import { chatAccess } from '@/lib/eventChat';
import { requireEventForPage } from '@/lib/eventScope';
import ChatModClient from './ChatModClient';

export const dynamic = 'force-dynamic';

/**
 * Moderating one event's chat (the plugin's Feed tab chat): recent lines with Delete, timeouts, bans,
 * the people currently kept out, and pause. For the host clan's moderators and up, and Anvil staff.
 * Answered at the host's address only (requireEventForPage), and 404 to everyone else so it never
 * says which events exist.
 */
export default async function EventChatModerationPage({ params }: { params: Promise<{ eventId: string }> }) {
  const id = parseInt((await params).eventId, 10);
  const event = await requireEventForPage(id);
  const session = await verifyUser();
  const access = session ? await chatAccess(id, session.userId) : null;
  if (!access?.staff) notFound();

  return (
    <div className="max-w-4xl mx-auto">
      <EventPageHeader event={event} apiPrefix={null} active="chat" title="Event chat moderation" access={access}>
        The chat players use in the Anvil plugin&apos;s Feed tab. Deleting, timeouts and bans here are the same ones mods use by
        right-clicking a line in the plugin, and every action goes in the clan&apos;s audit log.
      </EventPageHeader>
      <ChatModClient eventId={id} />
    </div>
  );
}

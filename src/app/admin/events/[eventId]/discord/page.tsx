import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { eventCohosts, teams } from '@/db/schema';
import EventDiscordServerPanel from '@/components/EventDiscordServerPanel';
import { requireEventForPage } from '@/lib/eventScope';
import EventWebhooksPanel from '../teams/EventWebhooksPanel';
import EventDiscordClient from './EventDiscordClient';

export const dynamic = 'force-dynamic';

/**
 * Everything this event does in Discord, in one place: what posts where (on top of the clan's
 * defaults), the event's team channels and roles, an event server for co-hosted boards, and extra
 * channels that get a copy.
 */
export default async function EventDiscordPage({ params }: { params: Promise<{ eventId: string }> }) {
  const id = parseInt((await params).eventId, 10);
  await requireEventForPage(id);
  const [eventTeams, cohosts] = await Promise.all([
    db.select({ id: teams.id, name: teams.name, color: teams.color }).from(teams).where(eq(teams.eventId, id)),
    db.select({ id: eventCohosts.id }).from(eventCohosts).where(and(eq(eventCohosts.eventId, id), eq(eventCohosts.status, 'accepted'))),
  ]);

  return (
    <div className="space-y-8">
      <EventDiscordClient eventId={id} hasCohosts={cohosts.length > 0} />
      <EventDiscordServerPanel eventId={id} />
      <EventWebhooksPanel eventId={id} teams={eventTeams} />
    </div>
  );
}

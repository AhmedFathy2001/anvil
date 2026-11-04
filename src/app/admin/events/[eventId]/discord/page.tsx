import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { eventCohosts, teams } from '@/db/schema';
import EventDiscordServerPanel from '@/components/EventDiscordServerPanel';
import { requireEventForPage } from '@/lib/eventScope';
import EventWebhooksPanel from '../teams/EventWebhooksPanel';
import EventChatFeedCard from './EventChatFeedCard';
import EventDiscordClient from './EventDiscordClient';
import EventDiscordInventory from './EventDiscordInventory';
import { requireClan } from '@/lib/clanContext';
import { isCreatorSpace } from '@/lib/creatorSpaces';

export const dynamic = 'force-dynamic';

/**
 * Everything this event does in Discord, in one place: what Anvil made in the clan's server right now
 * (and the fixes for it), what posts where (on top of the clan's
 * defaults), the event's team channels and roles, an event server for co-hosted boards, and extra
 * channels that get a copy.
 */
export default async function EventDiscordPage({ params }: { params: Promise<{ eventId: string }> }) {
  const id = parseInt((await params).eventId, 10);
  await requireEventForPage(id);
  const creator = isCreatorSpace(await requireClan());
  const [eventTeams, cohosts] = await Promise.all([
    db.select({ id: teams.id, name: teams.name, color: teams.color }).from(teams).where(eq(teams.eventId, id)),
    db.select({ id: eventCohosts.id }).from(eventCohosts).where(and(eq(eventCohosts.eventId, id), eq(eventCohosts.status, 'accepted'))),
  ]);

  return (
    <div className="space-y-8">
      <EventDiscordInventory eventId={id} />
      {/* A creator space never co-hosts (lib/coHost coHostKindRefusal): no co-host posts, no joint server. */}
      <EventDiscordClient eventId={id} hasCohosts={!creator && cohosts.length > 0} />
      <EventChatFeedCard eventId={id} creator={creator} />
      {!creator && <EventDiscordServerPanel eventId={id} />}
      <EventWebhooksPanel eventId={id} teams={eventTeams} />
    </div>
  );
}

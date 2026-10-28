import { db } from '@/db';
import { requireEventForParticipantPage } from '@/lib/eventScope';
import EventApiHost from '@/components/EventApiHost';
import { events, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { verifyUser } from '@/lib/auth';
import { isEventEnded } from '@/lib/survey';
import { getEventRecap } from '@/lib/eventRecap';
import { allMomentsForEvent } from '@/lib/momentsStore';
import { momentsByTeam, summariseMoments, withSubmittedDrops } from '@/lib/momentsAnalytics';
import { submittedDropsForEvent } from '@/lib/submittedDrops';
import RecapClient from './RecapClient';
import MomentsSummaryPanel from './MomentsSummaryPanel';
import { atLeast } from '@/lib/clanRoles';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-xl mx-auto mt-10 border border-dashed border-card-border rounded-xl p-8 text-center">
      <p className="text-lg font-semibold mb-1">{title}</p>
      {children && <div className="text-sm text-text-muted">{children}</div>}
    </div>
  );
}

export default async function EventRecapPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  const { apiPrefix } = await requireEventForParticipantPage(id);
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const header = (
    <div className="mb-6">
      <EventApiHost eventId={id} prefix={apiPrefix} />
      <ClanLink href={`/events/${id}`} className="text-sm text-text-muted hover:text-gold transition-colors">← {event.name}</ClanLink>
      <div className="flex items-center justify-between gap-3 flex-wrap mt-1">
        <h1 className="text-2xl font-bold text-gold">Event recap</h1>
        <div className="flex items-center gap-4">
          <ClanLink href={`/events/${id}/wrapped`} className="text-sm text-text-muted hover:text-gold transition-colors">🎁 Wrapped cards →</ClanLink>
          <ClanLink href={`/events/${id}/stats`} className="text-sm text-text-muted hover:text-gold transition-colors">📊 Full stats →</ClanLink>
        </div>
      </div>
    </div>
  );

  const ended = isEventEnded(event);
  const session = await verifyUser();
  // The role is the ADDRESSED clan's — a co-host's staff are staff over there, not of this event.
  const isStaff =
    !apiPrefix && (atLeast(session?.role, 'admin') || session?.role === 'treasurer' || session?.role === 'moderator');

  // The recap opens to everyone once the event ends; staff can peek early to see what players will get.
  if (!ended && !isStaff) {
    return (
      <div>{header}
        <Notice title="The recap isn’t ready yet">The awards are handed out once this event ends. Check back then.</Notice>
      </div>
    );
  }

  const [recap, reported, drops] = await Promise.all([getEventRecap(id), allMomentsForEvent(id), submittedDropsForEvent(id)]);
  // The plugin's feed plus every credited drop it never reported — a mega rare proven by a
  // screenshot on the site belongs in "value seen" as much as one the plugin saw.
  const feed = withSubmittedDrops(reported, drops);
  const summary = summariseMoments(feed);

  // The same feed, split by the side each moment was stamped with. Named here (the analytics layer
  // deals in ids) so a clan-v-clan recap can answer "which side" without a second query per team.
  const eventTeams = await db
    .select({ id: teams.id, name: teams.name, color: teams.color })
    .from(teams)
    .where(eq(teams.eventId, id));
  const teamById = new Map(eventTeams.map((t) => [t.id, t]));
  const sides = momentsByTeam(feed)
    .map((s) => {
      const team = teamById.get(s.teamId);
      return team ? { teamId: s.teamId, name: team.name, color: team.color, summary: s.summary } : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  const gains = recap?.gains ?? [];
  const panel = <MomentsSummaryPanel summary={summary} sides={sides} gains={gains} teams={eventTeams} />;
  const hasNumbers = summary.counts.total > 0 || gains.length > 0;
  if (!recap || recap.awards.length === 0) {
    // No superlatives doesn't mean nothing happened — a board can produce a feed full of deaths and
    // drops without anyone qualifying for an award, and that's still the story of the week.
    return (
      <div>{header}
        <Notice title="No awards to hand out">
          {ended ? 'Nobody racked up any tracked activity this event.' : 'No tracked activity yet — awards fill in as players submit.'}
        </Notice>
        {hasNumbers && <div className="mt-8">{panel}</div>}
      </div>
    );
  }

  return (
    <div>
      {header}
      <RecapClient
        recap={recap}
        preview={!ended}
        momentsPanel={panel}
      />
    </div>
  );
}

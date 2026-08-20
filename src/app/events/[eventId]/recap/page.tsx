import { db } from '@/db';
import { requireEventForPage } from '@/lib/eventScope';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { verifyUser } from '@/lib/auth';
import { isEventEnded } from '@/lib/survey';
import { getEventRecap } from '@/lib/eventRecap';
import { allMomentsForEvent } from '@/lib/momentsStore';
import { summariseMoments } from '@/lib/momentsAnalytics';
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
  await requireEventForPage(id);
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const header = (
    <div className="mb-6">
      <ClanLink href={`/events/${id}`} className="text-sm text-text-muted hover:text-gold transition-colors">← {event.name}</ClanLink>
      <h1 className="text-2xl font-bold text-gold mt-1">Event recap</h1>
    </div>
  );

  const ended = isEventEnded(event);
  const session = await verifyUser();
  const isStaff = atLeast(session?.role, 'admin') || session?.role === 'treasurer' || session?.role === 'moderator';

  // The recap opens to everyone once the event ends; staff can peek early to see what players will get.
  if (!ended && !isStaff) {
    return (
      <div>{header}
        <Notice title="The recap isn’t ready yet">The awards are handed out once this event ends. Check back then.</Notice>
      </div>
    );
  }

  const [recap, feed] = await Promise.all([getEventRecap(id), allMomentsForEvent(id)]);
  const summary = summariseMoments(feed);
  if (!recap || recap.awards.length === 0) {
    // No superlatives doesn't mean nothing happened — a board can produce a feed full of deaths and
    // drops without anyone qualifying for an award, and that's still the story of the week.
    return (
      <div>{header}
        <Notice title="No awards to hand out">
          {ended ? 'Nobody racked up any tracked activity this event.' : 'No tracked activity yet — awards fill in as players submit.'}
        </Notice>
        {summary.counts.total > 0 && (
          <div className="mt-8">
            <MomentsSummaryPanel summary={summary} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {header}
      <RecapClient
        recap={recap}
        preview={!ended}
        momentsPanel={<MomentsSummaryPanel summary={summary} />}
      />
    </div>
  );
}

import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { isTileRaceFormat, isPointsMode, eventShapeBadge } from '@/lib/utils';
import { verifyUser } from '@/lib/auth';
import { isEventEditor, isEventTreasurer } from '@/lib/eventEditors';
import EventTabNav from './EventTabNav';
import EventTitle from './EventTitle';
import EventLockBanner from './EventLockBanner';
import EventLifecycleBar from './EventLifecycleBar';
import { isEventOver, eventEditLocked } from '@/lib/eventLock';
import { lifecycleSteps, eventStage } from '@/lib/eventStage';
import { getStageCounts } from '@/lib/eventStageCounts';
import { eventRailGroups } from '@/lib/eventRail';
import { authoringModel } from '@/lib/tileAuthoring';
import AdminSidebar from '@/app/admin/_components/AdminSidebar';

export const dynamic = 'force-dynamic';

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const session = await verifyUser();
  const isEditor = session?.role === 'editor';
  // Board-scoped editors may only open events they hold a grant for. A non-granted event bounces
  // back to their (already-filtered) events list — the coarse middleware gate lets any editor reach
  // the tiles route, so this server-side check is what actually enforces per-board scoping.
  if (session?.role === 'editor' && session.editorScope === 'assigned') {
    if (!(await isEventEditor(session.userId, id))) redirect('/admin/events');
  }
  // Same rule for a board treasurer: middleware only knows they're scoped, not to WHICH boards.
  const isBoardTreasurer = session?.role === 'treasurer' && session.treasurerScope === 'assigned';
  if (isBoardTreasurer) {
    if (!(await isEventTreasurer(session!.userId, id))) redirect('/admin/events');
  }

  // Same per-request cache the rail reads, so the two strips never disagree and never double-query.
  const stageCounts = await getStageCounts(id);
  // What this board calls its entries, so the lifecycle step and the tab agree with the page.
  const { NounPlural, noun, nounPlural } = authoringModel(event);
  const steps = lifecycleSteps({ ...event, taskNounPlural: NounPlural }, stageCounts);
  const tileCount = { c: stageCounts.tileCount };
  const teamCount = { c: stageCounts.teamCount };

  const now = new Date();
  const isForceEnded = !!event.forceEndedAt;
  const eventStarted = event.startDate ? new Date(event.startDate) <= now : false;
  const eventEnded = event.endDate ? new Date(event.endDate) <= now : false;
  const isDraft = !isForceEnded && !event.startDate;
  const isActive = eventStarted && !eventEnded;
  const raceFormat = isTileRaceFormat(event.format);
  const pointsMode = isPointsMode(event.scoringMode);

  const status = isForceEnded
    ? { label: 'Force-Ended', cls: 'bg-red-500/15 text-red-400 border-red-500/25' }
    : eventEnded
      ? { label: 'Ended', cls: 'bg-text-muted/15 text-text-muted border-text-muted/25' }
      : isDraft
        ? { label: 'Draft', cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25' }
        : isActive
          ? { label: 'Active', cls: 'bg-accent-green/15 text-accent-green-light border-accent-green/25' }
          : { label: 'Upcoming', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' };

  // The rail lives HERE, not in the admin shell: this layout re-renders when the event id changes,
  // a parent layout doesn't. Rendering it from the shell meant walking from one event to another
  // left you looking at the first one's rail.
  const rail = eventRailGroups({
    eventId: id,
    stage: eventStage(event),
    counts: stageCounts,
    tilesOnly: isEditor,
    moneyOnly: isBoardTreasurer,
    taskNounPlural: nounPlural,
  });

  return (
    <div className="lg:flex lg:gap-6">
      <AdminSidebar
        scope="event"
        groups={rail}
        header={{ title: event.name, subtitle: eventShapeBadge(event.format, event.scoringMode, event.boardSize, event.rules) }}
      />
      <div className="flex-1 min-w-0">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-4"
      >
        &larr; All events
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <EventTitle eventId={id} initialName={event.name} canEdit={session?.role === 'admin'} />
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${status.cls}`}>
          {status.label}
        </span>
      </div>

      <div className="flex items-center gap-2.5 text-sm text-text-muted mb-6 flex-wrap">
        <span className="bg-gold/15 text-gold px-2 py-0.5 rounded-full text-xs font-medium">
          {eventShapeBadge(event.format, event.scoringMode, event.boardSize, event.rules)}
        </span>
        {raceFormat && (
          <span className="bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full text-xs font-medium">
            Tile race
          </span>
        )}
        {pointsMode && (
          <span className="bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded-full text-xs font-medium">
            Points
          </span>
        )}
        <span>{tileCount.c} {tileCount.c === 1 ? noun : nounPlural}</span>
        <span>·</span>
        <span>{teamCount.c} team{teamCount.c !== 1 ? 's' : ''}</span>
      </div>

      {/* The event's own rail (rendered by the admin shell) carries navigation now; this strip
          answers the other question — where the event is in its life, and what moves it forward. */}
      {!isEditor && !isBoardTreasurer && (
        <EventLifecycleBar
          steps={steps}
          hrefFor={{
            built: `/admin/events/${id}/settings`,
            tiles: `/admin/events/${id}/tiles`,
            teams: `/admin/events/${id}/teams`,
            running: `/admin/events/${id}`,
            results: `/admin/events/${id}/stats`,
            payouts: `/admin/events/${id}/payouts`,
          }}
        />
      )}
      {isEditor && <EventTabNav eventId={id} tilesOnly taskNounPlural={NounPlural} />}
      {isBoardTreasurer && <EventTabNav eventId={id} moneyOnly taskNounPlural={NounPlural} />}

      {/* Finished events are read-only (lib/eventLock guards the APIs) — say so on every tab, and
          give admins the explicit unlock/re-lock control. */}
      {isEventOver(event) && (
        <EventLockBanner eventId={id} locked={eventEditLocked(event)} canToggle={session?.role === 'admin'} />
      )}

      {children}
      </div>
    </div>
  );
}

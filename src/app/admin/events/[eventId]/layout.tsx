import { db } from '@/db';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { isTileRaceFormat, isPointsMode, eventShapeBadge } from '@/lib/utils';
import { verifyUser } from '@/lib/auth';
import { isEventEditor } from '@/lib/eventEditors';
import EventTabNav from './EventTabNav';
import EventTitle from './EventTitle';
import EventLockBanner from './EventLockBanner';
import EventLifecycleBar from './EventLifecycleBar';
import { isEventOver, eventEditLocked } from '@/lib/eventLock';
import { lifecycleSteps } from '@/lib/eventStage';
import { getStageCounts } from '@/lib/eventStageCounts';

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

  // Same per-request cache the rail reads, so the two strips never disagree and never double-query.
  const stageCounts = await getStageCounts(id);
  const steps = lifecycleSteps(event, stageCounts);
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

  return (
    <div>
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
        <span>{tileCount.c} tiles</span>
        <span>·</span>
        <span>{teamCount.c} team{teamCount.c !== 1 ? 's' : ''}</span>
      </div>

      {/* The event's own rail (rendered by the admin shell) carries navigation now; this strip
          answers the other question — where the event is in its life, and what moves it forward. */}
      {!isEditor && <EventLifecycleBar steps={steps} eventId={id} />}
      {isEditor && <EventTabNav eventId={id} tilesOnly />}

      {/* Finished events are read-only (lib/eventLock guards the APIs) — say so on every tab, and
          give admins the explicit unlock/re-lock control. */}
      {isEventOver(event) && (
        <EventLockBanner eventId={id} locked={eventEditLocked(event)} canToggle={session?.role === 'admin'} />
      )}

      {children}
    </div>
  );
}

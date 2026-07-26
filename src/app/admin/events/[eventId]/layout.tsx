import { db } from '@/db';
import { events, tiles, teams } from '@/db/schema';
import { eq, count } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { isTileRaceFormat, isPointsMode, eventShapeBadge } from '@/lib/utils';
import { verifyUser } from '@/lib/auth';
import EventTabNav from './EventTabNav';

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

  const [[tileCount], [teamCount]] = await Promise.all([
    db.select({ c: count() }).from(tiles).where(eq(tiles.eventId, id)),
    db.select({ c: count() }).from(teams).where(eq(teams.eventId, id)),
  ]);

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
        <h1 className="text-2xl sm:text-3xl font-bold text-gold">{event.name}</h1>
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

      <EventTabNav eventId={id} tilesOnly={isEditor} />

      {children}
    </div>
  );
}

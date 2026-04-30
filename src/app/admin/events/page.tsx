import Link from 'next/link';
import { db } from '@/db';
import { events, teams } from '@/db/schema';
import { count, desc } from 'drizzle-orm';
import LocalTime from '@/components/LocalTime';
import CreateEventToggle from './CreateEventToggle';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  const allEvents = await db.select().from(events).orderBy(desc(events.createdAt));
  const teamCounts = new Map<number, number>();
  if (allEvents.length > 0) {
    const counts = await db
      .select({ eventId: teams.eventId, count: count() })
      .from(teams)
      .groupBy(teams.eventId);
    for (const row of counts) teamCounts.set(row.eventId, row.count);
  }

  const now = new Date().toISOString();
  const active = allEvents.filter((e) => {
    if (e.forceEndedAt) return false;
    if (e.endDate && e.endDate < now) return false;
    return true;
  });
  const past = allEvents.filter((e) => !!e.forceEndedAt || (!!e.endDate && e.endDate < now));

  return (
    <div>
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">Events</h1>
          <p className="text-text-muted text-sm">
            {allEvents.length} total · {active.length} active · {past.length} past
          </p>
        </div>
        <CreateEventToggle />
      </header>

      <section className="mb-8">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-accent-green rounded-full" />
          Active
        </h2>
        {active.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-card-border rounded-xl text-sm text-text-muted">
            No active events. Create one with the &ldquo;New event&rdquo; button.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map((e) => (
              <EventCard key={e.id} event={e} teamCount={teamCounts.get(e.id) ?? 0} active />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <span className="w-1 h-5 bg-text-muted rounded-full" />
            Past
            <span className="text-xs text-text-muted/60 font-normal">({past.length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((e) => (
              <EventCard key={e.id} event={e} teamCount={teamCounts.get(e.id) ?? 0} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EventCard({
  event,
  teamCount,
  active,
}: {
  event: typeof events.$inferSelect;
  teamCount: number;
  active?: boolean;
}) {
  return (
    <Link
      href={`/admin/events/${event.id}`}
      className={`group block border rounded-xl p-4 transition-all ${
        active
          ? 'border-card-border bg-card-bg hover:border-gold/40 hover:bg-card-bg-hover'
          : 'border-card-border/60 bg-card-bg/50 hover:border-gold/30'
      }`}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <h3
          className={`font-semibold group-hover:text-gold transition-colors ${
            active ? 'text-foreground' : 'text-text-muted'
          }`}
        >
          {event.name}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          {event.forceEndedAt ? (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
              Force-ended
            </span>
          ) : !active ? (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-text-muted/15 text-text-muted">
              Done
            </span>
          ) : null}
          <span className="text-xs bg-gold/15 text-gold/90 px-2 py-0.5 rounded-full font-medium">
            {event.boardSize}×{event.boardSize}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span>
          {teamCount} team{teamCount !== 1 ? 's' : ''}
        </span>
        <span>·</span>
        <span>{event.boardSize * event.boardSize} tiles</span>
      </div>
      {event.startDate && event.endDate && (
        <p className="text-[10px] text-text-muted/70 mt-2">
          <LocalTime date={event.startDate} format="date" /> — <LocalTime date={event.endDate} format="date" />
        </p>
      )}
    </Link>
  );
}

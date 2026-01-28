import Link from 'next/link';
import { db } from '@/db';
import { events, teams } from '@/db/schema';
import { desc, eq, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const allEvents = await db.select().from(events).orderBy(desc(events.createdAt));

  // Get team counts per event
  const teamCounts = new Map<number, number>();
  if (allEvents.length > 0) {
    const counts = await db
      .select({ eventId: teams.eventId, count: count() })
      .from(teams)
      .groupBy(teams.eventId);
    for (const row of counts) {
      teamCounts.set(row.eventId, row.count);
    }
  }

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-gold mb-2">OSRS Bingo Tracker</h1>
        <p className="text-text-muted">Track your clan bingo events and compete with teams</p>
      </div>

      {allEvents.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-card-border rounded-xl">
          <p className="text-text-muted text-lg mb-2">No events yet</p>
          <p className="text-text-muted text-sm">
            Log in as <Link href="/admin" className="text-gold hover:underline">admin</Link> to create one.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allEvents.map((event) => {
            const numTeams = teamCounts.get(event.id) || 0;
            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group border border-card-border rounded-xl p-5 bg-card-bg hover:border-gold/40 hover:bg-card-bg-hover hover:shadow-lg hover:shadow-gold/5 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <h2 className="font-bold text-lg text-foreground group-hover:text-gold transition-colors">
                    {event.name}
                  </h2>
                  <span className="text-xs bg-gold/15 text-gold px-2 py-0.5 rounded-full font-medium">
                    {event.boardSize}x{event.boardSize}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-text-muted">
                  <span>{numTeams} team{numTeams !== 1 ? 's' : ''}</span>
                  <span>{event.boardSize * event.boardSize} tiles</span>
                </div>
                <p className="text-xs text-text-muted mt-3">
                  Created {new Date(event.createdAt).toLocaleDateString()}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

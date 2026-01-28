import Link from 'next/link';
import { db } from '@/db';
import { events, teams } from '@/db/schema';
import { desc, eq, count } from 'drizzle-orm';
import EventForm from '@/components/EventForm';
import DiscordSettings from '@/components/DiscordSettings';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const allEvents = await db.select().from(events).orderBy(desc(events.createdAt));

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gold">Admin Dashboard</h1>
          <p className="text-text-muted text-sm mt-1">Manage events, teams, and tiles</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2 items-start">
        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Events
          </h2>
          {allEvents.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-card-border rounded-xl">
              <p className="text-text-muted">No events yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allEvents.map((event) => {
                const numTeams = teamCounts.get(event.id) || 0;
                return (
                  <Link
                    key={event.id}
                    href={`/admin/events/${event.id}`}
                    className="group flex items-center justify-between border border-card-border rounded-xl p-4 bg-card-bg hover:border-gold/40 hover:bg-card-bg-hover transition-all"
                  >
                    <div>
                      <span className="font-semibold group-hover:text-gold transition-colors">
                        {event.name}
                      </span>
                      <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                        <span className="bg-gold/15 text-gold px-1.5 py-0.5 rounded-full">
                          {event.boardSize}x{event.boardSize}
                        </span>
                        <span>{numTeams} team{numTeams !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <span className="text-text-muted text-sm group-hover:text-gold transition-colors">→</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-gold rounded-full" />
              Create Event
            </h2>
            <div className="border border-card-border rounded-xl p-5 bg-card-bg">
              <EventForm />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-gold rounded-full" />
              Discord Integration
            </h2>
            <div className="border border-card-border rounded-xl p-5 bg-card-bg">
              <DiscordSettings />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

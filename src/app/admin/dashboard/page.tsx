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

  const now = new Date().toISOString();

  const activeEvents = allEvents.filter((e) => {
    if (e.forceEndedAt) return false;
    if (e.endDate && e.endDate < now) return false;
    return true;
  });

  const pastEvents = allEvents.filter((e) => {
    return !!e.forceEndedAt || (!!e.endDate && e.endDate < now);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gold">Admin Dashboard</h1>
          <p className="text-text-muted text-sm mt-1">Manage events, teams, and tiles</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex gap-3 mb-6">
        <Link
          href="/admin/players"
          className="px-4 py-2 text-sm border border-card-border rounded-lg bg-card-bg hover:border-gold/40 hover:bg-card-bg-hover transition-all flex items-center gap-2"
        >
          <span className="text-gold">👥</span>
          Player Pool
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-2 items-start">
        <div>
          {/* Active Events */}
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-accent-green rounded-full" />
            Active Events
          </h2>
          {activeEvents.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-card-border rounded-xl mb-6">
              <p className="text-text-muted">No active events. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-2 mb-6">
              {activeEvents.map((event) => {
                const numTeams = teamCounts.get(event.id) || 0;
                const hasStarted = event.startDate && event.startDate <= now;
                return (
                  <Link
                    key={event.id}
                    href={`/admin/events/${event.id}`}
                    className="group flex items-center justify-between border border-card-border rounded-xl p-4 bg-card-bg hover:border-gold/40 hover:bg-card-bg-hover transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold group-hover:text-gold transition-colors">
                          {event.name}
                        </span>
                        {hasStarted ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent-green/15 text-accent-green-light">
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                            Upcoming
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                        <span className="bg-gold/15 text-gold px-1.5 py-0.5 rounded-full">
                          {event.boardSize}x{event.boardSize}
                        </span>
                        <span>{numTeams} team{numTeams !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <span className="text-text-muted text-sm group-hover:text-gold transition-colors">&rarr;</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-text-muted rounded-full" />
                Event History
              </h2>
              <div className="space-y-2">
                {pastEvents.map((event) => {
                  const numTeams = teamCounts.get(event.id) || 0;
                  return (
                    <Link
                      key={event.id}
                      href={`/admin/events/${event.id}`}
                      className="group flex items-center justify-between border border-card-border/60 rounded-xl p-4 bg-card-bg/60 hover:border-gold/30 hover:bg-card-bg-hover transition-all"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text-muted group-hover:text-gold transition-colors">
                            {event.name}
                          </span>
                          {event.forceEndedAt ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
                              Force-Ended
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-text-muted/15 text-text-muted">
                              Completed
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                          <span className="bg-gold/10 text-gold/70 px-1.5 py-0.5 rounded-full">
                            {event.boardSize}x{event.boardSize}
                          </span>
                          <span>{numTeams} team{numTeams !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <span className="text-text-muted text-sm group-hover:text-gold transition-colors">&rarr;</span>
                    </Link>
                  );
                })}
              </div>
            </>
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

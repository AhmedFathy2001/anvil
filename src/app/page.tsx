import Link from 'next/link';
import { db } from '@/db';
import { events, teams, tiles, completions, submissions, players } from '@/db/schema';
import { desc, eq, count, inArray } from 'drizzle-orm';
import LocalTime from '@/components/LocalTime';

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

  const now = new Date().toISOString();

  // Split into active and past events
  const activeEvents = allEvents.filter((e) => {
    if (e.forceEndedAt) return false;
    if (e.endDate && e.endDate < now) return false;
    return true;
  });

  const pastEvents = allEvents.filter((e) => {
    return !!e.forceEndedAt || (!!e.endDate && e.endDate < now);
  });

  // Batch-fetch data for past events (avoid N+1 queries)
  const pastEventIds = pastEvents.map(e => e.id);
  const pastEventWinners = new Map<number, { teamName: string; teamColor: string; tilesCompleted: number }>();
  const pastEventContributors = new Map<number, { name: string; totalAmount: number }[]>();

  if (pastEventIds.length > 0) {
    const allPastTeams = await db.select().from(teams).where(inArray(teams.eventId, pastEventIds));
    const allPastTiles = await db.select().from(tiles).where(inArray(tiles.eventId, pastEventIds));
    const allPastTileIds = allPastTiles.map(t => t.id);
    const allPastCompletions = allPastTileIds.length > 0
      ? await db.select().from(completions).where(inArray(completions.tileId, allPastTileIds))
      : [];
    const allPastSubmissions = allPastTileIds.length > 0
      ? await db.select().from(submissions).where(inArray(submissions.tileId, allPastTileIds))
      : [];
    const allPastPlayers = await db.select().from(players).where(inArray(players.eventId, pastEventIds));

    // Group by eventId
    const teamsByEvent = new Map<number, typeof allPastTeams>();
    for (const t of allPastTeams) {
      const list = teamsByEvent.get(t.eventId) || [];
      list.push(t);
      teamsByEvent.set(t.eventId, list);
    }
    const tilesByEvent = new Map<number, typeof allPastTiles>();
    for (const t of allPastTiles) {
      const list = tilesByEvent.get(t.eventId) || [];
      list.push(t);
      tilesByEvent.set(t.eventId, list);
    }
    const tileEventMap = new Map(allPastTiles.map(t => [t.id, t.eventId]));
    const completionsByEvent = new Map<number, typeof allPastCompletions>();
    for (const c of allPastCompletions) {
      const eventId = tileEventMap.get(c.tileId);
      if (eventId == null) continue;
      const list = completionsByEvent.get(eventId) || [];
      list.push(c);
      completionsByEvent.set(eventId, list);
    }
    const submissionsByEvent = new Map<number, typeof allPastSubmissions>();
    for (const s of allPastSubmissions) {
      const eventId = tileEventMap.get(s.tileId);
      if (eventId == null) continue;
      const list = submissionsByEvent.get(eventId) || [];
      list.push(s);
      submissionsByEvent.set(eventId, list);
    }
    const playersByEvent = new Map<number, typeof allPastPlayers>();
    for (const p of allPastPlayers) {
      const list = playersByEvent.get(p.eventId) || [];
      list.push(p);
      playersByEvent.set(p.eventId, list);
    }

    for (const event of pastEvents) {
      const eventTeams = teamsByEvent.get(event.id) || [];
      const eventTiles = tilesByEvent.get(event.id) || [];
      const eventCompletions = completionsByEvent.get(event.id) || [];

      if (eventTiles.length === 0 || eventTeams.length === 0) continue;

      // Winner
      let bestTeam: { teamName: string; teamColor: string; tilesCompleted: number } | null = null;
      for (const team of eventTeams) {
        const teamCount = eventCompletions.filter(c => c.teamId === team.id).length;
        if (!bestTeam || teamCount > bestTeam.tilesCompleted) {
          bestTeam = { teamName: team.name, teamColor: team.color, tilesCompleted: teamCount };
        }
      }
      if (bestTeam && bestTeam.tilesCompleted > 0) {
        pastEventWinners.set(event.id, bestTeam);
      }

      // Top contributors
      const eventSubmissions = submissionsByEvent.get(event.id) || [];
      const playerTotals = new Map<number, number>();
      for (const s of eventSubmissions) {
        if (s.creditPlayerId) {
          playerTotals.set(s.creditPlayerId, (playerTotals.get(s.creditPlayerId) || 0) + s.amount);
        }
      }

      if (playerTotals.size > 0) {
        const topPlayerIds = [...playerTotals.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        const eventPlayers = playersByEvent.get(event.id) || [];
        const playerMap = new Map(eventPlayers.map(p => [p.id, p.name]));

        const topContributors = topPlayerIds.map(([playerId, totalAmount]) => ({
          name: playerMap.get(playerId) || 'Unknown',
          totalAmount,
        }));

        pastEventContributors.set(event.id, topContributors);
      }
    }
  }

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-gold mb-2">Anvil</h1>
        <p className="text-text-muted">Where your clan&apos;s bingos, SotW/BotW, and roster come together.</p>
      </div>

      {allEvents.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-card-border rounded-xl">
          <p className="text-text-muted text-lg mb-2">No events yet</p>
          <p className="text-text-muted text-sm">
            Log in as <Link href="/admin" className="text-gold hover:underline">admin</Link> to create one.
          </p>
        </div>
      ) : (
        <>
          {/* Active Events */}
          {activeEvents.length > 0 && (
            <div className="mb-10">
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-accent-green rounded-full" />
                Active Events
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeEvents.map((event) => {
                  const numTeams = teamCounts.get(event.id) || 0;
                  return (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="group border border-card-border rounded-xl p-5 bg-card-bg hover:border-gold/40 hover:bg-card-bg-hover hover:shadow-lg hover:shadow-gold/5 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-lg text-foreground group-hover:text-gold transition-colors">
                          {event.name}
                        </h3>
                        <span className="text-xs bg-gold/15 text-gold px-2 py-0.5 rounded-full font-medium">
                          {event.boardSize}x{event.boardSize}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-text-muted">
                        <span>{numTeams} team{numTeams !== 1 ? 's' : ''}</span>
                        <span>{event.boardSize * event.boardSize} tiles</span>
                      </div>
                      <p className="text-xs text-text-muted mt-3">
                        Created <LocalTime date={event.createdAt} format="date" />
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Event History */}
          {pastEvents.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-text-muted mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-text-muted rounded-full" />
                Event History
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pastEvents.map((event) => {
                  const numTeams = teamCounts.get(event.id) || 0;
                  const winner = pastEventWinners.get(event.id);
                  const topContributors = pastEventContributors.get(event.id);
                  return (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="group border border-card-border/60 rounded-xl p-5 bg-card-bg/60 hover:border-gold/30 hover:bg-card-bg-hover transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-lg text-text-muted group-hover:text-gold transition-colors">
                          {event.name}
                        </h3>
                        <div className="flex items-center gap-1.5">
                          {event.forceEndedAt ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
                              Force-Ended
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-text-muted/15 text-text-muted">
                              Completed
                            </span>
                          )}
                          <span className="text-xs bg-gold/10 text-gold/70 px-2 py-0.5 rounded-full font-medium">
                            {event.boardSize}x{event.boardSize}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-text-muted">
                        <span>{numTeams} team{numTeams !== 1 ? 's' : ''}</span>
                        <span>{event.boardSize * event.boardSize} tiles</span>
                      </div>
                      {winner && (
                        <div className="flex items-center gap-2 mt-3 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: winner.teamColor }} />
                          <span className="text-text-muted">
                            Winner: <span className="text-foreground font-medium">{winner.teamName}</span>
                            <span className="ml-1 text-text-muted">({winner.tilesCompleted} tiles)</span>
                          </span>
                        </div>
                      )}
                      {topContributors && topContributors.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-card-border/40">
                          <p className="text-[10px] text-text-muted mb-1 uppercase tracking-wide">Top Contributors</p>
                          <div className="space-y-0.5">
                            {topContributors.map((c, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-text-muted">
                                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {c.name}
                                </span>
                                <span className="text-accent-green-light font-medium">{c.totalAmount} drops</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {event.startDate && event.endDate && (
                        <p className="text-xs text-text-muted/70 mt-2">
                          <LocalTime date={event.startDate} format="date" /> — <LocalTime date={event.endDate} format="date" />
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Show "no active events" if only past events exist */}
          {activeEvents.length === 0 && pastEvents.length > 0 && (
            <div className="text-center py-8 border border-dashed border-card-border rounded-xl mb-10">
              <p className="text-text-muted">No active events right now.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import Link from 'next/link';
import { db } from '@/db';
import {
  clanMembers,
  completions,
  events,
  players,
  settings,
  submissions,
  teams,
  tiles,
  weeklyCompetitions,
  weeklyParticipants,
} from '@/db/schema';
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import LocalTime from '@/components/LocalTime';
import EventTimer from '@/components/EventTimer';
import { SKILL_LABELS, BOSSES } from '@/lib/constants';
import { eventTileCount, eventShapeBadge } from '@/lib/utils';
import { signupWindowState } from '@/lib/signup';

export const dynamic = 'force-dynamic';

function metricLabel(comp: { type: string; metric: string }): string {
  if (comp.type === 'skill') return SKILL_LABELS[comp.metric] ?? comp.metric;
  return BOSSES.find((b) => b.key === comp.metric)?.label ?? comp.metric;
}

export default async function HomePage() {
  // Clan name from settings (admin-configured, falls back to env or "Anvil")
  const clanNameRow = await db.query.settings.findFirst({ where: eq(settings.key, 'clan_name') });
  const clanName = clanNameRow?.value?.trim() || process.env.CLAN_NAME?.trim() || 'Anvil';

  // Clan-specific Discord invite — admin-configurable with an env fallback; the quick link is
  // omitted entirely when neither is set.
  const inviteRow = await db.query.settings.findFirst({ where: eq(settings.key, 'discord_invite_url') });
  const discordInvite = inviteRow?.value?.trim() || process.env.DISCORD_INVITE_URL?.trim() || null;

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

  // Public-side state machine for events:
  //   - "draft":    startDate is null and not force-ended → hidden from public
  //   - "upcoming": startDate is in the future → shown alongside active
  //   - "active":   started, not yet ended, not force-ended
  //   - "past":     force-ended OR endDate < now
  const isDraft = (e: typeof allEvents[number]) => !e.forceEndedAt && !e.startDate;
  const activeEvents = allEvents.filter((e) => {
    if (e.forceEndedAt) return false;
    if (isDraft(e)) return false;
    if (e.endDate && e.endDate < now) return false;
    return true;
  });
  const pastEvents = allEvents.filter((e) => !!e.forceEndedAt || (!!e.endDate && e.endDate < now));

  // Live stats: active clan member count. Excludes guests (is_guest=1) — those are
  // plugin-pinged non-members who'd otherwise inflate the headcount past the real
  // in-game clan count. Unranked non-guests are kept: still in the clan, just not
  // currently reachable on the hiscores.
  const activeMemberCount = await db
    .select({ c: count() })
    .from(clanMembers)
    .where(and(isNull(clanMembers.leftAt), eq(clanMembers.isGuest, 0)))
    .then((r) => r[0]?.c ?? 0);

  // Active weekly competition with top 3 participants
  const activeWeekly = await db.query.weeklyCompetitions.findFirst({
    where: eq(weeklyCompetitions.status, 'active'),
  });

  type WeeklyTopRow = { rsn: string; gained: number };
  let weeklyTop: WeeklyTopRow[] = [];
  let weeklyParticipantCount = 0;
  if (activeWeekly) {
    const allParts = await db
      .select({
        rsn: weeklyParticipants.rsn,
        baselineValue: weeklyParticipants.baselineValue,
        currentValue: weeklyParticipants.currentValue,
      })
      .from(weeklyParticipants)
      .where(eq(weeklyParticipants.competitionId, activeWeekly.id));
    weeklyParticipantCount = allParts.length;
    weeklyTop = allParts
      .map((p) => ({
        rsn: p.rsn,
        gained: (p.currentValue ?? 0) - (p.baselineValue ?? 0),
      }))
      .filter((p) => p.gained > 0)
      .sort((a, b) => b.gained - a.gained)
      .slice(0, 3);
  }

  // Upcoming weekly competitions — surfaced on the home page so members can see
  // what's coming this week alongside live events.
  const upcomingWeeklies = await db.query.weeklyCompetitions.findMany({
    where: eq(weeklyCompetitions.status, 'upcoming'),
    orderBy: (w, { asc }) => [asc(w.startDate)],
    limit: 4,
  });
  const upcomingWeeklyParticipantCounts = new Map<number, number>();
  if (upcomingWeeklies.length > 0) {
    const rows = await db
      .select({ competitionId: weeklyParticipants.competitionId, c: count() })
      .from(weeklyParticipants)
      .where(inArray(weeklyParticipants.competitionId, upcomingWeeklies.map((w) => w.id)))
      .groupBy(weeklyParticipants.competitionId);
    for (const r of rows) upcomingWeeklyParticipantCounts.set(r.competitionId, r.c);
  }

  // Fetch board completion data for active events (to show team progress)
  const activeEventStats = new Map<number, { topTeam: { name: string; color: string; tiles: number } | null; totalCompletions: number }>();
  if (activeEvents.length > 0) {
    const activeIds = activeEvents.map((e) => e.id);
    const activeTeams = await db.select().from(teams).where(inArray(teams.eventId, activeIds));
    const activeTiles = await db.select().from(tiles).where(inArray(tiles.eventId, activeIds));
    const tileEventMap = new Map(activeTiles.map((t) => [t.id, t.eventId]));
    const tileIds = activeTiles.map((t) => t.id);
    const activeCompletions = tileIds.length
      ? await db.select().from(completions).where(inArray(completions.tileId, tileIds))
      : [];

    for (const event of activeEvents) {
      const evTeams = activeTeams.filter((t) => t.eventId === event.id);
      const evCompletions = activeCompletions.filter((c) => tileEventMap.get(c.tileId) === event.id);
      let top: { name: string; color: string; tiles: number } | null = null;
      for (const team of evTeams) {
        const tilesDone = evCompletions.filter((c) => c.teamId === team.id).length;
        if (!top || tilesDone > top.tiles) {
          top = { name: team.name, color: team.color, tiles: tilesDone };
        }
      }
      activeEventStats.set(event.id, { topTeam: top, totalCompletions: evCompletions.length });
    }
  }

  // Past event analytics (preserved from previous version)
  const pastEventIds = pastEvents.map((e) => e.id);
  const pastEventWinners = new Map<number, { teamName: string; teamColor: string; tilesCompleted: number }>();
  const pastEventContributors = new Map<number, { name: string; submissions: number }[]>();

  if (pastEventIds.length > 0) {
    const allPastTeams = await db.select().from(teams).where(inArray(teams.eventId, pastEventIds));
    const allPastTiles = await db.select().from(tiles).where(inArray(tiles.eventId, pastEventIds));
    const allPastTileIds = allPastTiles.map((t) => t.id);
    const allPastCompletions = allPastTileIds.length > 0
      ? await db.select().from(completions).where(inArray(completions.tileId, allPastTileIds))
      : [];
    const allPastSubmissions = allPastTileIds.length > 0
      ? await db.select().from(submissions).where(inArray(submissions.tileId, allPastTileIds))
      : [];
    const allPastPlayers = await db.select().from(players).where(inArray(players.eventId, pastEventIds));

    const tileEventMap = new Map(allPastTiles.map((t) => [t.id, t.eventId]));
    for (const event of pastEvents) {
      const evTeams = allPastTeams.filter((t) => t.eventId === event.id);
      const evTileIds = allPastTiles.filter((t) => t.eventId === event.id).map((t) => t.id);
      if (evTileIds.length === 0 || evTeams.length === 0) continue;
      const evCompletions = allPastCompletions.filter((c) => tileEventMap.get(c.tileId) === event.id);
      let bestTeam: { teamName: string; teamColor: string; tilesCompleted: number } | null = null;
      for (const team of evTeams) {
        const tilesDone = evCompletions.filter((c) => c.teamId === team.id).length;
        if (!bestTeam || tilesDone > bestTeam.tilesCompleted) {
          bestTeam = { teamName: team.name, teamColor: team.color, tilesCompleted: tilesDone };
        }
      }
      if (bestTeam && bestTeam.tilesCompleted > 0) pastEventWinners.set(event.id, bestTeam);

      const evSubmissions = allPastSubmissions.filter((s) => tileEventMap.get(s.tileId) === event.id);
      // Rank contributors by number of submissions (one screenshot = one contribution), not
      // summed `amount` — kill-count/value tiles store a kill count / gp value there, which
      // would inflate the figure (e.g. one "35 Hill Giants" screenshot counting as 35).
      const playerCounts = new Map<number, number>();
      for (const s of evSubmissions) {
        if (s.creditPlayerId) {
          playerCounts.set(s.creditPlayerId, (playerCounts.get(s.creditPlayerId) || 0) + 1);
        }
      }
      if (playerCounts.size > 0) {
        const topIds = [...playerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
        const evPlayers = allPastPlayers.filter((p) => p.eventId === event.id);
        const playerMap = new Map(evPlayers.map((p) => [p.id, p.name]));
        pastEventContributors.set(
          event.id,
          topIds.map(([pid, count]) => ({ name: playerMap.get(pid) || 'Unknown', submissions: count })),
        );
      }
    }
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl mb-10 border border-gold/20 bg-gradient-to-br from-card-bg via-brown-dark to-background p-6 sm:p-12">
        <div className="absolute inset-0 opacity-30 pointer-events-none" aria-hidden>
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-gold/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-accent-green/10 blur-3xl" />
        </div>
        <div className="relative">
          <div className="text-xs uppercase tracking-[0.2em] text-gold/70 mb-2">OSRS Clan Events</div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gold mb-3">{clanName}</h1>
          <p className="text-text-muted text-base sm:text-lg max-w-2xl">
            Bingos, Skill of the Week, Boss of the Week, and the clan roster — all in one place.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <Stat label="Active members" value={activeMemberCount.toLocaleString()} />
            <Stat label="Active bingos" value={String(activeEvents.length)} />
            <Stat label="Past events" value={String(pastEvents.length)} />
            {activeWeekly && <Stat label="This week" value={metricLabel(activeWeekly)} accent />}
          </div>
        </div>
      </section>

      {/* Upcoming weekly competitions — shown above active section so members
          spot what's coming this week even when nothing is live yet. */}
      {upcomingWeeklies.length > 0 && (
        <section className="mb-10">
          <h2 className="text-base font-semibold text-text-muted mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-blue-400/70 rounded-full" />
            Upcoming this week
            <span className="text-xs text-text-muted/60 font-normal">({upcomingWeeklies.length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcomingWeeklies.map((w) => {
              const partCount = upcomingWeeklyParticipantCounts.get(w.id) ?? 0;
              return (
                <Link
                  key={w.id}
                  href="/weekly"
                  className="block group border border-card-border rounded-2xl p-5 bg-card-bg/60 hover:border-blue-400/40 hover:bg-card-bg-hover transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wider text-text-muted mb-1">
                        {w.type === 'skill' ? 'Skill of the Week' : 'Boss of the Week'}
                      </div>
                      <h3 className="text-lg font-semibold text-foreground group-hover:text-blue-300 transition-colors truncate">
                        {w.title}
                      </h3>
                      <div className="text-sm text-text-muted mt-0.5">{metricLabel(w)}</div>
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-wide bg-blue-500/15 text-blue-300 px-2 py-1 rounded-full shrink-0">
                      Upcoming
                    </span>
                  </div>
                  <div className="text-xs text-text-muted flex flex-wrap gap-x-3 gap-y-1">
                    <EventTimer startDate={w.startDate} endDate={w.endDate} className="text-blue-300/90" />
                    <span>{partCount} enrolled</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Active highlights */}
      {(activeEvents.length > 0 || activeWeekly) && (
        <section className="mb-10 grid gap-5 lg:grid-cols-2">
          {activeWeekly && (
            <div className="border border-card-border rounded-2xl bg-card-bg p-6 hover:border-gold/40 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-text-muted mb-1">
                    {activeWeekly.type === 'skill' ? 'Skill of the Week' : 'Boss of the Week'}
                  </div>
                  <h2 className="text-2xl font-bold text-gold">{activeWeekly.title}</h2>
                  <div className="text-sm text-text-muted mt-1">{metricLabel(activeWeekly)}</div>
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wide bg-accent-green/15 text-accent-green-light px-2 py-1 rounded-full">
                  Live
                </span>
              </div>
              <div className="text-xs text-text-muted mb-3 flex flex-wrap items-center gap-x-1.5">
                <span>{weeklyParticipantCount} participant{weeklyParticipantCount !== 1 ? 's' : ''}</span>
                {activeWeekly.endDate && (
                  <>
                    <span>·</span>
                    <EventTimer startDate={activeWeekly.startDate} endDate={activeWeekly.endDate} />
                  </>
                )}
              </div>
              {weeklyTop.length === 0 ? (
                <div className="text-sm text-text-muted py-4 text-center border border-dashed border-card-border rounded-lg">
                  No gains tracked yet — leaderboard fills as participants play.
                </div>
              ) : (
                <ol className="space-y-1.5">
                  {weeklyTop.map((p, i) => (
                    <li key={p.rsn} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="text-base">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                        <span className="font-medium">{p.rsn}</span>
                      </span>
                      <span className="text-accent-green-light font-mono">
                        +{p.gained.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <Link
                href="/weekly"
                className="mt-4 inline-flex text-sm text-gold hover:text-gold-light underline-offset-2 hover:underline"
              >
                Full leaderboard →
              </Link>
            </div>
          )}

          {activeEvents.length > 0 && (
            <div className="space-y-4">
              {activeEvents.map((event) => {
                const numTeams = teamCounts.get(event.id) || 0;
                const stats = activeEventStats.get(event.id);
                const started = !!event.startDate && event.startDate <= now;
                const signupsOpen = signupWindowState({
                  signupOpensAt: event.signupOpensAt,
                  signupDeadline: event.signupDeadline,
                  startDate: event.startDate,
                }).open;
                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="block group border border-card-border rounded-2xl p-6 bg-card-bg hover:border-gold/40 hover:bg-card-bg-hover transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-text-muted mb-1">
                          {started ? 'Active Bingo' : 'Upcoming Bingo'}
                        </div>
                        <h2 className="text-2xl font-bold text-foreground group-hover:text-gold transition-colors">
                          {event.name}
                        </h2>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-xs bg-gold/15 text-gold px-2 py-1 rounded-full font-medium whitespace-nowrap">
                          {eventShapeBadge(event.format, event.scoringMode, event.boardSize)}
                        </span>
                        {signupsOpen && (
                          <span className="text-xs bg-accent-green/15 text-accent-green-light px-2 py-1 rounded-full font-medium whitespace-nowrap">
                            Sign-ups open
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted mb-3">
                      <span>{numTeams} team{numTeams !== 1 ? 's' : ''}</span>
                      <span>{eventTileCount(event.format, event.scoringMode, event.boardSize)} tiles</span>
                      <EventTimer startDate={event.startDate} endDate={event.endDate} className="text-gold/80" />
                    </div>
                    {stats?.topTeam && stats.topTeam.tiles > 0 ? (
                      <div className="flex items-center gap-2 text-sm pt-3 border-t border-card-border/50">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stats.topTeam.color }} />
                        <span className="text-text-muted">
                          Leading: <span className="text-foreground font-medium">{stats.topTeam.name}</span>
                          <span className="ml-1.5 text-text-muted">
                            ({stats.topTeam.tiles}/{eventTileCount(event.format, event.scoringMode, event.boardSize)} tiles)
                          </span>
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-text-muted pt-3 border-t border-card-border/50">
                        No tiles completed yet.
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Empty state when nothing is active or upcoming */}
      {activeEvents.length === 0 && !activeWeekly && upcomingWeeklies.length === 0 && allEvents.length > 0 && (
        <section className="mb-10 border border-dashed border-card-border rounded-2xl py-12 text-center">
          <p className="text-text-muted text-lg mb-1">Nothing live right now</p>
          <p className="text-text-muted text-sm">
            Check the <Link href="/weekly" className="text-gold hover:underline">weekly leaderboards</Link>{' '}
            or browse past events below.
          </p>
        </section>
      )}

      {/* No events at all — fresh-install state */}
      {allEvents.length === 0 && !activeWeekly && upcomingWeeklies.length === 0 && (
        <section className="mb-10 border border-dashed border-card-border rounded-2xl py-16 text-center">
          <p className="text-text-muted text-lg mb-2">No events yet</p>
          <p className="text-text-muted text-sm">
            Sign in as <Link href="/admin" className="text-gold hover:underline">admin</Link> to create your first event.
          </p>
        </section>
      )}

      {/* Quick links */}
      <section className="mb-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickLink href="/weekly" emoji="🏆" label="Weekly" />
        <QuickLink href="/captain" emoji="⚔️" label="Captain" />
        <QuickLink href="/profile" emoji="👤" label="My Profile" />
        {discordInvite && <QuickLink href={discordInvite} emoji="💬" label="Discord" external />}
      </section>

      {/* Past events — secondary */}
      {pastEvents.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-text-muted mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-text-muted rounded-full" />
            Past events
            <span className="text-xs text-text-muted/60 font-normal">({pastEvents.length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pastEvents.map((event) => {
              const numTeams = teamCounts.get(event.id) || 0;
              const winner = pastEventWinners.get(event.id);
              const topContributors = pastEventContributors.get(event.id);
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="group border border-card-border/60 rounded-xl p-4 bg-card-bg/40 hover:border-gold/30 hover:bg-card-bg-hover transition-colors"
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <h3 className="font-semibold text-text-muted group-hover:text-gold transition-colors truncate">
                      {event.name}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      {event.forceEndedAt ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
                          Force-ended
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-text-muted/15 text-text-muted">
                          Done
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted mb-2">
                    <span>{eventShapeBadge(event.format, event.scoringMode, event.boardSize)}</span>
                    <span>·</span>
                    <span>{numTeams} team{numTeams !== 1 ? 's' : ''}</span>
                  </div>
                  {winner && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: winner.teamColor }} />
                      <span className="text-text-muted truncate">
                        <span className="text-foreground/80">{winner.teamName}</span>
                        <span className="ml-1 opacity-60">won {winner.tilesCompleted}</span>
                      </span>
                    </div>
                  )}
                  {topContributors && topContributors.length > 0 && (
                    <div className="text-[11px] text-text-muted mt-1 truncate">
                      🥇 {topContributors[0].name} ({topContributors[0].submissions} drop{topContributors[0].submissions !== 1 ? 's' : ''})
                    </div>
                  )}
                  {event.startDate && event.endDate && (
                    <p className="text-[10px] text-text-muted/60 mt-2">
                      <LocalTime date={event.startDate} format="date" /> — <LocalTime date={event.endDate} format="date" />
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className={`text-lg font-semibold ${accent ? 'text-gold' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function QuickLink({
  href,
  emoji,
  label,
  external,
}: {
  href: string;
  emoji: string;
  label: string;
  external?: boolean;
}) {
  const className =
    'flex items-center justify-center gap-2 px-4 py-3 border border-card-border rounded-xl bg-card-bg/60 hover:border-gold/40 hover:bg-card-bg-hover transition-colors text-sm font-medium';
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        <span>{emoji}</span>
        <span>{label}</span>
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      <span>{emoji}</span>
      <span>{label}</span>
    </Link>
  );
}

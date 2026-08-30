// One list of everything a clan runs.
//
// Board events and weekly competitions live in different tables and always will — a weekly's
// baselines, flags and cron-driven status have no place in the events schema. But every surface
// that wants "what's this clan running" had to union them by hand: the events list, the dashboard,
// the schedule calendar, the public showcase and the member profile each grew their own version,
// with their own idea of what a weekly's link should be and which of them counts as "active".
//
// This is that union, once. Storage stays split; the reading of it doesn't.

import { db } from '@/db';
import { events, teams, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { count, desc, eq } from 'drizzle-orm';
import { eventShapeBadge } from '@/lib/utils';
import { eventStage } from '@/lib/eventStage';
import { weeklyStage, WEEKLY_BADGE } from '@/lib/weeklyStage';

export type IndexKind = 'board' | 'weekly';

/** 'draft' is a board with no dates at all — scheduled nothing, running nothing. */
export type IndexStatus = 'draft' | 'upcoming' | 'running' | 'ended';

export interface EventIndexItem {
  kind: IndexKind;
  id: number;
  title: string;
  /** Short shape label: 'Leagues · 150', '5×5', 'SOTW'. */
  badge: string;
  status: IndexStatus;
  startDate: string | null;
  endDate: string | null;
  /** Where staff manage it. */
  href: string;
  /** Where members see it. */
  publicHref: string;
  /** One line of scale — '8 teams · 96 players', '137 entered'. */
  headline: string;
  /** Sort key: when it runs, falling back to when it was made. */
  sortAt: string;
}

export async function listEventIndex(clanId: number): Promise<EventIndexItem[]> {
  const [boards, weeklies, teamCounts, participantCounts] = await Promise.all([
    // Scoped. This took no clan at all, and both callers — the admin dashboard and the schedule API —
    // are clan surfaces, so every clan's index listed every other clan's boards and weeks.
    db.select().from(events).where(eq(events.clanId, clanId)).orderBy(desc(events.createdAt)),
    db
      .select()
      .from(weeklyCompetitions)
      .where(eq(weeklyCompetitions.clanId, clanId))
      .orderBy(desc(weeklyCompetitions.startDate)),
    db.select({ eventId: teams.eventId, n: count() }).from(teams).groupBy(teams.eventId),
    db
      .select({ competitionId: weeklyParticipants.competitionId, n: count() })
      .from(weeklyParticipants)
      .groupBy(weeklyParticipants.competitionId),
  ]);

  const teamsById = new Map(teamCounts.map((r) => [r.eventId, r.n]));
  const enteredById = new Map(participantCounts.map((r) => [r.competitionId, r.n]));

  const boardItems: EventIndexItem[] = boards.map((e) => {
    const stage = eventStage(e);
    const teamCount = teamsById.get(e.id) ?? 0;
    return {
      kind: 'board',
      id: e.id,
      title: e.name,
      badge: eventShapeBadge(e.format, e.scoringMode, e.boardSize, e.rules),
      status: stage === 'wrap' ? 'ended' : stage === 'run' ? 'running' : e.startDate ? 'upcoming' : 'draft',
      startDate: e.startDate,
      endDate: e.endDate,
      href: `/admin/events/${e.id}`,
      publicHref: `/events/${e.id}`,
      headline: `${teamCount} team${teamCount === 1 ? '' : 's'}`,
      sortAt: e.startDate ?? e.createdAt,
    };
  });

  const weeklyItems: EventIndexItem[] = weeklies.map((w) => {
    const stage = weeklyStage(w);
    const entered = enteredById.get(w.id) ?? 0;
    return {
      kind: 'weekly',
      id: w.id,
      title: w.title,
      badge: WEEKLY_BADGE[w.type] ?? 'Weekly',
      status: stage === 'wrap' ? 'ended' : stage === 'run' ? 'running' : 'upcoming',
      startDate: w.startDate,
      endDate: w.endDate,
      // Staff go to the competition's workspace, not the player page — the one thing every
      // hand-rolled union got differently.
      href: `/admin/events/weekly/${w.id}`,
      publicHref: `/weekly/${w.id}`,
      headline: `${entered} entered`,
      sortAt: w.startDate,
    };
  });

  return [...boardItems, ...weeklyItems].sort((a, b) => (a.sortAt < b.sortAt ? 1 : -1));
}

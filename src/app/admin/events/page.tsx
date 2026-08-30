import { db } from '@/db';
import { events, teams, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { count, desc, eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { assignedEventIdsForUser } from '@/lib/eventEditors';
import { eventTileCount } from '@/lib/utils';
import {
  getAttentionItems,
  getPastEventResults,
  getPastWeeklyResults,
  getRunningEventSummaries,
  getSetupProgress,
  setupAttentionItems,
  type AttentionItem,
} from '@/lib/adminEventsOverview';
import EventsClient, { type ListItem } from './EventsClient';
import { atLeast } from '@/lib/clanRoles';
import { requireClan } from '@/lib/clanContext';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  const session = await verifyUser();
  // Board-scoped editors only ever see the events they're granted — and never the weekly
  // competitions surface (that stays a broader-staff tool). Everyone else sees everything.
  const isScopedEditor = session?.role === 'editor' && session.editorScope === 'assigned';
  // A board treasurer is scoped the same way, by their treasurer grants rather than editor ones.
  const isBoardTreasurer = session?.role === 'treasurer' && session.treasurerScope === 'assigned';
  const scoped = isScopedEditor || isBoardTreasurer;
  const assignedIds = scoped
    ? new Set(await assignedEventIdsForUser(session!.userId, isScopedEditor ? 'editor' : 'treasurer'))
    : null;

  // THIS CLAN'S boards and weeks. Both reads were unscoped, so the events list — the main admin
  // screen — showed every clan on the deployment their neighbours' events, names and dates included.
  const clan = await requireClan();
  const [allEventsRaw, allWeeklyRaw] = await Promise.all([
    db.select().from(events).where(eq(events.clanId, clan.id)).orderBy(desc(events.createdAt)),
    scoped
      ? Promise.resolve([])
      : db
          .select()
          .from(weeklyCompetitions)
          .where(eq(weeklyCompetitions.clanId, clan.id))
          .orderBy(desc(weeklyCompetitions.startDate)),
  ]);

  const allEvents = assignedIds ? allEventsRaw.filter((e) => assignedIds.has(e.id)) : allEventsRaw;
  const allWeekly = allWeeklyRaw;

  const teamCounts: Record<number, number> = {};
  const participantCounts: Record<number, number> = {};
  await Promise.all([
    allEvents.length > 0
      ? db
          .select({ eventId: teams.eventId, c: count() })
          .from(teams)
          .groupBy(teams.eventId)
          .then((rows) => {
            for (const r of rows) teamCounts[r.eventId] = r.c;
          })
      : Promise.resolve(),
    allWeekly.length > 0
      ? db
          .select({ competitionId: weeklyParticipants.competitionId, c: count() })
          .from(weeklyParticipants)
          .groupBy(weeklyParticipants.competitionId)
          .then((rows) => {
            for (const r of rows) participantCounts[r.competitionId] = r.c;
          })
      : Promise.resolve(),
  ]);

  const now = new Date().toISOString();

  const eventItems: ListItem[] = allEvents.map((e) => ({
    kind: 'event',
    id: e.id,
    name: e.name,
    boardSize: e.boardSize,
    format: e.format,
    scoringMode: e.scoringMode,
    rules: e.rules,
    startDate: e.startDate,
    endDate: e.endDate,
    forceEndedAt: e.forceEndedAt,
    createdAt: e.createdAt,
    teamCount: teamCounts[e.id] ?? 0,
    tilesRevealed: !!e.tilesRevealed,
  }));

  const weeklyItems: ListItem[] = allWeekly.map((w) => ({
    kind: 'weekly',
    id: w.id,
    title: w.title,
    type: w.type === 'boss' ? 'boss' : w.type === 'efficiency' ? 'efficiency' : 'skill',
    metric: w.metric,
    status: w.status,
    startDate: w.startDate,
    endDate: w.endDate,
    participantCount: participantCounts[w.id] ?? 0,
    createdAt: w.createdAt,
  }));

  const isPast = (item: ListItem) =>
    item.kind === 'event'
      ? !!item.forceEndedAt || (!!item.endDate && item.endDate < now)
      : item.status === 'completed';

  // "Running" is narrower than "not past": a board with no start date, or one scheduled for next
  // week, is being SET UP — a different job, and a different card.
  const isRunning = (item: ListItem) =>
    item.kind === 'event'
      ? !isPast(item) && !!item.startDate && item.startDate <= now
      : item.status === 'active';

  const sortKey = (item: ListItem) =>
    item.kind === 'event' ? item.startDate ?? item.createdAt : item.startDate;
  const byDateDesc = (a: ListItem, b: ListItem) => (sortKey(a) < sortKey(b) ? 1 : -1);
  const byDateAsc = (a: ListItem, b: ListItem) => (sortKey(a) < sortKey(b) ? -1 : 1);

  const all: ListItem[] = [...eventItems, ...weeklyItems];
  const running = all.filter(isRunning).sort(byDateAsc);
  // Scheduled things first, soonest first; undated drafts fall to the end — a board with a date on
  // it is the one with a deadline attached.
  const upcoming = all
    .filter((i) => !isPast(i) && !isRunning(i))
    .sort((a, b) => {
      if (!!a.startDate !== !!b.startDate) return a.startDate ? -1 : 1;
      return byDateAsc(a, b);
    });
  const past = all.filter(isPast).sort(byDateDesc);

  const canManage = atLeast(session?.role, 'admin');

  // ---- the numbers ------------------------------------------------------------------------
  // Editors don't get the operational reads: they author tiles, and every href in the attention
  // strip points at a tab their role can't open anyway.
  const runningEventRows = allEvents.filter((e) => running.some((r) => r.kind === 'event' && r.id === e.id));
  const upcomingEventRows = allEvents.filter((e) => upcoming.some((u) => u.kind === 'event' && u.id === e.id));
  const pastEventIds = past.filter((p) => p.kind === 'event').map((p) => p.id);
  const pastWeeklyIds = past.filter((p) => p.kind === 'weekly').map((p) => p.id);

  const [summaries, setup, pastResults, pastWeekly] = await Promise.all([
    getRunningEventSummaries(runningEventRows.map((e) => ({ id: e.id, scoringMode: e.scoringMode }))),
    getSetupProgress(
      upcomingEventRows.map((e) => ({
        id: e.id,
        expectedTiles: eventTileCount(e.format, e.scoringMode, e.boardSize),
        draftStatus: e.draftStatus,
        hasDates: !!e.startDate && !!e.endDate,
      })),
    ),
    getPastEventResults(pastEventIds),
    getPastWeeklyResults(pastWeeklyIds),
  ]);

  let attention: AttentionItem[] = [];
  if (canManage) {
    attention = await getAttentionItems({
      clanId: clan.id,
      liveEventIds: runningEventRows.map((e) => e.id),
      upcomingEventIds: upcomingEventRows.map((e) => e.id),
      endedEventIds: pastEventIds,
    });
    for (const e of upcomingEventRows) {
      const progress = setup.get(e.id);
      if (progress) attention.push(...setupAttentionItems(e, progress));
    }
    // Urgent first, then whatever came back in query order. Six is a strip; more is a report,
    // and the rest are one click away on the event itself.
    const rank = { urgent: 0, warn: 1, info: 2 } as const;
    attention.sort((a, b) => rank[a.severity] - rank[b.severity]);
    attention = attention.slice(0, 6);
  }

  return (
    <EventsClient
      running={running}
      upcoming={upcoming}
      past={past}
      canManage={canManage}
      summaries={Object.fromEntries(summaries)}
      setup={Object.fromEntries(setup)}
      pastResults={Object.fromEntries(pastResults)}
      pastWeekly={Object.fromEntries(pastWeekly)}
      attention={attention}
    />
  );
}

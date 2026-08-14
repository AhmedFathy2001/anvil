import { db } from '@/db';
import { completions, events, teams, tiles } from '@/db/schema';
import { count, desc, inArray } from 'drizzle-orm';
import { eventAxes } from '@/lib/eventAxes';
import { parseEventRules, visibleTiles } from '@/lib/eventRules';
import { eventShapeBadge, isPointsMode, tileWeight } from '@/lib/utils';

/**
 * One event, reduced to what a card needs.
 *
 * The home page and the events index draw the same card, so the derivation lives here rather than
 * twice: a member who sees "Ember leading 10/25" on the home page must see the same number on the
 * index, and the only way to guarantee that is one function.
 */
export interface EventCard {
  id: number;
  name: string;
  shape: string;
  chips: string[];
  status: 'live' | 'upcoming' | 'past';
  /** Leading (live) or winning (past) team, scored against the whole board. */
  top: { name: string; color: string; score: number; total: number; unit: string } | null;
  foot: string;
  /** For sorting and grouping on the index. */
  startDate: string | null;
  endDate: string | null;
  /** Which surface it is — the index filters on this. */
  format: 'bingo' | 'ladder' | 'tilerace';
}

export interface LoadEventCardsOptions {
  /** Cap the number of finished events. Omit for everything (the index). */
  pastLimit?: number;
  /** Include events that have not started yet. The home page shows them; the index lists them. */
  includeUpcoming?: boolean;
}

const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export async function loadEventCards(opts: LoadEventCardsOptions = {}, now: Date = new Date()): Promise<EventCard[]> {
  const nowIso = now.toISOString();
  const all = await db.select().from(events).orderBy(desc(events.createdAt));

  // A draft has no start date and no forced end: the host is still building it, so it is not public.
  const isDraft = (e: (typeof all)[number]) => !e.forceEndedAt && !e.startDate;
  const live = all.filter(
    (e) => !e.forceEndedAt && !isDraft(e) && !(e.endDate && e.endDate < nowIso) && !(e.startDate && e.startDate > nowIso),
  );
  const upcoming = opts.includeUpcoming
    ? all.filter((e) => !e.forceEndedAt && !!e.startDate && e.startDate > nowIso)
    : [];
  const past = all.filter((e) => !!e.forceEndedAt || (!!e.endDate && e.endDate < nowIso));
  const shownPast = opts.pastLimit != null ? past.slice(0, opts.pastLimit) : past;
  const shown = [...live, ...upcoming, ...shownPast];
  if (shown.length === 0) return [];

  const ids = shown.map((e) => e.id);
  const teamCounts = new Map<number, number>();
  for (const row of await db.select({ eventId: teams.eventId, c: count() }).from(teams).groupBy(teams.eventId)) {
    teamCounts.set(row.eventId, row.c);
  }
  const eventTeams = await db.select().from(teams).where(inArray(teams.eventId, ids));
  const eventTiles = await db.select().from(tiles).where(inArray(tiles.eventId, ids));
  const tileEvent = new Map(eventTiles.map((t) => [t.id, t.eventId]));
  const eventCompletions = eventTiles.length
    ? await db.select().from(completions).where(inArray(completions.tileId, eventTiles.map((t) => t.id)))
    : [];

  return shown.map((event) => {
    const status: EventCard['status'] = live.some((e) => e.id === event.id)
      ? 'live'
      : upcoming.some((e) => e.id === event.id)
        ? 'upcoming'
        : 'past';
    const rules = parseEventRules(event.rules);
    // The DENOMINATOR is the whole board, including tiles that have not been revealed yet. Scoring
    // against only the open ones makes a reveal board read as nearly finished when it has barely
    // started (the event page does the same — ScoreboardClient's boardPointsTotal).
    const boardTiles = eventTiles.filter((t) => t.eventId === event.id && !t.optional);
    const scorable = visibleTiles(rules, boardTiles);
    const weightById = new Map(scorable.map((t) => [t.id, tileWeight(event.scoringMode, t.points)]));
    const total = boardTiles.reduce((s, t) => s + tileWeight(event.scoringMode, t.points), 0);
    const unit = isPointsMode(event.scoringMode) ? 'pts' : 'tiles';
    const evCompletions = eventCompletions.filter((c) => tileEvent.get(c.tileId) === event.id);

    let top: EventCard['top'] = null;
    for (const team of eventTeams.filter((t) => t.eventId === event.id)) {
      const score = evCompletions
        .filter((c) => c.teamId === team.id && weightById.has(c.tileId))
        .reduce(
          (s, c) =>
            s + (isPointsMode(event.scoringMode) && c.awardedPoints != null ? c.awardedPoints : weightById.get(c.tileId) ?? 0),
          0,
        );
      if (!top || score > top.score) top = { name: team.name, color: team.color, score, total, unit };
    }

    const teamCount = teamCounts.get(event.id) ?? 0;
    const axes = eventAxes({ ...event, rules });
    const chips: string[] = [];
    if (axes.competitors === 'individuals') {
      if (teamCount > 0) chips.push(`${teamCount} player${teamCount === 1 ? '' : 's'}`);
    } else if (teamCount > 0) {
      chips.push(`${teamCount} team${teamCount === 1 ? '' : 's'}`);
    }
    if (evCompletions.length > 0) chips.push(`${evCompletions.length} claimed`);

    return {
      id: event.id,
      name: event.name,
      shape: eventShapeBadge(event.format, event.scoringMode, event.boardSize, event.rules),
      chips,
      status,
      top: top && top.score > 0 ? top : null,
      startDate: event.startDate,
      endDate: event.endDate,
      format: (event.format === 'ladder' ? 'ladder' : event.format === 'tilerace' ? 'tilerace' : 'bingo') as EventCard['format'],
      foot:
        status === 'upcoming'
          ? event.startDate
            ? `starts ${dateShort(event.startDate)}`
            : 'not scheduled yet'
          : status === 'live'
            ? event.endDate
              ? `ends ${dateShort(event.endDate)}`
              : 'no end date — runs until it is ended'
            : event.forceEndedAt
              ? 'ended early'
              : event.endDate
                ? `ended ${dateShort(event.endDate)}`
                : 'finished',
    };
  });
}

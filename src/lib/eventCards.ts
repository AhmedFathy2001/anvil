import { db } from '@/db';
import { clans, completions, eventCohosts, events, teams, tiles } from '@/db/schema';
import { and, count, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { eventAxes } from '@/lib/eventAxes';
import { modeKeyFor, type EventMode } from '@/lib/eventModes';
import { hasRevealPolicy, parseEventRules } from '@/lib/eventRules';
import { eventShapeBadge, isPointsMode } from '@/lib/utils';

/**
 * One event, reduced to what a card needs.
 *
 * The home page and the events index draw the same card, so the derivation lives here rather than
 * twice: a member who sees "Ember leading 10/25" on the home page must see the same number on the
 * index, and the only way to guarantee that is one function.
 *
 * WHERE THE WORK HAPPENS. This used to pull every tile of every event and then every completion of
 * every tile into JS, and sum them there — so opening /events cost the clan's whole history, on
 * every request, to print a number for a bingo that ended a year ago. The board totals and the
 * per-team scores are two GROUP BYs; the database does them without shipping the rows. Row-level loading
 * survives only for the boards that genuinely need it — a reveal policy or mission tiles mean some
 * completions don't count yet, and that judgement lives in lib/eventRules, not in SQL.
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
  /** The named mode (classic, leagues, showdown, lucky draw, bounty, race, ladder) — what a
      person calls it, and what the hub groups and draws by. See lib/eventModes. */
  mode: EventMode;
  /** How many tiles the board has, and how many have been claimed by anyone. The hub's glyph
      draws the share; on a points board `top.total` is a point total and says nothing about it. */
  board: { tiles: number; claimed: number };
  /** The HOST clan's slug when the clan this list is for is only a CO-HOST — null when it owns the
      event. A co-hosted event lives at its host's URL (an event belongs to exactly one clan's
      address), so a co-host's card links across to `/c/<hostSlug>/events/<id>`. */
  hostSlug: string | null;
}

export interface LoadEventCardsOptions {
  /** Cap the number of finished events. Omit for everything (the index). */
  pastLimit?: number;
  /** Include events that have not started yet. The home page shows them; the index lists them. */
  includeUpcoming?: boolean;
}

const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * How many finished events exist, for the index's "showing 24 of 137".
 *
 * The same predicate as the `past` filter below, expressed as a count so asking the question
 * doesn't mean loading the answer.
 */
export async function countPastEvents(clanId: number, now: Date = new Date()): Promise<number> {
  const nowIso = now.toISOString();
  const [row] = await db
    .select({ c: count() })
    .from(events)
    .where(
      and(
        eq(events.clanId, clanId),
        or(isNotNull(events.forceEndedAt), and(isNotNull(events.endDate), lt(events.endDate, nowIso))),
      ),
    );
  return row?.c ?? 0;
}

export async function loadEventCards(
  clanId: number,
  opts: LoadEventCardsOptions = {},
  now: Date = new Date(),
): Promise<EventCard[]> {
  const nowIso = now.toISOString();
  // The events this clan HOSTS, plus the ones it CO-HOSTS (an accepted seat on another clan's event).
  // A co-hosted event is the visiting clan's too — it should appear on their events pages, linking
  // across to the host's URL. Everything below derives from `all` and inherits this scope.
  const cohosted = await db
    .select({ eventId: eventCohosts.eventId, hostSlug: clans.slug })
    .from(eventCohosts)
    .innerJoin(events, eq(events.id, eventCohosts.eventId))
    .innerJoin(clans, eq(clans.id, events.clanId))
    .where(and(eq(eventCohosts.clanId, clanId), eq(eventCohosts.status, 'accepted')));
  const hostSlugByEvent = new Map(cohosted.map((c) => [c.eventId, c.hostSlug]));
  const cohostedIds = cohosted.map((c) => c.eventId);
  const all = await db
    .select()
    .from(events)
    .where(cohostedIds.length ? or(eq(events.clanId, clanId), inArray(events.id, cohostedIds)) : eq(events.clanId, clanId))
    .orderBy(desc(events.createdAt));

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
  const rulesById = new Map(shown.map((e) => [e.id, parseEventRules(e.rules)]));
  // Non-optional tiles only: the same denominator the board uses, and the same tiles a
  // completion has to land on to score.
  const onBoard = or(isNull(tiles.optional), eq(tiles.optional, 0));
  // …and never a MISSION. A mission's points are a bonus on top of the board (lib/boardScoring), so
  // they must not sit in the denominator — otherwise a card's percentage drops the moment a host
  // authors a mission nobody has even been shown yet. Missions still SCORE (the query below has no
  // such filter); they just aren't part of what the board is out of.
  const boardTotalOnly = and(onBoard, or(isNull(tiles.mission), eq(tiles.mission, 0)));

  const teamCounts = new Map<number, number>();
  const boardTotals = new Map<number, number>();
  const claimCounts = new Map<number, number>();
  /** eventId → teamId → { points, tiles } */
  const teamScores = new Map<number, Map<number, { points: number; tiles: number }>>();
  /** Boards that hide tiles until a policy opens them — their completions can't be summed blind. */
  const policyIds = shown.filter((e) => hasRevealPolicy(rulesById.get(e.id)!)).map((e) => e.id);

  const [teamCountRows, totalRows, missionRows, scoreRows] = await Promise.all([
    db
      .select({ eventId: teams.eventId, c: count() })
      .from(teams)
      .where(inArray(teams.eventId, ids))
      .groupBy(teams.eventId),
    db
      .select({
        eventId: tiles.eventId,
        points: sql<number>`coalesce(sum(${tiles.points}), 0)`,
        n: sql<number>`count(*)`,
      })
      .from(tiles)
      .where(and(inArray(tiles.eventId, ids), boardTotalOnly))
      .groupBy(tiles.eventId),
    // One row per event that has any mission tile — the other reason a completion might not
    // count yet. Cheaper than fetching the tiles to find out.
    db
      .select({ eventId: tiles.eventId })
      .from(tiles)
      .where(and(inArray(tiles.eventId, ids), eq(tiles.mission, 1)))
      .groupBy(tiles.eventId),
    // Both scorings in one pass, because scoringMode is per event: `points` is what a points
    // board counts (awardedPoints when frozen, else the tile's weight), `tiles` is what a
    // tile-count board counts. `claims` includes optional tiles — that's the chip, not the score.
    db
      .select({
        eventId: tiles.eventId,
        teamId: completions.teamId,
        points: sql<number>`coalesce(sum(case when coalesce(${tiles.optional}, 0) = 0 then coalesce(${completions.awardedPoints}, ${tiles.points}, 0) else 0 end), 0)`,
        tiles: sql<number>`coalesce(sum(case when coalesce(${tiles.optional}, 0) = 0 then 1 else 0 end), 0)`,
        claims: sql<number>`count(*)`,
      })
      .from(completions)
      .innerJoin(tiles, eq(completions.tileId, tiles.id))
      .where(inArray(tiles.eventId, ids))
      .groupBy(tiles.eventId, completions.teamId),
  ]);

  for (const row of teamCountRows) teamCounts.set(row.eventId, row.c);
  for (const row of totalRows) boardTotals.set(row.eventId, row.points);
  const tileCounts = new Map(totalRows.map((r) => [r.eventId, r.n]));
  for (const row of scoreRows) {
    let byTeam = teamScores.get(row.eventId);
    if (!byTeam) teamScores.set(row.eventId, (byTeam = new Map()));
    byTeam.set(row.teamId, { points: row.points, tiles: row.tiles });
    claimCounts.set(row.eventId, (claimCounts.get(row.eventId) ?? 0) + row.claims);
  }

  // The exceptions: boards where a completion on a still-hidden tile must not score yet. Rather
  // than reading those boards row by row, subtract what the hidden tiles contributed —
  // lib/eventRules.isTileRevealed is `revealedAt != null` for a mission tile, and for a normal
  // tile on a board that has a reveal policy, which is a WHERE clause. `claims` is deliberately
  // NOT reduced: the chip counts what teams have claimed, revealed or not.
  const missionOnlyIds = missionRows.map((r) => r.eventId).filter((id) => !policyIds.includes(id));
  const hiddenWhere = [
    policyIds.length ? and(inArray(tiles.eventId, policyIds), isNull(tiles.revealedAt)) : undefined,
    missionOnlyIds.length
      ? and(inArray(tiles.eventId, missionOnlyIds), eq(tiles.mission, 1), isNull(tiles.revealedAt))
      : undefined,
  ].filter(Boolean);

  if (hiddenWhere.length) {
    const hiddenRows = await db
      .select({
        eventId: tiles.eventId,
        teamId: completions.teamId,
        points: sql<number>`coalesce(sum(case when coalesce(${tiles.optional}, 0) = 0 then coalesce(${completions.awardedPoints}, ${tiles.points}, 0) else 0 end), 0)`,
        tiles: sql<number>`coalesce(sum(case when coalesce(${tiles.optional}, 0) = 0 then 1 else 0 end), 0)`,
      })
      .from(completions)
      .innerJoin(tiles, eq(completions.tileId, tiles.id))
      .where(or(...hiddenWhere))
      .groupBy(tiles.eventId, completions.teamId);

    for (const row of hiddenRows) {
      const entry = teamScores.get(row.eventId)?.get(row.teamId);
      if (!entry) continue;
      entry.points -= row.points;
      entry.tiles -= row.tiles;
    }
  }

  // Only the leading team of each event needs a name and a colour, so that's all we read.
  const topTeamIds = new Set<number>();
  for (const [, byTeam] of teamScores) {
    for (const [teamId] of byTeam) topTeamIds.add(teamId);
  }
  const teamRows = topTeamIds.size
    ? await db
        .select({ id: teams.id, eventId: teams.eventId, name: teams.name, color: teams.color })
        .from(teams)
        .where(inArray(teams.id, [...topTeamIds]))
    : [];
  const teamById = new Map(teamRows.map((t) => [t.id, t]));

  return shown.map((event) => {
    const status: EventCard['status'] = live.some((e) => e.id === event.id)
      ? 'live'
      : upcoming.some((e) => e.id === event.id)
        ? 'upcoming'
        : 'past';
    const rules = rulesById.get(event.id)!;
    const points = isPointsMode(event.scoringMode);
    // The DENOMINATOR is the whole board, including tiles that have not been revealed yet. Scoring
    // against only the open ones makes a reveal board read as nearly finished when it has barely
    // started (the event page does the same — ScoreboardClient's boardPointsTotal).
    const total = points ? boardTotals.get(event.id) ?? 0 : tileCounts.get(event.id) ?? 0;
    const unit = points ? 'pts' : 'tiles';
    const claimedRaw = claimCounts.get(event.id) ?? 0;

    // A board that hasn't started has no standings to report. Nobody can have earned anything yet —
    // and if a row says otherwise it's an anomaly, not a result, so the card must not dress it up as
    // "leading X — 150 pts" six weeks before the whistle. (A completion on an unstarted board is
    // refused outright now; this is what stops one that predates that rule advertising itself.)
    const scoreable = status !== 'upcoming';
    const claimed = scoreable ? claimedRaw : 0;

    let top: EventCard['top'] = null;
    for (const [teamId, score] of scoreable ? teamScores.get(event.id) ?? [] : []) {
      const value = points ? score.points : score.tiles;
      if (top && value <= top.score) continue;
      const team = teamById.get(teamId);
      if (!team || team.eventId !== event.id) continue;
      top = { name: team.name, color: team.color, score: value, total, unit };
    }

    const teamCount = teamCounts.get(event.id) ?? 0;
    // Set only in a CO-HOST's view (the event's own clan is someone else).
    const cardHostSlug = event.clanId === clanId ? null : hostSlugByEvent.get(event.id) ?? null;
    const axes = eventAxes({ ...event, rules });
    const chips: string[] = [];
    if (axes.competitors === 'individuals') {
      if (teamCount > 0) chips.push(`${teamCount} player${teamCount === 1 ? '' : 's'}`);
    } else if (teamCount > 0) {
      chips.push(`${teamCount} team${teamCount === 1 ? '' : 's'}`);
    }
    if (claimed > 0) chips.push(`${claimed} claimed`);
    // Appended (never first — eventsHub parses chips[0] for the entrant count) so a co-host's card
    // reads as theirs-to-play but not theirs-to-run.
    if (cardHostSlug) chips.push(`co-hosted · ${cardHostSlug}`);

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
      mode: modeKeyFor(event.format, event.scoringMode, rules),
      board: { tiles: tileCounts.get(event.id) ?? 0, claimed },
      // Only set when this clan is a co-host (the event's own clan is someone else). Drives the
      // cross-clan link and a "co-hosted" hint on the card.
      hostSlug: cardHostSlug,
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

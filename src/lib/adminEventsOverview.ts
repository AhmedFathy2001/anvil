// The numbers behind the admin Events list.
//
// The list used to be fifteen identical cards, each showing a team count and a tile count — the
// two facts least likely to be why someone opened the page. Everything here already existed in the
// tables; it had just never been selected. Three shapes:
//
//   • RunningEventSummary — what a live board is actually doing right now (hero card).
//   • AttentionItem       — the short list of things blocking progress, across every event.
//   • PastEventResult     — who won, how many played, what it paid (finished-events table).
//
// Every query is grouped across ALL requested events rather than run per event, so the page cost
// stays flat as the clan's history grows. The one exception is standings, which reuses
// lib/statStandings (reveal-policy aware) and only runs for events that are actually live —
// typically one or two.

import { db } from '@/db';
import {
  completions,
  eventSignups,
  events,
  payouts,
  playerEventFacts,
  players,
  signupFees,
  submissions,
  teams,
  tiles,
  weeklyCompetitions,
  weeklyParticipants,
} from '@/db/schema';
import { and, count, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { getTeamStandings } from '@/lib/statStandings';
import { computeStartReadiness, startBlockerLabel } from '@/lib/eventReadiness';
import { formatGp, SPARK_DAYS } from '@/lib/adminEventsFormat';

/** A player counts as "active" if they've been credited inside this window. */
const ACTIVE_WINDOW_DAYS = 7;

export interface StandingRow {
  teamId: number;
  name: string;
  color: string;
  score: number;
  pct: number;
  unit: string;
}

export interface RunningEventSummary {
  eventId: number;
  /** Distinct tiles any team has completed, over the number of scored tiles on the board. */
  tilesCleared: number;
  tilesTotal: number;
  submissionsToday: number;
  activePlayers: number;
  playersTotal: number;
  /** Oldest-first, one entry per day, always SPARK_DAYS long. */
  dailySubmissions: number[];
  standings: StandingRow[];
  latest: LatestCredit[];
}

export interface LatestCredit {
  at: string;
  tile: string;
  /** The player credited, when we know who — stat tiles and solo counts carry one. */
  player: string | null;
  team: string | null;
}

export type AttentionKind =
  | 'signups-pending'
  | 'fee-disputed'
  | 'payouts-unpaid'
  | 'start-blocked'
  | 'no-tiles'
  | 'weekly-flagged';

export interface AttentionItem {
  kind: AttentionKind;
  /** 'urgent' = money or a stuck start; 'warn' = a queue forming; 'info' = worth a look. */
  severity: 'urgent' | 'warn' | 'info';
  title: string;
  detail: string;
  href: string;
}

export interface PastEventResult {
  eventId: number;
  winnerTeam: string | null;
  winnerScore: number | null;
  /** Null when the event finished before per-player results were recorded — the Rebuild button fixes it. */
  hasResults: boolean;
  players: number;
  payoutTotal: number;
  payoutsUnpaid: number;
}

/** Setup progress for an event that hasn't started — mirrors the checklist on the event's own page. */
export interface SetupProgress {
  eventId: number;
  tilesAuthored: number;
  tilesExpected: number;
  teamCount: number;
  assignedPlayers: number;
  signupCount: number;
  hasDates: boolean;
  blockers: string[];
  /** 0–5, how many setup steps are done. Drives the little segmented meter on the card. */
  stepsDone: number;
  stepsTotal: number;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/**
 * Live numbers for the events that are currently running.
 *
 * Returns a map keyed by event id; ids with no activity yet still get a zeroed entry so callers
 * never have to null-check a live board that simply hasn't had a drop.
 */
export async function getRunningEventSummaries(
  running: { id: number; scoringMode: string }[],
): Promise<Map<number, RunningEventSummary>> {
  const out = new Map<number, RunningEventSummary>();
  if (running.length === 0) return out;

  const ids = running.map((e) => e.id);
  const since = isoDaysAgo(SPARK_DAYS - 1);
  const activeSince = isoDaysAgo(ACTIVE_WINDOW_DAYS);
  const today = dayKey(new Date());

  const [scoredTiles, cleared, byDay, activeCounts, playerCounts, latestRows] = await Promise.all([
    // Denominator: tiles that count toward a score. Optional tiles are excluded the same way
    // lib/statStandings excludes them, so "62 / 150" matches the scoreboard's own total.
    db
      .select({ eventId: tiles.eventId, n: count() })
      .from(tiles)
      .where(and(inArray(tiles.eventId, ids), eq(tiles.optional, 0)))
      .groupBy(tiles.eventId),
    db
      .select({ eventId: tiles.eventId, n: sql<number>`count(distinct ${completions.tileId})` })
      .from(completions)
      .innerJoin(tiles, eq(completions.tileId, tiles.id))
      .where(inArray(tiles.eventId, ids))
      .groupBy(tiles.eventId),
    db
      .select({
        eventId: tiles.eventId,
        day: sql<string>`substr(${submissions.createdAt}, 1, 10)`,
        n: count(),
      })
      .from(submissions)
      .innerJoin(tiles, eq(submissions.tileId, tiles.id))
      .where(and(inArray(tiles.eventId, ids), gte(submissions.createdAt, since)))
      .groupBy(tiles.eventId, sql`substr(${submissions.createdAt}, 1, 10)`),
    db
      .select({
        eventId: tiles.eventId,
        n: sql<number>`count(distinct coalesce(${submissions.creditPlayerId}, ${submissions.playerId}))`,
      })
      .from(submissions)
      .innerJoin(tiles, eq(submissions.tileId, tiles.id))
      .where(and(inArray(tiles.eventId, ids), gte(submissions.createdAt, activeSince)))
      .groupBy(tiles.eventId),
    db
      .select({ eventId: players.eventId, n: count() })
      .from(players)
      .where(inArray(players.eventId, ids))
      .groupBy(players.eventId),
    // Most recent credits across all running events at once; sliced per event below. 8 per event
    // is far more than the three the card shows, but keeps one event's quiet day from starving
    // another's feed.
    db
      .select({
        eventId: tiles.eventId,
        at: completions.completedAt,
        tile: tiles.label,
        player: players.name,
        team: teams.name,
      })
      .from(completions)
      .innerJoin(tiles, eq(completions.tileId, tiles.id))
      .leftJoin(players, eq(completions.creditPlayerId, players.id))
      .leftJoin(teams, eq(completions.teamId, teams.id))
      .where(inArray(tiles.eventId, ids))
      .orderBy(desc(completions.completedAt))
      .limit(8 * ids.length),
  ]);

  const standingsByEvent = new Map<number, StandingRow[]>();
  await Promise.all(
    running.map(async (e) => {
      const rows = await getTeamStandings(e.id, e.scoringMode).catch(() => []);
      standingsByEvent.set(
        e.id,
        rows.slice(0, 5).map((r) => ({
          teamId: r.teamId,
          name: r.name,
          color: r.color,
          score: r.score,
          pct: r.pct,
          unit: r.unit,
        })),
      );
    }),
  );

  const days: string[] = [];
  for (let i = SPARK_DAYS - 1; i >= 0; i--) days.push(dayKey(new Date(Date.now() - i * 86_400_000)));

  for (const e of running) {
    const perDay = new Map(byDay.filter((r) => r.eventId === e.id).map((r) => [r.day, r.n]));
    out.set(e.id, {
      eventId: e.id,
      tilesCleared: cleared.find((r) => r.eventId === e.id)?.n ?? 0,
      tilesTotal: scoredTiles.find((r) => r.eventId === e.id)?.n ?? 0,
      submissionsToday: perDay.get(today) ?? 0,
      activePlayers: activeCounts.find((r) => r.eventId === e.id)?.n ?? 0,
      playersTotal: playerCounts.find((r) => r.eventId === e.id)?.n ?? 0,
      dailySubmissions: days.map((d) => perDay.get(d) ?? 0),
      standings: standingsByEvent.get(e.id) ?? [],
      latest: latestRows
        .filter((r) => r.eventId === e.id)
        .slice(0, 3)
        .map((r) => ({ at: r.at, tile: r.tile, player: r.player, team: r.team })),
    });
  }

  return out;
}

/**
 * Everything across every event that's waiting on a human, newest problem first.
 *
 * Deliberately short: this is the strip at the top of the page, not a report. Each item names the
 * thing and links to the tab that fixes it.
 */
export async function getAttentionItems(opts: {
  liveEventIds: number[];
  upcomingEventIds: number[];
  endedEventIds: number[];
}): Promise<AttentionItem[]> {
  const { liveEventIds, upcomingEventIds, endedEventIds } = opts;
  const openIds = [...liveEventIds, ...upcomingEventIds];
  const items: AttentionItem[] = [];

  const [pendingSignups, disputes, unpaid, flagged] = await Promise.all([
    openIds.length
      ? db
          .select({ eventId: eventSignups.eventId, n: count() })
          .from(eventSignups)
          .where(and(inArray(eventSignups.eventId, openIds), eq(eventSignups.status, 'pending')))
          .groupBy(eventSignups.eventId)
      : [],
    openIds.length
      ? db
          .select({ eventId: eventSignups.eventId, n: count() })
          .from(signupFees)
          .innerJoin(eventSignups, eq(signupFees.signupId, eventSignups.id))
          .where(and(inArray(eventSignups.eventId, openIds), eq(signupFees.status, 'disputed')))
          .groupBy(eventSignups.eventId)
      : [],
    endedEventIds.length
      ? db
          .select({
            eventId: payouts.eventId,
            n: count(),
            gp: sql<number>`coalesce(sum(${payouts.amount}), 0)`,
          })
          .from(payouts)
          .where(and(inArray(payouts.eventId, endedEventIds), eq(payouts.status, 'pending')))
          .groupBy(payouts.eventId)
      : [],
    db
      .select({
        competitionId: weeklyParticipants.competitionId,
        title: weeklyCompetitions.title,
        n: count(),
      })
      .from(weeklyParticipants)
      .innerJoin(weeklyCompetitions, eq(weeklyParticipants.competitionId, weeklyCompetitions.id))
      .where(and(eq(weeklyParticipants.flagged, 1), eq(weeklyCompetitions.status, 'active')))
      .groupBy(weeklyParticipants.competitionId, weeklyCompetitions.title),
  ]);

  const names = openIds.length || endedEventIds.length
    ? new Map(
        (
          await db
            .select({ id: events.id, name: events.name })
            .from(events)
            .where(inArray(events.id, [...openIds, ...endedEventIds]))
        ).map((r) => [r.id, r.name]),
      )
    : new Map<number, string>();

  for (const row of unpaid) {
    items.push({
      kind: 'payouts-unpaid',
      severity: 'urgent',
      title: `${row.n} payout${row.n === 1 ? '' : 's'} still owed`,
      detail: `${names.get(row.eventId) ?? 'An event'} · ${formatGp(row.gp)} unpaid`,
      href: `/admin/events/${row.eventId}/payouts`,
    });
  }
  for (const row of disputes) {
    items.push({
      kind: 'fee-disputed',
      severity: 'urgent',
      title: `${row.n} fee dispute${row.n === 1 ? '' : 's'}`,
      detail: `${names.get(row.eventId) ?? 'An event'} · collector and player disagree`,
      href: `/admin/events/${row.eventId}/signups`,
    });
  }
  for (const row of flagged) {
    items.push({
      kind: 'weekly-flagged',
      severity: 'warn',
      title: `${row.n} flagged baseline${row.n === 1 ? '' : 's'}`,
      detail: `${row.title} · a gain looks implausible`,
      href: '/admin/weekly',
    });
  }
  for (const row of pendingSignups) {
    items.push({
      kind: 'signups-pending',
      severity: 'warn',
      title: `${row.n} sign-up${row.n === 1 ? '' : 's'} waiting`,
      detail: `${names.get(row.eventId) ?? 'An event'} · review and approve`,
      href: `/admin/events/${row.eventId}/signups`,
    });
  }

  return items;
}

/**
 * The attention items an unstarted event raises about itself.
 *
 * Kept next to getAttentionItems (and pure, so it needs no queries) because these are the two
 * problems the DB can't spot on its own: a board nobody finished writing, and a start time that
 * has already come and gone while the event was unstartable.
 */
export function setupAttentionItems(
  event: { id: number; name: string; startDate: string | null; startNotified: number | null; forceEndedAt: string | null },
  progress: SetupProgress,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (progress.blockers.length > 0 && isStartHeld(event)) {
    items.push({
      kind: 'start-blocked',
      severity: 'urgent',
      title: `${event.name} should have started`,
      detail: `Held — ${progress.blockers[0]}`,
      href: `/admin/events/${event.id}/teams`,
    });
  } else if (progress.blockers.length > 0 && event.startDate) {
    items.push({
      kind: 'start-blocked',
      severity: 'warn',
      title: `${event.name} can't start yet`,
      detail: progress.blockers[0],
      href: `/admin/events/${event.id}/teams`,
    });
  }

  if (progress.tilesExpected > 0 && progress.tilesAuthored < progress.tilesExpected) {
    items.push({
      kind: 'no-tiles',
      severity: progress.tilesAuthored === 0 ? 'warn' : 'info',
      title: `${event.name} is ${progress.tilesAuthored} of ${progress.tilesExpected} tiles`,
      detail: progress.tilesAuthored === 0 ? 'Nothing authored yet' : 'Board still being written',
      href: `/admin/events/${event.id}/tiles`,
    });
  }

  return items;
}

/**
 * Setup state for events that haven't started, so a card can say what's left instead of "0 teams".
 *
 * `tilesExpected` is the board's declared size (N² for a square grid, N otherwise) — an event with
 * fewer authored tiles than that is still being written.
 */
export async function getSetupProgress(
  upcoming: { id: number; expectedTiles: number; draftStatus: string; hasDates: boolean }[],
): Promise<Map<number, SetupProgress>> {
  const out = new Map<number, SetupProgress>();
  if (upcoming.length === 0) return out;
  const ids = upcoming.map((e) => e.id);

  const [tileCounts, teamCounts, assigned, totalPlayers, signupCounts] = await Promise.all([
    db.select({ eventId: tiles.eventId, n: count() }).from(tiles).where(inArray(tiles.eventId, ids)).groupBy(tiles.eventId),
    db.select({ eventId: teams.eventId, n: count() }).from(teams).where(inArray(teams.eventId, ids)).groupBy(teams.eventId),
    db
      .select({ eventId: players.eventId, n: count() })
      .from(players)
      .where(and(inArray(players.eventId, ids), isNotNull(players.teamId)))
      .groupBy(players.eventId),
    db.select({ eventId: players.eventId, n: count() }).from(players).where(inArray(players.eventId, ids)).groupBy(players.eventId),
    db
      .select({ eventId: eventSignups.eventId, n: count() })
      .from(eventSignups)
      .where(and(inArray(eventSignups.eventId, ids), eq(eventSignups.status, 'approved')))
      .groupBy(eventSignups.eventId),
  ]);

  for (const e of upcoming) {
    const tilesAuthored = tileCounts.find((r) => r.eventId === e.id)?.n ?? 0;
    const teamCount = teamCounts.find((r) => r.eventId === e.id)?.n ?? 0;
    const assignedPlayers = assigned.find((r) => r.eventId === e.id)?.n ?? 0;
    const readiness = computeStartReadiness({
      draftStatus: e.draftStatus,
      teamCount,
      assignedPlayerCount: assignedPlayers,
      totalPlayerCount: totalPlayers.find((r) => r.eventId === e.id)?.n ?? 0,
    });
    const tilesDone = tilesAuthored >= e.expectedTiles && e.expectedTiles > 0;
    const stepsDone = [tilesDone, teamCount > 0, assignedPlayers > 0, e.hasDates, readiness.ready].filter(Boolean).length;

    out.set(e.id, {
      eventId: e.id,
      tilesAuthored,
      tilesExpected: e.expectedTiles,
      teamCount,
      assignedPlayers,
      signupCount: signupCounts.find((r) => r.eventId === e.id)?.n ?? 0,
      hasDates: e.hasDates,
      blockers: readiness.blockers.map(startBlockerLabel),
      stepsDone,
      stepsTotal: 5,
    });
  }

  return out;
}

/**
 * Results for finished events — the one thing people come back to a past event for.
 *
 * Winners are read from `player_event_facts` (materialised when an event ends) rather than
 * recomputed from completions: an eleven-event history would otherwise mean eleven scoreboard
 * rebuilds on every page load. Events that finished before that machinery existed come back with
 * `hasResults: false`, which is exactly what the "Rebuild past results" action fills in.
 */
export async function getPastEventResults(eventIds: number[]): Promise<Map<number, PastEventResult>> {
  const out = new Map<number, PastEventResult>();
  if (eventIds.length === 0) return out;

  const [winners, playerCounts, payoutRows] = await Promise.all([
    db
      .select({
        eventId: playerEventFacts.eventId,
        teamId: playerEventFacts.teamId,
        teamName: teams.name,
        teamPoints: playerEventFacts.teamPoints,
      })
      .from(playerEventFacts)
      .leftJoin(teams, eq(playerEventFacts.teamId, teams.id))
      .where(and(inArray(playerEventFacts.eventId, eventIds), eq(playerEventFacts.teamRank, 1))),
    db
      .select({ eventId: playerEventFacts.eventId, n: sql<number>`count(distinct ${playerEventFacts.personKey})` })
      .from(playerEventFacts)
      .where(inArray(playerEventFacts.eventId, eventIds))
      .groupBy(playerEventFacts.eventId),
    db
      .select({
        eventId: payouts.eventId,
        total: sql<number>`coalesce(sum(${payouts.amount}), 0)`,
        unpaid: sql<number>`coalesce(sum(case when ${payouts.status} = 'pending' then 1 else 0 end), 0)`,
      })
      .from(payouts)
      .where(inArray(payouts.eventId, eventIds))
      .groupBy(payouts.eventId),
  ]);

  // Enrolment is the fallback headcount for events with no facts, so the column isn't blank for
  // every pre-facts event in the table.
  const enrolled = await db
    .select({ eventId: players.eventId, n: count() })
    .from(players)
    .where(inArray(players.eventId, eventIds))
    .groupBy(players.eventId);

  for (const id of eventIds) {
    const win = winners.find((w) => w.eventId === id);
    const factPlayers = playerCounts.find((p) => p.eventId === id)?.n ?? 0;
    const pay = payoutRows.find((p) => p.eventId === id);
    out.set(id, {
      eventId: id,
      winnerTeam: win?.teamName ?? null,
      winnerScore: win?.teamPoints ?? null,
      hasResults: factPlayers > 0,
      players: factPlayers || (enrolled.find((p) => p.eventId === id)?.n ?? 0),
      payoutTotal: pay?.total ?? 0,
      payoutsUnpaid: pay?.unpaid ?? 0,
    });
  }

  return out;
}

/** Participation for finished weekly competitions, so their row in the table isn't a blank. */
export async function getPastWeeklyResults(
  competitionIds: number[],
): Promise<Map<number, { winner: string | null; gained: number | null; players: number }>> {
  const out = new Map<number, { winner: string | null; gained: number | null; players: number }>();
  if (competitionIds.length === 0) return out;

  const rows = await db
    .select({
      competitionId: weeklyParticipants.competitionId,
      rsn: weeklyParticipants.rsn,
      baselineValue: weeklyParticipants.baselineValue,
      currentValue: weeklyParticipants.currentValue,
    })
    .from(weeklyParticipants)
    .where(inArray(weeklyParticipants.competitionId, competitionIds));

  for (const id of competitionIds) {
    const mine = rows.filter((r) => r.competitionId === id);
    let winner: string | null = null;
    let best = -1;
    for (const r of mine) {
      const gained = (r.currentValue ?? 0) - (r.baselineValue ?? 0);
      if (gained > best) {
        best = gained;
        winner = r.rsn;
      }
    }
    out.set(id, { winner: best > 0 ? winner : null, gained: best > 0 ? best : null, players: mine.length });
  }

  return out;
}

/** Events whose scheduled start has passed while they were still unstartable (lib/eventReadiness). */
export function isStartHeld(event: { startDate: string | null; startNotified: number | null; forceEndedAt: string | null }): boolean {
  if (!event.startDate || event.forceEndedAt || event.startNotified) return false;
  return Date.parse(event.startDate) <= Date.now();
}

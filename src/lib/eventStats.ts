import { db } from '@/db';
import { clans, completions, eventHourSnapshots, eventParticipants, events, moments, submissions, teams, tiles } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { scoreTeams } from '@/lib/boardScoring';
import { parseEventRules, visibleTiles } from '@/lib/eventRules';
import { effectiveStatsForPlayers } from '@/lib/liveStats';
import { countTurnIns } from '@/lib/turnIns';
import { eventActivityIsValid } from '@/lib/completionGate';
import { loadPlayerOwners } from '@/lib/draftProfiles';
import { computePointsTimeline, type PointsTimeline } from '@/lib/pointsTimeline';
import { getStatStandings } from '@/lib/statStandings';
import { parseContributionSnapshot } from '@/lib/statTracking';
import type { StatGainMap } from '@/lib/memberBreakdown';
import {
  DAY_MS,
  HOUR_MS,
  eventDayCount,
  hourTuple,
  stampMs,
  tupleDiff,
  type HourPlayerTuple,
  type HourSnapshotData,
} from '@/lib/eventDay';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The event stats page: everything per member, per team and per hour, for the whole event or one day.
//
// Three sources, each used for what it is good at:
//   • timestamped rows — completions, submissions, moments (drops, pets, deaths) — split by any
//     window exactly, for any event, past ones included;
//   • the player row's running counters (plugin deaths/loot/playtime, live-merged XP/KC) — the
//     "now" value of everything that only exists as a running total;
//   • the hourly rows (lib/eventHourly) — those running totals at each hour boundary, so a day or an
//     hour can be diffed out of them. Missing before the feature existed or while the box was down;
//     a window whose start has no row says "not recorded" rather than guessing.
//
// Read-only and never part of scoring. Moments are client-reported and shown as what was seen.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export type StatsWindow = { kind: 'all' } | { kind: 'day'; day: number };

export interface StatsCounters {
  xp: number;
  kc: number;
  deaths: number;
  loot: number;
  minutes: number;
}

export interface MemberStats {
  id: number;
  name: string;
  teamId: number | null;
  /** Null when the window's opening boundary was never recorded (see header). */
  counters: StatsCounters | null;
  rares: number;
  pets: number;
  tiles: number;
  turnIns: number;
}

export interface SideStats {
  teamId: number;
  name: string;
  color: string;
  clanName: string | null;
  score: number;
  scoreGained: number;
  counters: StatsCounters | null;
  rares: number;
  pets: number;
  deaths: number;
  tiles: number;
  members: number;
}

export interface DropLine {
  id: number;
  rsn: string;
  teamId: number | null;
  kind: string;
  itemId: number | null;
  itemName: string | null;
  quantity: number;
  valueGp: number | null;
  source: string | null;
  occurredAt: string;
}

export interface TileLine {
  label: string;
  points: number | null;
  teamId: number;
  playerName: string | null;
  completedAt: string;
}

export type SeriesKey = 'points' | 'xp' | 'kc' | 'deaths' | 'loot' | 'drops';

export interface HourlySeries {
  /** Epoch ms of each point; the first is the window's start. */
  at: number[];
  /** Per series, per team: the running total since the window's start, null where unrecorded. */
  series: Record<SeriesKey, Record<number, (number | null)[]>>;
}

export interface EventStatsData {
  event: { id: number; name: string; startMs: number; endMs: number; nowMs: number; started: boolean; ended: boolean; dayCount: number; currentDay: number | null };
  window: { kind: 'all' | 'day'; day: number | null; fromMs: number; toMs: number; live: boolean };
  unit: string;
  isClanBoard: boolean;
  sides: SideStats[];
  members: MemberStats[];
  drops: DropLine[];
  deaths: { total: number; killers: { name: string; count: number }[]; recent: DropLine[] };
  tiles: TileLine[];
  hourly: HourlySeries;
  /** False when no hourly row exists yet — the curves for counters are empty, points/drops still draw. */
  hourlyRecorded: boolean;
  /** Whole-event score and top-scorer curves (lib/pointsTimeline), whatever the window. */
  pointsTimeline: PointsTimeline;
}

const ZERO: HourPlayerTuple = [0, 0, 0, 0, 0];

const toCounters = (t: HourPlayerTuple): StatsCounters => ({ xp: t[0], kc: t[1], deaths: t[2], loot: t[3], minutes: t[4] });

function addCounters(a: StatsCounters | null, b: StatsCounters | null): StatsCounters | null {
  if (!a || !b) return a ?? b;
  return { xp: a.xp + b.xp, kc: a.kc + b.kc, deaths: a.deaths + b.deaths, loot: a.loot + b.loot, minutes: a.minutes + b.minutes };
}

/** Clamp a requested window to the event and the present. Null for a day that doesn't exist (yet). */
export function resolveWindow(
  w: StatsWindow,
  startMs: number,
  endMs: number,
  nowMs: number,
): { kind: 'all' | 'day'; day: number | null; fromMs: number; toMs: number; live: boolean } | null {
  const cap = Math.min(endMs, nowMs);
  if (w.kind === 'all') return { kind: 'all', day: null, fromMs: startMs, toMs: Math.max(startMs, cap), live: nowMs < endMs };
  const dayCount = eventDayCount(startMs, endMs);
  if (!Number.isInteger(w.day) || w.day < 1 || w.day > dayCount) return null;
  const fromMs = startMs + (w.day - 1) * DAY_MS;
  if (fromMs > nowMs) return null;
  const dayEnd = Math.min(startMs + w.day * DAY_MS, endMs);
  return { kind: 'day', day: w.day, fromMs, toMs: Math.min(dayEnd, nowMs), live: nowMs < dayEnd };
}

export async function getEventStats(eventId: number, w: StatsWindow, nowMs = Date.now()): Promise<EventStatsData | null> {
  // clan-scope: global -- the page resolved the event through requireEventForParticipantPage first.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return null;
  const startMs = stampMs(event.startDate);
  const endMs = stampMs(event.endDate);
  if (startMs == null || endMs == null) return null;
  const effectiveEnd = event.forceEndedAt ? Math.min(endMs, stampMs(event.forceEndedAt) ?? endMs) : endMs;
  const win = resolveWindow(w, startMs, effectiveEnd, nowMs);
  if (!win) return null;

  const [eventTeams, eventTiles, eventPlayers, hourRows, eventMoments] = await Promise.all([
    db.select().from(teams).where(eq(teams.eventId, eventId)),
    db.select().from(tiles).where(eq(tiles.eventId, eventId)),
    db.select().from(eventParticipants).where(eq(eventParticipants.eventId, eventId)),
    db.select({ hourIndex: eventHourSnapshots.hourIndex, data: eventHourSnapshots.data }).from(eventHourSnapshots).where(eq(eventHourSnapshots.eventId, eventId)),
    db
      .select({
        id: moments.id,
        clanMemberId: moments.clanMemberId,
        rsn: moments.rsn,
        kind: moments.kind,
        teamId: moments.teamId,
        itemId: moments.itemId,
        itemName: moments.itemName,
        quantity: moments.quantity,
        valueGp: moments.valueGp,
        source: moments.source,
        occurredAt: moments.occurredAt,
      })
      .from(moments)
      .where(eq(moments.eventId, eventId))
      .limit(20_000),
  ]);
  const tileIds = eventTiles.map((t) => t.id);
  const [allCompletions, allSubmissions] = tileIds.length
    ? await Promise.all([
        db.select().from(completions).where(inArray(completions.tileId, tileIds)),
        db
          .select({
            tileId: submissions.tileId,
            teamId: submissions.teamId,
            creditPlayerId: submissions.creditPlayerId,
            playerId: submissions.playerId,
            amount: submissions.amount,
            createdAt: submissions.createdAt,
          })
          .from(submissions)
          .where(inArray(submissions.tileId, tileIds)),
      ])
    : [[], []];

  const clanIds = [...new Set(eventTeams.map((t) => t.clanId).filter((id): id is number => id != null))];
  // clan-scope: global -- names of the clans already on this event's teams.
  const clanRows = clanIds.length ? await db.select({ id: clans.id, name: clans.name }).from(clans).where(inArray(clans.id, clanIds)) : [];
  const clanName = new Map(clanRows.map((c) => [c.id, c.name]));
  const isClanBoard = clanIds.length >= 2;

  const inWin = (stamp: string | null | undefined) => {
    const ms = stampMs(stamp);
    return ms != null && ms >= win.fromMs && ms < win.toMs + 1;
  };

  // ── Running counters at a boundary ─────────────────────────────────────────────────────────────
  const rows = new Map<number, HourSnapshotData>();
  for (const r of hourRows) {
    try {
      rows.set(r.hourIndex, JSON.parse(r.data) as HourSnapshotData);
    } catch {
      /* a garbled row is a gap */
    }
  }
  const statsNow = await effectiveStatsForPlayers(eventPlayers);
  const live = new Map(eventPlayers.map((p) => [p.id, hourTuple(p, statsNow.get(p.id))]));
  const liveFrom = Math.min(nowMs, effectiveEnd);
  /** Every player's tuple at `ms`: zeroes at the start, live at/after now (or the end), a row on an hour, else null. */
  const tuplesAt = (ms: number): Map<number, HourPlayerTuple> | null => {
    if (ms <= startMs) return new Map(eventPlayers.map((p) => [p.id, ZERO]));
    if (ms >= liveFrom) return live;
    const h = (ms - startMs) / HOUR_MS;
    const row = Number.isInteger(h) ? rows.get(h) : undefined;
    if (!row) return null;
    return new Map(eventPlayers.map((p) => [p.id, row.p[String(p.id)] ?? ZERO]));
  };
  // Both ends must be known for a window's counters; one missing boundary is "not recorded".
  const fromTuples = tuplesAt(win.fromMs);
  const closing = tuplesAt(win.toMs);
  const opening = fromTuples && closing ? fromTuples : null;

  // ── Scoring at a moment, from completions ──────────────────────────────────────────────────────
  const rules = parseEventRules(event.rules);
  const scoreAt = (ms: number) => {
    const scored = scoreTeams({
      scoringMode: event.scoringMode,
      rules,
      tiles: eventTiles,
      completions: allCompletions.filter((c) => (stampMs(c.completedAt) ?? 0) <= ms),
      teams: eventTeams,
    });
    return { byTeam: new Map(scored.map((s) => [s.teamId, s.score])), unit: scored[0]?.unit };
  };
  const scoreEnd = scoreAt(win.toMs);
  const scoreStart = win.fromMs <= startMs ? new Map<number, number>() : scoreAt(win.fromMs).byTeam;
  const unit = scoreEnd.unit ?? (event.scoringMode === 'points' ? 'pts' : 'tiles');

  // ── Members ────────────────────────────────────────────────────────────────────────────────────
  const playerByMember = new Map<number, (typeof eventPlayers)[number]>();
  for (const p of eventPlayers) if (p.clanMemberId != null) playerByMember.set(p.clanMemberId, p);
  const tileTypeOf = new Map(eventTiles.map((t) => [t.id, t.tileType]));
  const winMoments = eventMoments.filter((m) => inWin(m.occurredAt));
  const winCompletions = allCompletions.filter((c) => inWin(c.completedAt));
  const winSubs = allSubmissions.filter((s) => inWin(s.createdAt));

  const members: MemberStats[] = eventPlayers.map((p) => {
    const mine = winMoments.filter((m) => playerByMember.get(m.clanMemberId)?.id === p.id);
    const subs = winSubs.filter((s) => (s.creditPlayerId ?? s.playerId) === p.id);
    return {
      id: p.id,
      name: p.name,
      teamId: p.teamId,
      counters: opening && closing ? toCounters(tupleDiff(opening.get(p.id), closing.get(p.id))) : null,
      rares: mine.filter((m) => m.kind === 'unique').length,
      pets: mine.filter((m) => m.kind === 'pet').length,
      tiles: winCompletions.filter((c) => c.creditPlayerId === p.id).length,
      turnIns: countTurnIns(subs, (id) => tileTypeOf.get(id), () => p.id),
    };
  });

  // ── Sides ──────────────────────────────────────────────────────────────────────────────────────
  const sides: SideStats[] = eventTeams.map((t) => {
    const roster = members.filter((m) => m.teamId === t.id);
    const teamMoments = winMoments.filter((m) => m.teamId === t.id);
    return {
      teamId: t.id,
      name: t.name,
      color: t.color,
      clanName: t.clanId != null ? clanName.get(t.clanId) ?? null : null,
      score: scoreEnd.byTeam.get(t.id) ?? 0,
      scoreGained: (scoreEnd.byTeam.get(t.id) ?? 0) - (scoreStart.get(t.id) ?? 0),
      counters: opening ? roster.reduce<StatsCounters | null>((sum, m) => addCounters(sum, m.counters), { xp: 0, kc: 0, deaths: 0, loot: 0, minutes: 0 }) : null,
      rares: teamMoments.filter((m) => m.kind === 'unique').length,
      pets: teamMoments.filter((m) => m.kind === 'pet').length,
      deaths: teamMoments.filter((m) => m.kind === 'death').length,
      tiles: winCompletions.filter((c) => c.teamId === t.id).length,
      members: roster.length,
    };
  });
  sides.sort((a, b) => b.score - a.score);

  // ── Feeds ──────────────────────────────────────────────────────────────────────────────────────
  const line = (m: (typeof eventMoments)[number]): DropLine => ({
    id: m.id,
    rsn: m.rsn,
    teamId: m.teamId,
    kind: m.kind,
    itemId: m.itemId,
    itemName: m.itemName,
    quantity: m.quantity,
    valueGp: m.valueGp,
    source: m.source,
    occurredAt: m.occurredAt,
  });
  const newestFirst = (a: { occurredAt: string }, b: { occurredAt: string }) => (stampMs(b.occurredAt) ?? 0) - (stampMs(a.occurredAt) ?? 0);
  const drops = winMoments.filter((m) => m.kind === 'pet' || m.kind === 'unique' || m.kind === 'loot').sort(newestFirst).slice(0, 300).map(line);
  const deathRows = winMoments.filter((m) => m.kind === 'death').sort(newestFirst);
  const killerCount = new Map<string, number>();
  for (const d of deathRows) if (d.source) killerCount.set(d.source, (killerCount.get(d.source) ?? 0) + 1);
  const killers = [...killerCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  // Tile names stay behind the curtain the board itself draws: unrevealed boards and unrevealed
  // reveal-mode tiles read "Hidden tile" here too.
  const shown = new Set(event.tilesRevealed ? visibleTiles(rules, eventTiles).map((t) => t.id) : []);
  const tileById = new Map(eventTiles.map((t) => [t.id, t]));
  const playerName = new Map(eventPlayers.map((p) => [p.id, p.name]));
  const tileLines: TileLine[] = winCompletions
    .map((c) => {
      const tile = tileById.get(c.tileId);
      return {
        label: tile && shown.has(tile.id) ? tile.label : 'Hidden tile',
        points: tile && shown.has(tile.id) ? tile.points ?? null : null,
        teamId: c.teamId,
        playerName: c.creditPlayerId != null ? playerName.get(c.creditPlayerId) ?? null : null,
        completedAt: c.completedAt,
      };
    })
    .sort((a, b) => (stampMs(b.completedAt) ?? 0) - (stampMs(a.completedAt) ?? 0));

  // ── Hourly curves ──────────────────────────────────────────────────────────────────────────────
  // Points on every whole hour of the event inside the window, plus the window's two ends.
  const at: number[] = [win.fromMs];
  const firstHour = Math.floor((win.fromMs - startMs) / HOUR_MS) + 1;
  for (let h = firstHour; startMs + h * HOUR_MS < win.toMs; h++) at.push(startMs + h * HOUR_MS);
  if (win.toMs > win.fromMs) at.push(win.toMs);

  const teamOf = new Map(eventPlayers.map((p) => [p.id, p.teamId]));
  const keys: SeriesKey[] = ['points', 'xp', 'kc', 'deaths', 'loot', 'drops'];
  const series = Object.fromEntries(keys.map((k) => [k, Object.fromEntries(eventTeams.map((t) => [t.id, [] as (number | null)[]]))])) as HourlySeries['series'];
  const base0 = scoreStart;
  const dropsByTeam = new Map<number, number[]>();
  for (const m of winMoments) {
    if (m.teamId == null || !(m.kind === 'pet' || m.kind === 'unique')) continue;
    const list = dropsByTeam.get(m.teamId) ?? [];
    list.push(stampMs(m.occurredAt) ?? 0);
    dropsByTeam.set(m.teamId, list);
  }
  for (const ms of at) {
    const sc = ms === win.toMs ? scoreEnd.byTeam : scoreAt(ms).byTeam;
    const tuples = tuplesAt(ms);
    const sums = new Map<number, HourPlayerTuple>();
    if (tuples && fromTuples) {
      for (const p of eventPlayers) {
        const team = teamOf.get(p.id);
        if (team == null) continue;
        const d = tupleDiff(fromTuples.get(p.id), tuples.get(p.id));
        const s = sums.get(team) ?? [0, 0, 0, 0, 0];
        sums.set(team, s.map((v, i) => v + d[i]) as HourPlayerTuple);
      }
    }
    for (const t of eventTeams) {
      series.points[t.id].push((sc.get(t.id) ?? 0) - (base0.get(t.id) ?? 0));
      const s = tuples && fromTuples ? sums.get(t.id) ?? ZERO : null;
      series.xp[t.id].push(s ? s[0] : null);
      series.kc[t.id].push(s ? s[1] : null);
      series.deaths[t.id].push(s ? s[2] : null);
      series.loot[t.id].push(s ? s[3] : null);
      series.drops[t.id].push((dropsByTeam.get(t.id) ?? []).filter((x) => x <= ms).length);
    }
  }

  // ── Points over time ───────────────────────────────────────────────────────────────────────────
  // The event page's own inputs to the scoreboard and MVP: only activity that happened during the
  // event, frozen stat splits, and live gains only for a legacy stat completion that has none.
  const validCompletions = allCompletions
    .filter((c) => eventActivityIsValid(event, c.completedAt, nowMs))
    .map((c) => ({ ...c, statContributions: parseContributionSnapshot(c.statContributions) }));
  const statTileIds = new Set(eventTiles.filter((t) => t.trackedStat).map((t) => t.id));
  const legacyStatTiles = [...new Set(validCompletions.filter((c) => statTileIds.has(c.tileId) && !c.statContributions).map((c) => c.tileId))];
  const statGains: StatGainMap = {};
  if (legacyStatTiles.length) {
    for (const s of await getStatStandings(eventId, legacyStatTiles)) {
      statGains[s.tileId] = s.players.map((pl) => ({ playerId: pl.playerId, gained: pl.gained }));
    }
  }
  const pointsTimeline = computePointsTimeline({
    scoringMode: event.scoringMode,
    rules,
    startMs,
    toMs: Math.max(startMs, Math.min(effectiveEnd, nowMs)),
    teams: eventTeams,
    players: eventPlayers,
    tiles: eventTiles,
    completions: validCompletions,
    submissions: allSubmissions.filter((s) => eventActivityIsValid(event, s.createdAt, nowMs)),
    statGains,
    ownerByPlayerId: event.accountSlotMode === 'per-person' ? await loadPlayerOwners(eventPlayers) : undefined,
    accountSlotMode: event.accountSlotMode,
    topN: 6,
  });

  const started = nowMs >= startMs;
  const ended = nowMs >= effectiveEnd;
  return {
    event: {
      id: event.id,
      name: event.name,
      startMs,
      endMs: effectiveEnd,
      nowMs,
      started,
      ended,
      dayCount: eventDayCount(startMs, effectiveEnd),
      currentDay: started && !ended ? Math.floor((nowMs - startMs) / DAY_MS) + 1 : null,
    },
    window: win,
    unit,
    isClanBoard,
    sides,
    members,
    drops,
    deaths: { total: deathRows.length, killers, recent: deathRows.slice(0, 50).map(line) },
    tiles: tileLines,
    hourly: { at, series },
    hourlyRecorded: rows.size > 0,
    pointsTimeline,
  };
}

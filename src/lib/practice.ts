// Practice boards — a clan admin's short TEST board, inside their own clan, on real characters.
//
// WHY IT EXISTS. Before a real event an admin wants to see that the tiles track, the plugin pops,
// and the Discord posts look right. A practice board is an ordinary event row (so the real plugin,
// the real crediting engine and the real post builders all run on it) with `events.practice = true`,
// a handful of the clan's own people on it, and a short clock.
//
// WHY IT IS A FLAG AND NOT A HIDDEN CLAN like the tile lab (lib/lab). It has to be in the real clan:
// the players are the clan's members, connected to the clan's address, and the copied tiles carry
// the clan's own rules. So the isolation is per event, and every place that reads events for
// something outside the event says "not practice" itself (lib/practiceScope). The places are listed
// in that file's callers; the ones that matter most:
//
//   - Discord: sendEventBingoWebhook (lib/discord) sends a practice board's posts to its own test
//     webhook only, unpinged, never the clan's channels, co-hosts or extra hooks. Lifecycle posts are
//     latched off at creation (start, hold, halfway, end) exactly like a lab board.
//   - Moments and the clan feed: a practice board is never a moment's board (lib/auth
//     pluginParticipantScope { practice: false }), so a real drop lands on the real board and the clan
//     feed as if the practice board were not there.
//   - The plugin's single "active board" pick prefers a real board (lib/pluginEventPick); a practice
//     board is still credited through the multi-board config, and tells the plugin `practice: true`.
//   - Listings, calendars, the clan home, points, facts, wrapped, highlights, crons: `notPractice()`.
//
// WHO. Created and managed by clan admins (the same gate as "New event"). The people on it — any
// member of the clan, up to five — may VIEW it while it runs (lib/eventAccess canSeeEvent), and
// nobody else sees it at all.

import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  accounts,
  clanMemberships,
  completions,
  eventEditors,
  eventParticipants,
  events,
  moments,
  practiceBoards,
  statTileProgress,
  submissions,
  teams,
  tileClaims,
  tiles,
} from '@/db/schema';
import { parseStamp } from '@/lib/dbTime';
import { purgeEventMedia } from '@/lib/eventMediaRetention';
import { parseEventRules } from '@/lib/eventRules';
import { log } from '@/lib/logger';
import { progressGoal, progressStore, type ProgressStore } from '@/lib/labTileProgress';
import { countProgress } from '@/lib/countProgress';
import { liveStatsForMembers } from '@/lib/liveStats';
import { countedModes, statGainWithModes } from '@/lib/modeStats';
import { gainSinceReveal, parseRevealStats } from '@/lib/revealStats';
import { captureRaceOpenStats, clearRaceOpenStats } from '@/lib/revealStatsCapture';
import { creditStatTilesForTeam } from '@/lib/statTileCredit';
import { syncDropTileCompletion } from '@/lib/submissions';
import { notifyBoardPeople } from '@/lib/pushNotify';
import { statKeys } from '@/lib/tileKinds';
import {
  PRACTICE_MAX_TILES,
  practiceDue,
  practiceEndedAt,
  practiceRunning,
  practiceTeams,
  type PracticeInput,
} from '@/lib/practiceRules';

type EventRow = typeof events.$inferSelect;
type TileRow = typeof tiles.$inferSelect;

/** A request the practice board cannot honour, with words for the admin. */
export class PracticeError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────────────────────

/** This clan's practice board with this id, with its settings — or null. Every route starts here. */
export async function practiceBoardInClan(clanId: number, eventId: number): Promise<{ event: EventRow; board: typeof practiceBoards.$inferSelect } | null> {
  if (!Number.isInteger(eventId)) return null;
  const [row] = await db
    .select({ event: events, board: practiceBoards })
    .from(events)
    .innerJoin(practiceBoards, eq(practiceBoards.eventId, events.id))
    .where(and(eq(events.id, eventId), eq(events.clanId, clanId), eq(events.practice, true), eq(practiceBoards.clanId, clanId)))
    .limit(1);
  return row ?? null;
}

/** The clan's one practice board that has not ended yet, or null. */
export async function activePracticeBoard(clanId: number): Promise<EventRow | null> {
  // clan-scope: this clan -- its own practice boards.
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.clanId, clanId), eq(events.practice, true), isNull(events.forceEndedAt)))
    .orderBy(desc(events.id));
  return rows.find((e) => practiceEndedAt(e) == null || practiceEndedAt(e)! > Date.now()) ?? null;
}

/** The clan's practice boards, newest first (the ended ones until the sweep deletes them). */
export async function practiceBoardsForClan(clanId: number): Promise<{ id: number; name: string; running: boolean; endedAt: number | null }[]> {
  // clan-scope: this clan -- its own practice boards.
  const rows = await db
    .select({ id: events.id, name: events.name, startDate: events.startDate, endDate: events.endDate, forceEndedAt: events.forceEndedAt })
    .from(events)
    .where(and(eq(events.clanId, clanId), eq(events.practice, true)))
    .orderBy(desc(events.id))
    .limit(10);
  return rows.map((r) => ({ id: r.id, name: r.name, running: practiceRunning(r), endedAt: practiceEndedAt(r) }));
}

/**
 * Is this person ON this practice board — one of their characters entered in it? That is what lets a
 * helper with no staff role view it while it runs (lib/eventAccess canSeeEvent).
 */
export async function personOnPracticeBoard(eventId: number, playerId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: eventParticipants.id })
    .from(eventParticipants)
    .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
    .where(and(eq(eventParticipants.eventId, eventId), eq(accounts.playerId, playerId)))
    .limit(1);
  return !!row;
}

// ── Create ───────────────────────────────────────────────────────────────────────────────────

/** What a copied tile leaves behind: its identity, place, links and live run state. */
const NOT_COPIED = ['id', 'eventId', 'position', 'updatedAt', 'revealedAt', 'closedAt', 'revealStats', 'parentTileId', 'raceNext'] as const;

function copyOf(t: TileRow, eventId: number, position: number, shiftMs: number | null): typeof tiles.$inferInsert {
  const row: Partial<TileRow> = { ...t };
  for (const k of NOT_COPIED) delete row[k];
  // A planned reveal keeps its place on the clock relative to the start: "an hour in" stays an hour in.
  const revealAt = t.revealAt && shiftMs != null ? new Date(Date.parse(t.revealAt) + shiftMs).toISOString() : null;
  return { ...(row as typeof tiles.$inferInsert), eventId, position, revealAt };
}

/**
 * Copy these board tiles of `sourceEventId` (with their combo parts and race easier options) onto
 * `eventId`, from `startPosition` on. Race links between copied tiles are kept. Returns how many
 * board tiles landed.
 */
async function copyTiles(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  source: EventRow,
  tileIds: number[],
  eventId: number,
  startPosition: number,
  startMs: number,
): Promise<number> {
  const all = await tx.select().from(tiles).where(eq(tiles.eventId, source.id)).orderBy(asc(tiles.position), asc(tiles.id));
  const wanted = new Set(tileIds);
  const board = all.filter((t) => t.parentTileId == null && wanted.has(t.id));
  if (board.length !== wanted.size) throw new PracticeError('Some of those tiles are not on that board.');
  const sourceStart = parseStamp(source.startDate);
  const shift = sourceStart != null ? startMs - sourceStart : null;
  const inserted = board.length
    ? await tx.insert(tiles).values(board.map((t, i) => copyOf(t, eventId, startPosition + i, shift))).returning({ id: tiles.id })
    : [];
  const newIdOf = new Map(board.map((t, i) => [t.id, inserted[i].id]));
  for (const t of board) {
    const links = Array.isArray(t.raceNext) ? t.raceNext.map((id) => newIdOf.get(id)).filter((id): id is number => id != null) : null;
    if (links && links.length) await tx.update(tiles).set({ raceNext: links }).where(eq(tiles.id, newIdOf.get(t.id)!));
  }
  // Children (combo parts, race easier options) follow their parent.
  const children = all.filter((t) => t.parentTileId != null && newIdOf.has(t.parentTileId));
  if (children.length) {
    await tx.insert(tiles).values(children.map((c) => ({ ...copyOf(c, eventId, c.position, shift), parentTileId: newIdOf.get(c.parentTileId!)! })));
  }
  return board.length;
}

/** The seats asked for, checked against THIS clan: live member or guest seats only. */
async function clanSeats(clanId: number, seatIds: number[]) {
  if (seatIds.length === 0) return [];
  const rows = await db
    .select({ id: clanMemberships.id, accountId: clanMemberships.accountId, rsn: accounts.rsn })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(
      and(
        eq(clanMemberships.clanId, clanId),
        inArray(clanMemberships.id, seatIds),
        isNull(clanMemberships.leftAt),
        ne(clanMemberships.kind, 'event'),
      ),
    );
  if (rows.length !== seatIds.length) throw new PracticeError('Everyone on a practice board has to be in this clan.');
  // Keep the order the admin added people in (the creator first).
  return seatIds.map((id) => rows.find((r) => r.id === id)!);
}

/** A placeholder the pick flow fills through the tile import (it fills blank "Tile N" tiles first). */
function placeholder(eventId: number, position: number): typeof tiles.$inferInsert {
  return { eventId, position, label: `Tile ${position + 1}`, tileType: 'standard' };
}

/**
 * Start a practice board now. One per clan at a time. Copy mode copies the chosen tiles; pick mode
 * makes `count` blank tiles the setup screen then fills from the library (the ordinary tile import —
 * the creator gets an editor grant on this board for it). Returns the new event id.
 */
export async function createPracticeBoard(actorUserId: number, clanId: number, input: PracticeInput): Promise<number> {
  const seats = await clanSeats(clanId, input.seats);
  let source: EventRow | null = null;
  if (input.tiles.mode === 'copy') {
    // clan-scope: this clan -- the board to copy must be this clan's own, and a real one.
    const [row] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, input.tiles.eventId), eq(events.clanId, clanId), eq(events.practice, false)))
      .limit(1);
    if (!row) throw new PracticeError('That board is not one of this clan’s.', 404);
    source = row;
  }

  const now = Date.now();
  // A minute in the past, so the plugin's "has it started" never races the first poll.
  const startMs = now - 60_000;
  const endMs = now + input.hours * 3_600_000;
  const pick = input.tiles.mode === 'pick' ? input.tiles.count : 0;

  return db.transaction(async (tx) => {
    // One live practice board per clan: serialise creates for this clan, then look.
    await tx.execute(sql`select pg_advisory_xact_lock(${7_710_282}, ${clanId})`);
    const live = await tx
      .select({ id: events.id, endDate: events.endDate, forceEndedAt: events.forceEndedAt })
      .from(events)
      .where(and(eq(events.clanId, clanId), eq(events.practice, true), isNull(events.forceEndedAt)));
    if (live.some((e) => (practiceEndedAt(e) ?? Infinity) > now)) {
      throw new PracticeError('This clan already has a practice board running. End it first.', 409);
    }

    const rules = source?.rules ?? null;
    const [event] = await tx
      .insert(events)
      .values({
        clanId,
        practice: true,
        name: (source ? `Practice · ${source.name}` : 'Practice board').slice(0, 80),
        // Closed whatever the clan's setting: lib/eventAccess lets only the people on it, and the
        // admins, see a practice board.
        visibility: 'invited',
        entry: 'approval',
        advertised: false,
        signupsEnabled: false,
        format: source?.format ?? 'bingo',
        scoringMode: source?.scoringMode ?? 'points',
        boardSize: source ? source.boardSize : pick,
        rules,
        // The copied board's in-game chat feed comes along — it is one of the things being tested.
        chatFeed: source?.chatFeed ?? false,
        // Teams are placed here, by hand; nothing joins on its own. Solo reads as a real solo board.
        teamPlacement: input.sides === 1 ? 'solo' : 'draft',
        draftStatus: 'complete',
        startDate: new Date(startMs).toISOString(),
        endDate: new Date(endMs).toISOString(),
        // The board itself is open from the first poll; a hidden or mission tile keeps its own gate.
        tilesRevealed: 1,
        // Nothing to announce, and nothing that may announce it: every lifecycle post latched as done
        // (start, start hold, halfway, end — which also writes no player facts, payouts or recap).
        startNotified: 1,
        startHoldNotified: 1,
        halfwayNotified: true,
        endNotified: 1,
        draftNotified: 1,
        draftStartNotified: 1,
        // Never the copied board's Discord choices: its channels are the clan's real ones.
        discordPrefs: {},
      })
      .returning({ id: events.id });

    await tx.insert(practiceBoards).values({
      eventId: event.id,
      clanId,
      createdByUserId: actorUserId,
      sourceEventId: source?.id ?? null,
      webhookUrl: input.webhookUrl,
    });

    if (source && input.tiles.mode === 'copy') {
      await copyTiles(tx, source, input.tiles.tileIds, event.id, 0, startMs);
    } else if (pick > 0) {
      await tx.insert(tiles).values(Array.from({ length: pick }, (_, i) => placeholder(event.id, i)));
      // The import route is the one place a library row becomes a tile; it asks for an editor.
      await tx.insert(eventEditors).values({ eventId: event.id, userId: actorUserId, role: 'editor', grantedByUserId: actorUserId }).onConflictDoNothing();
    }

    for (const plan of practiceTeams(seats, input.sides)) {
      const [team] = await tx.insert(teams).values({ eventId: event.id, name: plan.name, color: plan.color }).returning({ id: teams.id });
      for (const seatId of plan.seats) {
        const seat = seats.find((s) => s.id === seatId)!;
        await tx.insert(eventParticipants).values({ eventId: event.id, clanMemberId: seat.id, accountId: seat.accountId, name: seat.rsn, teamId: team.id });
      }
    }
    return event.id;
  }).then((id) => {
    notifyBoardPeople(id);
    return id;
  });
}

/** Let this admin author tiles on this practice board (the pick flow's import), once. */
export async function grantPracticeEditor(eventId: number, userId: number): Promise<void> {
  await db.insert(eventEditors).values({ eventId, userId, role: 'editor', grantedByUserId: userId }).onConflictDoNothing();
}

/** Copy more tiles from one of the clan's boards onto a running practice board (25 at most in all). */
export async function addPracticeTilesFromBoard(clanId: number, practice: EventRow, sourceEventId: number, tileIds: number[]): Promise<number> {
  // clan-scope: this clan -- a real board of the same clan.
  const [source] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, sourceEventId), eq(events.clanId, clanId), eq(events.practice, false)))
    .limit(1);
  if (!source) throw new PracticeError('That board is not one of this clan’s.', 404);
  const have = await db
    .select({ position: tiles.position })
    .from(tiles)
    .where(and(eq(tiles.eventId, practice.id), isNull(tiles.parentTileId)));
  if (have.length + tileIds.length > PRACTICE_MAX_TILES) throw new PracticeError(`A practice board holds up to ${PRACTICE_MAX_TILES} tiles.`);
  const next = have.reduce((m, t) => Math.max(m, t.position + 1), 0);
  const startMs = parseStamp(practice.startDate) ?? Date.now();
  const added = await db.transaction(async (tx) => {
    const n = await copyTiles(tx, source, tileIds, practice.id, next, startMs);
    await tx.update(events).set({ boardSize: practice.scoringMode === 'tiles' && practice.format === 'bingo' ? practice.boardSize : have.length + n }).where(eq(events.id, practice.id));
    return n;
  });
  notifyBoardPeople(practice.id);
  return added;
}

/** Make room for `count` more picked tiles: blank tiles the library import then fills. */
export async function addPracticePlaceholders(practice: EventRow, count: number): Promise<void> {
  const have = await db.select({ position: tiles.position }).from(tiles).where(and(eq(tiles.eventId, practice.id), isNull(tiles.parentTileId)));
  if (have.length + count > PRACTICE_MAX_TILES) throw new PracticeError(`A practice board holds up to ${PRACTICE_MAX_TILES} tiles.`);
  const next = have.reduce((m, t) => Math.max(m, t.position + 1), 0);
  await db.insert(tiles).values(Array.from({ length: count }, (_, i) => placeholder(practice.id, next + i)));
}

/** Drop blank "Tile N" tiles a pick flow left unfilled (an import that failed part-way). */
export async function dropPracticePlaceholders(eventId: number): Promise<void> {
  await db
    .delete(tiles)
    .where(and(eq(tiles.eventId, eventId), isNull(tiles.parentTileId), eq(tiles.tileType, 'standard'), isNull(tiles.trackedStat), sql`${tiles.label} ~ '^Tile [0-9]+$'`));
}

// ── Controls ─────────────────────────────────────────────────────────────────────────────────

async function practiceTile(eventId: number, tileId: number): Promise<TileRow> {
  const [tile] = await db.select().from(tiles).where(and(eq(tiles.id, tileId), eq(tiles.eventId, eventId))).limit(1);
  if (!tile) throw new PracticeError('That tile is not on this board.', 404);
  return tile;
}

async function teamIdsOf(eventId: number): Promise<number[]> {
  return (await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, eventId))).map((t) => t.id);
}

/**
 * Start a tile over for every team: its completion, submissions, claims and stat ledger go, and a
 * KC / XP tile counts again from NOW (its per-team start line is re-captured, the way a race tile
 * counts from when it opens — lib/revealStatsCapture), so real play already done does not finish it
 * again on the next push. Combo parts and easier options go with it.
 */
export async function resetPracticeTile(eventId: number, tileId: number): Promise<void> {
  const tile = await practiceTile(eventId, tileId);
  const children = await db.select().from(tiles).where(and(eq(tiles.eventId, eventId), eq(tiles.parentTileId, tile.id)));
  const ids = [tile.id, ...children.map((c) => c.id)];
  const teamIds = await teamIdsOf(eventId);
  if (teamIds.length === 0) return;
  await db.transaction(async (tx) => {
    await tx.delete(completions).where(and(inArray(completions.tileId, ids), inArray(completions.teamId, teamIds)));
    await tx.delete(submissions).where(and(inArray(submissions.tileId, ids), inArray(submissions.teamId, teamIds)));
    await tx.delete(statTileProgress).where(and(inArray(statTileProgress.tileId, ids), inArray(statTileProgress.teamId, teamIds)));
    await tx.delete(tileClaims).where(and(eq(tileClaims.eventId, eventId), inArray(tileClaims.tileId, ids)));
  });
  const statIds = [tile, ...children].filter((t) => t.trackedStat && t.statType).map((t) => t.id);
  for (const teamId of teamIds) {
    if (statIds.length === 0) break;
    await clearRaceOpenStats(eventId, teamId, statIds);
    await captureRaceOpenStats(eventId, teamId, statIds);
  }
  notifyBoardPeople(eventId);
}

/** Every tile started over (resetPracticeTile for each), the tiles and people kept. */
export async function resetPracticeProgress(eventId: number): Promise<void> {
  const board = await db.select({ id: tiles.id }).from(tiles).where(and(eq(tiles.eventId, eventId), isNull(tiles.parentTileId)));
  for (const t of board) await resetPracticeTile(eventId, t.id);
}

/**
 * "Lower target": the practice copy's number goes down (50 kills → 2), so a couple of real kills
 * finish it. Then the real engine decides, for every team: a count tile re-checks its submissions,
 * a KC / XP tile its gains. The goal is the tile's own column for its kind (lib/labTileProgress).
 */
export async function lowerPracticeTarget(eventId: number, tileId: number, target: number): Promise<{ store: ProgressStore; goal: number }> {
  const tile = await practiceTile(eventId, tileId);
  const store = progressStore(tile);
  const goal = progressGoal(tile, store);
  if (!store || goal == null) throw new PracticeError('This tile has no number to lower.');
  if (store === 'fastest') throw new PracticeError('A timed tile’s target is a time; edit the tile instead.');
  const next = Math.max(1, Math.min(Math.floor(target), goal));
  if (store === 'stat') await db.update(tiles).set({ statGoal: next }).where(eq(tiles.id, tile.id));
  else await db.update(tiles).set({ requiredAmount: next }).where(eq(tiles.id, tile.id));
  const updated = await practiceTile(eventId, tileId);
  for (const teamId of await teamIdsOf(eventId)) {
    try {
      if (store === 'stat') {
        if (!updated.autoTrackDisabled) await creditStatTilesForTeam({ eventId, teamId, statTiles: [updated] });
      } else {
        await syncDropTileCompletion(updated.id, teamId);
      }
    } catch (e) {
      log.warn('practice.lower-recheck-failed', { eventId, tileId, teamId }, e);
    }
  }
  notifyBoardPeople(eventId);
  return { store, goal: next };
}

/** End a practice board now. It stays readable (to its admins) until the sweep deletes it. */
export async function endPracticeBoard(eventId: number): Promise<void> {
  await db.update(events).set({ forceEndedAt: new Date().toISOString(), endNotified: 1 }).where(and(eq(events.id, eventId), eq(events.practice, true)));
  notifyBoardPeople(eventId);
}

/**
 * Delete a practice board outright: its stored proof images first (nothing else would ever find the
 * files), then the event, whose tiles, teams, entrants, credits and settings cascade with it. False
 * when the id is not a practice board, so no route or sweep can reach a real event through here.
 */
export async function deletePracticeBoard(eventId: number): Promise<boolean> {
  // clan-scope: global -- the practice flag on the row itself is the guard.
  const [row] = await db.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), eq(events.practice, true))).limit(1);
  if (!row) return false;
  await purgeEventMedia(row.id);
  await db.delete(events).where(and(eq(events.id, row.id), eq(events.practice, true)));
  return true;
}

/** Delete practice boards that ended more than PRACTICE_KEEP_DAYS ago. Rides the lifecycle tick. */
export async function sweepEndedPracticeBoards(now: Date = new Date()): Promise<number> {
  // clan-scope: global -- every clan's practice boards, and only those.
  const rows = await db
    .select({ id: events.id, endDate: events.endDate, forceEndedAt: events.forceEndedAt })
    .from(events)
    .where(and(eq(events.practice, true), or(sql`${events.forceEndedAt} is not null`, lt(events.endDate, now.toISOString()))))
    .limit(200);
  let deleted = 0;
  for (const row of rows) {
    // Bounded per tick: a first run over a backlog finishes over the next few minutes.
    if (deleted >= 25) break;
    if (!practiceDue(row, now.getTime())) continue;
    try {
      if (await deletePracticeBoard(row.id)) deleted++;
    } catch (err) {
      log.warn('practice.sweep-delete-failed', { eventId: row.id }, err);
    }
  }
  if (deleted) log.info('practice.sweep', { deleted });
  return deleted;
}

// ── The board page ───────────────────────────────────────────────────────────────────────────

export interface PracticeTileView {
  id: number;
  label: string;
  /** Hidden from the players right now (a mission not announced, a scheduled tile not yet out). */
  hidden: boolean;
  store: ProgressStore | null;
  goal: number | null;
  /** Can "Lower target" change it? */
  lowerable: boolean;
  teams: { teamId: number; progress: number | null; done: boolean; doneBy: string | null; doneAt: string | null }[];
}

export interface PracticeLogLine {
  at: string;
  who: string;
  text: string;
  /** credited = put on a tile; done = finished one; seen = recorded for the clan, no tile took it. */
  kind: 'credited' | 'done' | 'seen';
}

export interface PracticeView {
  id: number;
  name: string;
  sourceName: string | null;
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
  running: boolean;
  hook: string | null;
  teams: { id: number; name: string; color: string; players: string[]; done: number }[];
  tiles: PracticeTileView[];
  log: PracticeLogLine[];
  tileCount: number;
}

function isHiddenNow(t: TileRow, nowMs: number): boolean {
  const mission = t.mission === 1 || (t.mission as unknown) === true;
  if (mission && !t.revealedAt) return true;
  if (t.revealAt && !t.revealedAt && Date.parse(t.revealAt) > nowMs) return true;
  return false;
}

/** Everything /practice/<id> shows, read off the real tables. */
export async function practiceView(event: EventRow, board: typeof practiceBoards.$inferSelect): Promise<PracticeView> {
  const nowMs = Date.now();
  const [teamRows, players, tileRows] = await Promise.all([
    db.select().from(teams).where(eq(teams.eventId, event.id)).orderBy(asc(teams.id)),
    db.select().from(eventParticipants).where(eq(eventParticipants.eventId, event.id)),
    db.select().from(tiles).where(eq(tiles.eventId, event.id)).orderBy(asc(tiles.position), asc(tiles.id)),
  ]);
  const teamIds = teamRows.map((t) => t.id);
  const boardTiles = tileRows.filter((t) => t.parentTileId == null);
  const [doneRows, subRows] = teamIds.length
    ? await Promise.all([
        db.select().from(completions).where(inArray(completions.teamId, teamIds)),
        db.select().from(submissions).where(inArray(submissions.teamId, teamIds)).orderBy(desc(submissions.id)),
      ])
    : [[], []];
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  // Who finished a team's tile, as the event feed says it: the stored finisher (one member's count),
  // else whoever made the team's latest credit on it (a team total stores none). Newest rows first.
  const finisherOf = (c: { teamId: number; tileId: number; creditPlayerId: number | null }): string | null => {
    if (c.creditPlayerId != null) return nameOf.get(c.creditPlayerId) ?? null;
    const last = subRows.find((s) => s.teamId === c.teamId && s.tileId === c.tileId && (s.creditPlayerId ?? s.playerId) != null);
    return last ? nameOf.get((last.creditPlayerId ?? last.playerId)!) ?? null : null;
  };
  const live = await liveStatsForMembers(players.map((p) => p.clanMemberId));
  const modes = countedModes(parseEventRules(event.rules));

  const statProgress = (tile: TileRow, teamId: number): number => {
    const keys = statKeys(tile.trackedStat);
    const reveal = parseRevealStats(tile.revealStats);
    const gains = players
      .filter((p) => p.teamId === teamId)
      .map((p) => {
        const plug = (p.clanMemberId != null && live.get(p.clanMemberId)) || {};
        const g = p.frozenAt
          ? statGainWithModes(p.statsSnapshot, p.frozenStats, {}, keys, tile.statType!, null, modes)
          : statGainWithModes(p.statsSnapshot, p.cachedStats, plug, keys, tile.statType!, p.modeStats, modes);
        return gainSinceReveal(g, reveal, p.id);
      });
    const solo = tile.trackingMode === 'individual' || tile.statBasis === 'milestone';
    return solo ? Math.max(0, ...gains) : gains.reduce((a, b) => a + b, 0);
  };

  const tileViews: PracticeTileView[] = boardTiles.map((t) => {
    const store = progressStore(t);
    const goal = progressGoal(t, store);
    return {
      id: t.id,
      label: t.label,
      hidden: isHiddenNow(t, nowMs),
      store,
      goal,
      lowerable: store != null && store !== 'fastest' && goal != null && goal > 1,
      teams: teamRows.map((team) => {
        const done = doneRows.find((c) => c.teamId === team.id && c.tileId === t.id) ?? null;
        const subs = subRows.filter((s) => s.teamId === team.id && s.tileId === t.id);
        let progress: number | null = null;
        if (store === 'stat') progress = statProgress(t, team.id);
        else if (store === 'best') progress = subs.reduce((m, s) => Math.max(m, s.amount), 0);
        else if (store === 'fastest') progress = subs.reduce<number | null>((m, s) => (s.durationSeconds != null && (m == null || s.durationSeconds < m) ? s.durationSeconds : m), null);
        else if (store) progress = countProgress(subs, t.trackingMode, store === 'slots' ? 'slots' : t.countMode, null).current;
        return {
          teamId: team.id,
          progress,
          done: !!done,
          doneBy: done ? finisherOf(done) : null,
          doneAt: done?.completedAt ?? null,
        };
      }),
    };
  });

  // WHAT HAPPENED — from rows that already exist, nothing new recorded: the credits this board's
  // tiles took, the tiles it finished, and what the clan's feed recorded for these people since the
  // board started that no tile here took ("seen"). The last 15 minutes, newest first.
  const since = nowMs - 15 * 60_000;
  const labelOf = new Map(tileRows.map((t) => [t.id, t.parentTileId != null ? tileRows.find((p) => p.id === t.parentTileId)?.label ?? t.label : t.label]));
  const lines: (PracticeLogLine & { ms: number })[] = [];
  for (const s of subRows.slice(0, 60)) {
    const ms = parseStamp(s.createdAt) ?? 0;
    if (ms < since) continue;
    const who = nameOf.get(s.creditPlayerId ?? s.playerId ?? -1) ?? 'Someone';
    lines.push({ ms, at: new Date(ms).toISOString(), who, kind: 'credited', text: `${s.amount > 1 ? `${s.amount} toward` : 'credited to'} ${labelOf.get(s.tileId) ?? 'a tile'}${s.source ? ` (${s.source})` : ''}` });
  }
  for (const c of doneRows) {
    const ms = parseStamp(c.completedAt) ?? 0;
    if (ms < since) continue;
    const who = finisherOf(c) ?? teamRows.find((t) => t.id === c.teamId)?.name ?? 'A team';
    lines.push({ ms, at: new Date(ms).toISOString(), who, kind: 'done', text: `finished ${labelOf.get(c.tileId) ?? 'a tile'}${board.webhookUrl ? ' · post sent to the test hook' : ''}` });
  }
  const seatIds = players.map((p) => p.clanMemberId).filter((id): id is number => id != null);
  if (seatIds.length) {
    const startIso = new Date(Math.max(since, parseStamp(event.startDate) ?? since)).toISOString().replace('T', ' ').slice(0, 19);
    const seen = await db
      .select({ rsn: moments.rsn, kind: moments.kind, itemId: moments.itemId, itemName: moments.itemName, source: moments.source, noticedAt: moments.noticedAt })
      .from(moments)
      .where(and(inArray(moments.clanMemberId, seatIds), gte(moments.noticedAt, startIso)))
      .orderBy(desc(moments.id))
      .limit(30);
    const creditedItems = new Set(subRows.map((s) => s.itemId).filter((id): id is number => id != null));
    for (const m of seen) {
      if (m.itemId != null && creditedItems.has(m.itemId)) continue;
      const ms = parseStamp(m.noticedAt) ?? 0;
      const what = m.itemName ? `${m.itemName}${m.source ? ` from ${m.source}` : ''}` : `${m.kind}${m.source ? ` (${m.source})` : ''}`;
      lines.push({ ms, at: new Date(ms).toISOString(), who: m.rsn, kind: 'seen', text: `${what} → no tile here took it` });
    }
  }
  lines.sort((a, b) => b.ms - a.ms);

  const doneCount = (teamId: number) => doneRows.filter((c) => c.teamId === teamId && boardTiles.some((t) => t.id === c.tileId)).length;
  let sourceName: string | null = null;
  if (board.sourceEventId != null) {
    // clan-scope: this clan -- the source was checked to be this clan's when it was copied.
    const [src] = await db.select({ name: events.name }).from(events).where(and(eq(events.id, board.sourceEventId), eq(events.clanId, event.clanId))).limit(1);
    sourceName = src?.name ?? null;
  }
  return {
    id: event.id,
    name: event.name,
    sourceName,
    startDate: event.startDate,
    endDate: event.endDate,
    forceEndedAt: event.forceEndedAt,
    running: practiceRunning(event),
    hook: board.webhookUrl,
    teams: teamRows.map((t) => ({ id: t.id, name: t.name, color: t.color, players: players.filter((p) => p.teamId === t.id).map((p) => p.name), done: doneCount(t.id) })),
    tiles: tileViews,
    log: lines.slice(0, 20).map(({ ms: _ms, ...l }) => (void _ms, l)),
    tileCount: boardTiles.length,
  };
}

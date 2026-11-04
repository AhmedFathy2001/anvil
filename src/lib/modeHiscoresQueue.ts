import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { accounts, eventParticipants, events, hiscoresFetches, tiles } from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { eventHasStarted } from '@/lib/completionGate';
import { parseStamp } from '@/lib/dbTime';
import { parseEventRules } from '@/lib/eventRules';
import { toFetchResult } from '@/lib/forgeFetchResult';
import { parseHiscoresBody, type HiscoresSnapshot } from '@/lib/hiscores';
import { log } from '@/lib/logger';
import { MODE_FETCH_MODES, modeHiscoresTable, type ModeFetchMode } from '@/lib/modeHiscores';
import { applyModeRead, modeKeyStatType, modeReadDue, modeReadingIssues, parseModeStats } from '@/lib/modeStats';
import { creditStatTilesForTeam } from '@/lib/statTileCredit';
import { statKeys } from '@/lib/tileKinds';

// Reads of the game-mode world hiscores tables (lib/modeHiscores), queued through the same fetch
// queue as the main game and fetched by Anvil.Forge, so the KC / XP a plugin pushed from a mode
// world (event_participants.mode_stats, lib/modeStats) is checked against that mode's own table.
//
// BUDGET. Nothing here polls on a timer. A read is queued only for a board row that
//   - is on a live board (started, not ended) that counts the mode (rules.worldModes),
//   - has readings from that mode, for a mode that has a table, and
//   - whose readings MOVED since its last read (lib/modeStats modeReadDue): the first reading, a new
//     key, a rise (at most hourly; three-hourly for a save the table doesn't have yet), or the one
//     confirming read once a reading has sat above the table for MODE_STALE_MS.
// So an idle mode player costs nothing, and an active one about one read an hour. One read serves
// every board that character is on (the queue dedupes per name and table). Starting-line reads go
// in the competition lane (0), everything else in the filler lane (1); at most MAX_QUEUED_PER_DRAIN
// are offered per drain, and the queue's partial unique index makes re-offering a waiting one free.
//
// Only runs where Forge owns the sweep (STATS_SWEEP_OWNER=forge, statsSweep → drainForgeFetches).
// Under the in-app sweep mode readings simply stay unverified, which lib/modeStats already handles.

/** Mode reads offered to the queue per drain, at most. */
const MAX_QUEUED_PER_DRAIN = 50;
/** How long one "Forge has no such table" answer holds the queue to a single canary read. */
const FORGE_LACKS_MODES_MS = 60 * 60_000;

export interface ModeDrainStats {
  /** Mode-table results taken off the queue. */
  read: number;
  /** Board rows a read was folded into. */
  applied: number;
  /** Results an older Forge answered without a request (it has no such table yet). */
  unsupported: number;
  /** Reads newly queued this drain. */
  queued: number;
}

interface LiveRow {
  id: number;
  eventId: number;
  teamId: number;
  modeStats: string;
  rsn: string;
  counted: string[];
}

/** Board rows with mode readings on live boards that count a mode with a table. */
async function liveModeRows(nowMs: number): Promise<LiveRow[]> {
  // clan-scope: global -- a platform job over every clan's live boards; it writes only the row's own
  // mode readings and credits that row's own team.
  const rows = await db
    .select({
      id: eventParticipants.id,
      eventId: eventParticipants.eventId,
      teamId: eventParticipants.teamId,
      modeStats: eventParticipants.modeStats,
      name: eventParticipants.name,
      accountRsn: accounts.rsn,
      rules: events.rules,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .leftJoin(accounts, eq(eventParticipants.accountId, accounts.id))
    .where(
      and(
        isNotNull(eventParticipants.modeStats),
        isNotNull(eventParticipants.teamId),
        isNull(events.forceEndedAt),
        // Cheap pre-filter; parseEventRules below decides.
        sql`${events.rules} LIKE '%worldModes%'`,
      ),
    );
  const out: LiveRow[] = [];
  for (const r of rows) {
    if (!eventHasStarted(r, nowMs)) continue;
    const endMs = parseStamp(r.endDate);
    if (endMs != null && endMs <= nowMs) continue;
    const counted = parseEventRules(r.rules).worldModes.filter((m) => modeHiscoresTable(m) != null);
    if (counted.length === 0) continue;
    out.push({ id: r.id, eventId: r.eventId, teamId: r.teamId!, modeStats: r.modeStats!, rsn: r.accountRsn ?? r.name, counted });
  }
  return out;
}

/**
 * Apply every mode-table read Forge has finished, then queue the reads that are due. Called from the
 * Forge drain (lib/forgeFetchQueue) once per sweep.
 */
export async function drainModeFetches(now: Date = new Date()): Promise<ModeDrainStats> {
  const nowMs = now.getTime();

  // 1. Take the finished mode-table results. Marking consumed is the take, as for the main table.
  const results = await db
    .update(hiscoresFetches)
    .set({ consumedAt: now })
    .where(
      and(
        isNotNull(hiscoresFetches.fetchedAt),
        isNull(hiscoresFetches.consumedAt),
        inArray(hiscoresFetches.mode, [...MODE_FETCH_MODES]),
      ),
    )
    .returning({
      rsnKey: hiscoresFetches.rsnKey,
      mode: hiscoresFetches.mode,
      outcome: hiscoresFetches.outcome,
      body: hiscoresFetches.body,
      error: hiscoresFetches.error,
      fetchedAt: hiscoresFetches.fetchedAt,
    });

  const rows = await liveModeRows(nowMs);

  // Newest usable read per (name, table). A transient miss says nothing; an older Forge that has no
  // such table answers "unranked" without asking Jagex — that is not the save being absent.
  const reads = new Map<string, { at: string; snapshot: HiscoresSnapshot | null }>();
  let unsupported = 0;
  for (const r of results) {
    if (!r.fetchedAt) continue;
    if (r.outcome === 'unranked' && /unknown hiscores mode/i.test(r.error ?? '')) {
      unsupported++;
      continue;
    }
    const parsed = toFetchResult<HiscoresSnapshot>(r, parseHiscoresBody);
    if (parsed.kind === 'transient') continue;
    const k = `${r.rsnKey}|${r.mode}`;
    const at = r.fetchedAt.toISOString();
    const prev = reads.get(k);
    if (prev && prev.at >= at) continue;
    reads.set(k, { at, snapshot: parsed.kind === 'value' ? parsed.snapshot : null });
  }
  if (unsupported > 0) {
    log.warn('mode-hiscores.forge-unsupported', {
      count: unsupported,
      detail: 'Forge does not know these hiscores tables yet. Deploy Forge with the game-mode tables.',
    });
  }

  // 2. Fold each read into every live row of that character that counts a mode the table serves.
  let applied = 0;
  const touched = new Map<string, { eventId: number; teamId: number; keys: Set<string> }>();
  for (const row of rows) {
    const key = normalizeRsn(row.rsn);
    const fold = (from: string): string | null => {
      let json = from;
      let changed = false;
      for (const mode of row.counted) {
        const read = reads.get(`${key}|${modeHiscoresTable(mode)!}`);
        if (!read) continue;
        const next = applyModeRead(json, mode, read);
        if (next == null) continue;
        json = next;
        changed = true;
      }
      return changed ? json : null;
    };
    // Compare-and-set against the readings it was folded into, so a push that lands in between is
    // never overwritten: the read is folded again into the newer readings (pushes keep a held read).
    let from = row.modeStats;
    let json: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      json = fold(from);
      if (json == null) break;
      const written = await db
        .update(eventParticipants)
        .set({ modeStats: json })
        .where(and(eq(eventParticipants.id, row.id), eq(eventParticipants.modeStats, from)))
        .returning({ id: eventParticipants.id });
      if (written.length > 0) break;
      const [fresh] = await db
        .select({ modeStats: eventParticipants.modeStats })
        .from(eventParticipants)
        .where(eq(eventParticipants.id, row.id));
      json = null;
      if (!fresh?.modeStats) break;
      from = fresh.modeStats;
    }
    if (json == null) continue;
    row.modeStats = from;
    applied++;
    const after = parseModeStats(json);
    const keys = new Set<string>();
    for (const mode of row.counted) {
      for (const k of Object.keys(after[mode]?.cur ?? {})) keys.add(k);
    }
    // Staff see mismatches on the board's Stats tab (lib/statStandings); the log says when they began.
    for (const k of keys) {
      const type = modeKeyStatType(k);
      for (const issue of modeReadingIssues(json, row.counted, [k], type)) {
        if (issue.kind === 'capped') continue;
        const was = modeReadingIssues(row.modeStats, row.counted, [k], type).some((i) => i.kind === issue.kind && i.mode === issue.mode);
        if (!was) log.warn('mode-hiscores.mismatch', { participantId: row.id, eventId: row.eventId, ...issue });
      }
    }
    row.modeStats = json;
    const t = touched.get(`${row.eventId}|${row.teamId}`) ?? { eventId: row.eventId, teamId: row.teamId, keys: new Set() };
    for (const k of keys) t.keys.add(k);
    touched.set(`${row.eventId}|${row.teamId}`, t);
  }

  // A read can only raise what counts where the table is ahead of the pushes (mobile play, a client
  // that was off), so re-check the touched teams' stat tiles. Lowering never reopens a completion —
  // the same as the main game's overlay.
  for (const t of touched.values()) {
    try {
      const statTiles = (await db.select().from(tiles).where(eq(tiles.eventId, t.eventId))).filter(
        (tile) =>
          tile.trackedStat &&
          (tile.statType === 'boss' || tile.statType === 'kc' || tile.statType === 'skill') &&
          tile.statGoal &&
          !tile.autoTrackDisabled &&
          statKeys(tile.trackedStat).some((k) => t.keys.has(k) || (k === 'overall' && tile.statType === 'skill')),
      );
      if (statTiles.length > 0) await creditStatTilesForTeam({ eventId: t.eventId, teamId: t.teamId, statTiles });
    } catch (e) {
      log.warn('mode-hiscores.credit-failed', { eventId: t.eventId, teamId: t.teamId, error: (e as Error).message });
    }
  }

  // 3. Queue what is due, one request per (name, table) whichever boards want it.
  const due = new Map<string, { rsn: string; rsnKey: string; mode: ModeFetchMode; priority: number }>();
  for (const row of rows) {
    const rsnKey = normalizeRsn(row.rsn);
    if (!rsnKey) continue;
    const stats = parseModeStats(row.modeStats);
    for (const mode of row.counted) {
      const entry = stats[mode];
      if (!entry) continue;
      const want = modeReadDue(entry, nowMs);
      if (!want.due) continue;
      const table = modeHiscoresTable(mode)!;
      const k = `${rsnKey}|${table}`;
      const priority = want.urgent ? 0 : 1;
      const prev = due.get(k);
      if (!prev || priority < prev.priority) due.set(k, { rsn: row.rsn, rsnKey, mode: table, priority });
    }
  }
  // An older Forge answers these tables without a request, but still spends a rate token on each.
  // While it has done so in the last hour, offer a single canary read rather than a batch, so the
  // shared budget isn't spent on answers that say nothing.
  const [lacking] = await db
    .select({ id: hiscoresFetches.id })
    .from(hiscoresFetches)
    .where(
      and(
        inArray(hiscoresFetches.mode, [...MODE_FETCH_MODES]),
        eq(hiscoresFetches.outcome, 'unranked'),
        sql`${hiscoresFetches.fetchedAt} > ${new Date(nowMs - FORGE_LACKS_MODES_MS)}`,
        sql`${hiscoresFetches.error} ILIKE 'unknown hiscores mode%'`,
      ),
    )
    .limit(1);
  const cap = lacking ? 1 : MAX_QUEUED_PER_DRAIN;
  const offered = [...due.values()].sort((a, b) => a.priority - b.priority).slice(0, cap);
  let queued = 0;
  if (offered.length > 0) {
    const inserted = await db
      .insert(hiscoresFetches)
      .values(offered)
      .onConflictDoNothing()
      .returning({ id: hiscoresFetches.id });
    queued = inserted.length;
    // A starting-line read already waiting in the filler lane moves up.
    for (const o of offered.filter((x) => x.priority === 0)) {
      await db
        .update(hiscoresFetches)
        .set({ priority: 0 })
        .where(
          and(
            isNull(hiscoresFetches.fetchedAt),
            eq(hiscoresFetches.rsnKey, o.rsnKey),
            eq(hiscoresFetches.mode, o.mode),
            sql`${hiscoresFetches.priority} > 0`,
          ),
        );
    }
  }
  return { read: results.length, applied, unsupported, queued };
}

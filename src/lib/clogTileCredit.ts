// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Collection-log tiles (lib/clogTiles) against the database: the member's synced log, crediting an
// unlock the plugin pushed, and re-checking whole-page tiles when a log sync lands.
//
// Two ways an unlock reaches a tile, and both end as an ordinary submission row (item id set), so
// the board, the plugin config and completion all count it through lib/countProgress 'slots':
//
//   1. The plugin's own tile credit (trackedClog) — a screenshot of the unlock, via the submissions
//      route like any drop. Needs a plugin that knows trackedClog.
//   2. The live unlock push every plugin since 1.13.2 already sends to /api/plugin/clog (on by
//      default with "Sync collection log"). Credited here with no image, so released plugins count
//      clog tiles without an update. When both arrive, the submissions route folds the screenshot
//      into the row this made — one slot, one row, with proof.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

import { db } from '@/db';
import { completions, eventParticipants, events, eventStartProofs, memberClog, memberClogItems, submissions, tiles } from '@/db/schema';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import {
  clogTileSpec,
  decideClogSlotByName,
  evaluateClogPages,
  ownedAtStart,
  type ClogMemberLog,
  type ClogPagesProgress,
} from '@/lib/clogTiles';
import { eventHasStarted } from '@/lib/completionGate';
import { isEventOver } from '@/lib/eventLock';
import { isDraftInProgress } from '@/lib/eventReadiness';
import { isTileRevealed, parseEventRules } from '@/lib/eventRules';
import { startProofGate, NO_START_PROOF_FLAG } from '@/lib/startProof';
import { parseStamp } from '@/lib/dbTime';
import { countProgress, isPrimaryCredit } from '@/lib/countProgress';

type TileRow = typeof tiles.$inferSelect;
type EventRow = typeof events.$inferSelect;

/** One account's synced log: whether it has one, and every row with when we first saw it. */
export async function memberClogLog(accountId: number): Promise<{ synced: boolean; rows: { itemId: number; firstSeenAt: string | null }[] }> {
  const [header, rows] = await Promise.all([
    db.query.memberClog.findFirst({ where: eq(memberClog.accountId, accountId), columns: { accountId: true } }),
    db.select({ itemId: memberClogItems.itemId, firstSeenAt: memberClogItems.firstSeenAt })
      .from(memberClogItems)
      .where(eq(memberClogItems.accountId, accountId)),
  ]);
  return { synced: !!header, rows };
}

/** Item ids this tile already credited each member (primary rows with an item). */
async function creditedByMember(tileId: number, teamId: number): Promise<Map<number, Set<number>>> {
  const rows = await db
    .select({ playerId: submissions.playerId, creditPlayerId: submissions.creditPlayerId, itemId: submissions.itemId })
    .from(submissions)
    .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId), isNull(submissions.goal), isNotNull(submissions.itemId)));
  const out = new Map<number, Set<number>>();
  for (const r of rows) {
    const who = r.creditPlayerId ?? r.playerId;
    if (who == null || r.itemId == null) continue;
    const set = out.get(who) ?? new Set<number>();
    set.add(r.itemId);
    out.set(who, set);
  }
  return out;
}

/**
 * What a member's log held when the event started — the slots that can never be "new" for them.
 * Empty for a member with no account or no synced log: then the unlock line is the only guarantee.
 */
export async function clogOwnedBefore(accountId: number | null, event: Pick<EventRow, 'startDate'>, provenNew: ReadonlySet<number> = new Set()): Promise<Set<number>> {
  const startMs = parseStamp(event.startDate);
  if (accountId == null || startMs == null) return new Set();
  const { rows } = await memberClogLog(accountId);
  return ownedAtStart(rows, startMs, provenNew);
}

/** A whole-page tile's progress for one team, from each member's own log. */
export async function clogPagesProgress(tile: TileRow, teamId: number): Promise<ClogPagesProgress> {
  const spec = clogTileSpec(tile);
  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope.
  const event = await db.query.events.findFirst({ where: eq(events.id, tile.eventId), columns: { startDate: true } });
  const startMs = parseStamp(event?.startDate ?? null) ?? Date.now();
  const roster = await db
    .select({ id: eventParticipants.id, accountId: eventParticipants.accountId })
    .from(eventParticipants)
    .where(eq(eventParticipants.teamId, teamId));
  const credited = await creditedByMember(tile.id, teamId);
  const members: ClogMemberLog[] = [];
  for (const p of roster) {
    const mine = credited.get(p.id) ?? new Set<number>();
    const log = p.accountId != null ? await memberClogLog(p.accountId) : { synced: false, rows: [] };
    members.push({
      playerId: p.id,
      synced: log.synced,
      owned: new Set(log.rows.map((r) => r.itemId)),
      ownedAtStart: ownedAtStart(log.rows, startMs, mine),
      credited: mine,
    });
  }
  return evaluateClogPages(spec, members, tile.trackingMode);
}

/** The clog tiles an account is playing right now: live events, revealed, auto-tracked, on a team. */
async function liveClogTiles(accountId: number): Promise<{ event: EventRow; teamId: number; playerId: number; tile: TileRow }[]> {
  const seats = await db
    .select({ id: eventParticipants.id, eventId: eventParticipants.eventId, teamId: eventParticipants.teamId })
    .from(eventParticipants)
    .where(and(eq(eventParticipants.accountId, accountId), isNotNull(eventParticipants.teamId)));
  if (seats.length === 0) return [];
  const eventIds = [...new Set(seats.map((s) => s.eventId))];
  // clan-scope: global -- an account's own seats, across every clan it plays in: an unlock is the account's.
  const live = (await db.select().from(events).where(inArray(events.id, eventIds)))
    .filter((e) => eventHasStarted(e) && !isEventOver(e) && !!e.tilesRevealed && !isDraftInProgress(e.draftStatus));
  if (live.length === 0) return [];
  const clogTiles = await db
    .select()
    .from(tiles)
    .where(and(inArray(tiles.eventId, live.map((e) => e.id)), eq(tiles.tileType, 'clog'), eq(tiles.autoTrackDisabled, 0)));
  const out: { event: EventRow; teamId: number; playerId: number; tile: TileRow }[] = [];
  for (const tile of clogTiles) {
    const event = live.find((e) => e.id === tile.eventId)!;
    if (!isTileRevealed(parseEventRules(event.rules), tile) || tile.closedAt != null) continue;
    for (const seat of seats) {
      if (seat.eventId === event.id && seat.teamId != null) out.push({ event, teamId: seat.teamId, playerId: seat.id, tile });
    }
  }
  return out;
}

/**
 * Credit the clog tiles an account is on from unlock lines its plugin pushed (names as the game
 * printed them). Returns how many slots were credited. Never throws — the profile write that called
 * this has already happened, and a tile hiccup must not fail it.
 */
export async function creditClogUnlocks(accountId: number, names: string[]): Promise<number> {
  try {
    const targets = await liveClogTiles(accountId);
    if (targets.length === 0 || names.length === 0) return 0;
    const { syncDropTileCompletion } = await import('@/lib/submissions');
    const { queueSubmissionNotification, flushPendingNotifications } = await import('@/lib/notifications');
    const log = await memberClogLog(accountId);
    let credited = 0;
    for (const { event, teamId, playerId, tile } of targets) {
      const done = await db.query.completions.findFirst({
        where: and(eq(completions.tileId, tile.id), eq(completions.teamId, teamId)),
        columns: { id: true },
      });
      if (done) continue;
      const spec = clogTileSpec(tile);
      // STARTING SHOT (lib/startProof), as the submissions route applies it to any credit.
      const rules = parseEventRules(event.rules);
      let flaggedReason: string | null = null;
      if (rules.startProof && event.startProofDrawnAt) {
        const proof = await db.query.eventStartProofs.findFirst({
          where: and(eq(eventStartProofs.eventId, event.id), eq(eventStartProofs.playerId, playerId)),
        });
        const gate = startProofGate(rules.startProof, event, proof ?? null);
        if (gate === 'reject') continue;
        if (gate === 'flag') flaggedReason = NO_START_PROOF_FLAG;
      }
      const counted = (await creditedByMember(tile.id, teamId)).get(playerId) ?? new Set<number>();
      const startMs = parseStamp(event.startDate) ?? Date.now();
      const before = ownedAtStart(log.rows, startMs, counted);
      let landed = 0;
      for (const name of names) {
        const verdict = decideClogSlotByName(name, spec, before, counted);
        if (!verdict.ok) continue;
        await db.insert(submissions).values({
          tileId: tile.id,
          teamId,
          playerId,
          amount: 1,
          itemId: verdict.itemId,
          imageUrl: null,
          note: `[Auto] New collection log slot: ${name.slice(0, 120)}`,
          flaggedReason,
          source: 'plugin',
        });
        counted.add(verdict.itemId);
        landed++;
      }
      if (landed === 0) continue;
      credited += landed;
      const sync = await syncDropTileCompletion(tile.id, teamId, { notifyCompletion: false });
      const current = spec.mode === 'complete' ? null : await slotProgress(tile, teamId);
      await queueSubmissionNotification({
        eventId: event.id,
        tileId: tile.id,
        teamId,
        amount: landed,
        currentTotal: current,
        requiredAmount: spec.mode === 'complete' ? null : spec.required,
        imageUrl: null,
        note: `New collection log slot: ${names.join(', ').slice(0, 200)}`,
        creditPlayerName: null,
        completed: sync?.isComplete ?? false,
      });
    }
    if (credited > 0) flushPendingNotifications().catch(() => {});
    return credited;
  } catch (e) {
    console.error('[clog-tiles] crediting an unlock failed', e);
    return 0;
  }
}

/** A slots tile's progress for one team (lib/countProgress 'slots'). */
export async function slotProgress(tile: Pick<TileRow, 'id' | 'trackingMode'>, teamId: number): Promise<number> {
  const rows = await db
    .select({ playerId: submissions.playerId, creditPlayerId: submissions.creditPlayerId, amount: submissions.amount, itemId: submissions.itemId, goal: submissions.goal })
    .from(submissions)
    .where(and(eq(submissions.tileId, tile.id), eq(submissions.teamId, teamId)));
  return countProgress(rows.filter(isPrimaryCredit), tile.trackingMode, 'slots').current;
}

/**
 * A log sync changed what this account holds: re-check its whole-page tiles. Slot tiles need
 * nothing — a sync is no proof of WHEN a slot was unlocked, only the unlock line is.
 */
export async function recheckClogPageTiles(accountId: number): Promise<void> {
  try {
    const targets = (await liveClogTiles(accountId)).filter((t) => clogTileSpec(t.tile).mode === 'complete');
    if (targets.length === 0) return;
    const { syncDropTileCompletion } = await import('@/lib/submissions');
    const seen = new Set<string>();
    for (const { tile, teamId } of targets) {
      const key = `${tile.id}:${teamId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await syncDropTileCompletion(tile.id, teamId);
    }
  } catch (e) {
    console.error('[clog-tiles] page re-check failed', e);
  }
}

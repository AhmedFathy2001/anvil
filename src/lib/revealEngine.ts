import { db } from '@/db';
import { events, tiles, completions } from '@/db/schema';
import { and, eq, inArray, isNull, isNotNull } from 'drizzle-orm';
import { parseEventRules, hasRevealPolicy, type EventRules, type RevealOrder } from '@/lib/eventRules';
import { notifyTilesRevealed } from '@/lib/discord';
import { log } from '@/lib/logger';

// The reveal engine — flips tiles live on reveal-policy events (see lib/eventRules.ts).
// Runs from the every-minute lifecycle tick (flush-notifications cron; the stats cron backstops),
// so a scheduled reveal is at most ~a minute late. Also invoked directly by the completion paths
// on bounty events so the next tile appears immediately after a claim, not on the next tick.
//
// Concurrency: two ticks can overlap (per-minute cron + stats cron). Every flip is a conditional
// UPDATE … WHERE revealed_at IS NULL, and only ACTUALLY flipped rows are announced, so a tile can
// never double-post. An overlapping interval draw could in theory pick two different random tiles
// for the same slot; the target-count math on the next tick simply absorbs it (the extra tile
// counts toward the next batch), so the board never runs ahead by more than a race's worth.

type EventRow = typeof events.$inferSelect;
type TileRow = typeof tiles.$inferSelect;

/** Which hidden tiles a draw picks: board order, or a shuffle. */
function draw(pool: TileRow[], n: number, order: RevealOrder): TileRow[] {
  if (n >= pool.length) return [...pool];
  if (order === 'sequential') {
    return [...pool].sort((a, b) => a.position - b.position).slice(0, n);
  }
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

/** True while the event is live (started, not ended/force-ended) AND the host has armed the board. */
function engineActive(event: EventRow, now: string): boolean {
  if (!event.tilesRevealed) return false;
  if (!event.startDate || event.startDate > now) return false;
  if (event.forceEndedAt) return false;
  if (event.endDate && event.endDate < now) return false;
  return true;
}

/**
 * One engine pass over a single event. Reconciles bounty closes, computes what's due, flips it
 * (conditionally), and announces the batch. Safe to call from the cron tick AND inline from a
 * bounty completion — every step is idempotent.
 */
async function revealForEvent(event: EventRow, rules: EventRules, now: string): Promise<void> {
  const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, event.id));
  if (eventTiles.length === 0) return;

  // Bounty reconcile: a revealed-open tile that already has a completion is claimed — close it.
  // The completion paths close inline (handleBountyClaim); this catches admin manual completions
  // or any path that raced past the hook, so the rotation can never wedge on a "completed but
  // still open" tile.
  if (rules.revealPolicy === 'bounty') {
    const open = eventTiles.filter((t) => t.revealedAt != null && t.closedAt == null);
    if (open.length > 0) {
      const comps = await db
        .select({ tileId: completions.tileId, completedAt: completions.completedAt })
        .from(completions)
        .where(inArray(completions.tileId, open.map((t) => t.id)));
      const claimedAt = new Map<number, string>();
      for (const c of comps) {
        const prev = claimedAt.get(c.tileId);
        if (!prev || c.completedAt < prev) claimedAt.set(c.tileId, c.completedAt);
      }
      for (const t of open) {
        const at = claimedAt.get(t.id);
        if (!at) continue;
        await db
          .update(tiles)
          .set({ closedAt: at })
          .where(and(eq(tiles.id, t.id), isNull(tiles.closedAt)));
        t.closedAt = at; // keep the in-memory pass consistent
      }
    }
  }

  const hidden = eventTiles.filter((t) => t.revealedAt == null);
  if (hidden.length === 0) return;

  let toReveal: TileRow[] = [];
  if (rules.revealPolicy === 'scheduled') {
    // Only tiles the host actually scheduled flip automatically; unscheduled ones stay hidden
    // until they get a time (or the host reveals them by setting one in the past).
    toReveal = hidden.filter((t) => t.revealAt != null && t.revealAt <= now);
  } else if (rules.revealPolicy === 'interval' || rules.revealPolicy === 'rotating') {
    // Deterministic target count: one batch at start, another per elapsed interval. Computing
    // the target (rather than "reveal one per tick") makes a missed tick self-heal — after
    // downtime the board catches up to where the clock says it should be. Rotating draws the same
    // way; expired tiles stay counted as revealed, so the cumulative target keeps pulling new ones.
    const startMs = Date.parse(event.startDate!);
    if (Number.isFinite(startMs)) {
      const elapsedMs = Date.parse(now) - startMs;
      const dueBatches = Math.floor(elapsedMs / (rules.revealIntervalMinutes * 60_000)) + 1;
      const target = Math.min(eventTiles.length, dueBatches * rules.revealBatchSize);
      const need = target - (eventTiles.length - hidden.length);
      if (need > 0) toReveal = draw(hidden, need, rules.revealOrder);
    }
  } else if (rules.revealPolicy === 'bounty') {
    const anyOpen = eventTiles.some((t) => t.revealedAt != null && t.closedAt == null);
    if (!anyOpen) toReveal = draw(hidden, 1, rules.revealOrder);
  }

  // Conditional flip — only rows still hidden actually turn, and only those get announced.
  if (toReveal.length > 0) {
    const flipped = await db
      .update(tiles)
      .set({ revealedAt: now })
      .where(and(inArray(tiles.id, toReveal.map((t) => t.id)), isNull(tiles.revealedAt)))
      .returning({ id: tiles.id, label: tiles.label, points: tiles.points });
    if (flipped.length > 0) {
      log.info('reveal-engine.reveal', {
        eventId: event.id,
        policy: rules.revealPolicy,
        count: flipped.length,
        hiddenLeft: hidden.length - flipped.length,
      });
      notifyTilesRevealed({
        eventName: event.name,
        tiles: flipped.map((t) => ({ label: t.label, points: t.points })),
        pointsMode: event.scoringMode === 'points',
        hiddenRemaining: hidden.length - flipped.length,
        bounty: rules.revealPolicy === 'bounty',
      }).catch(() => {});
    }
  }

  // Rotating window: after any fresh draw, EXPIRE the oldest still-open tiles so at most
  // revealWindowSize stay live. Fresh reveals are newest (this tick's `now`), so they survive; the
  // oldest close via `closedAt` — the same close-out bounty uses, so the completion gate already
  // refuses an expired task. A no-op between draws / once the window is at size.
  if (rules.revealPolicy === 'rotating') {
    const openNow = await db
      .select({ id: tiles.id, revealedAt: tiles.revealedAt })
      .from(tiles)
      .where(and(eq(tiles.eventId, event.id), isNotNull(tiles.revealedAt), isNull(tiles.closedAt)));
    const excess = openNow.length - rules.revealWindowSize;
    if (excess > 0) {
      const oldest = openNow
        .sort((a, b) => String(a.revealedAt).localeCompare(String(b.revealedAt)))
        .slice(0, excess);
      await db
        .update(tiles)
        .set({ closedAt: now })
        .where(and(inArray(tiles.id, oldest.map((t) => t.id)), isNull(tiles.closedAt)));
      log.info('reveal-engine.rotate-expire', {
        eventId: event.id,
        expired: oldest.length,
        windowSize: rules.revealWindowSize,
      });
    }
  }
}

/** Cron pass: run the engine over every live reveal-policy event. */
export async function processTileReveals(): Promise<void> {
  const now = new Date().toISOString();
  const allEvents = await db.select().from(events);
  for (const event of allEvents) {
    const rules = parseEventRules(event.rules);
    if (!hasRevealPolicy(rules)) continue;
    if (!engineActive(event, now)) continue;
    try {
      await revealForEvent(event, rules, now);
    } catch (err) {
      log.warn('reveal-engine.fail', { eventId: event.id, err: String(err) });
    }
  }
}

/**
 * Bounty accelerator, called fire-and-forget from every completion path after a completion row
 * lands on a bounty event: closes the claimed tile at the completion moment and immediately draws
 * the next one. The cron pass would do both within a minute anyway — this just makes the rotation
 * feel instant in game.
 */
export async function handleBountyClaim(eventId: number, tileId: number): Promise<void> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return;
  const rules = parseEventRules(event.rules);
  if (rules.revealPolicy !== 'bounty') return;
  const now = new Date().toISOString();
  await db
    .update(tiles)
    .set({ closedAt: now })
    .where(and(eq(tiles.id, tileId), isNull(tiles.closedAt)));
  if (!engineActive(event, now)) return;
  await revealForEvent(event, rules, now);
}

/**
 * Claim pull-back: when a completion is REMOVED on a bounty event (admin reverting a false
 * credit, or an auto-credit un-completing after its submissions were deleted), reopen the tile —
 * but only if no other team's completion still claims it. The next bounty the claim triggered
 * stays live; the board briefly runs two open tiles rather than silently losing one, and the
 * cron reconcile re-closes this tile the moment any completion lands on it again.
 */
export async function reopenBountyTileIfUnclaimed(eventId: number, tileId: number): Promise<void> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return;
  const rules = parseEventRules(event.rules);
  if (rules.revealPolicy !== 'bounty') return;
  const remaining = await db
    .select({ id: completions.id })
    .from(completions)
    .where(eq(completions.tileId, tileId))
    .limit(1);
  if (remaining.length > 0) return; // someone else's completion still claims it
  const reopened = await db
    .update(tiles)
    .set({ closedAt: null })
    .where(and(eq(tiles.id, tileId), isNotNull(tiles.closedAt)))
    .returning({ id: tiles.id });
  if (reopened.length > 0) {
    log.info('reveal-engine.bounty-reopen', { eventId, tileId });
  }
}

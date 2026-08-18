import { db } from '@/db';
import { events, tiles, completions, players, submissions } from '@/db/schema';
import { and, eq, inArray, isNull, isNotNull } from 'drizzle-orm';
import {
  parseEventRules,
  hasRevealPolicy,
  hasMissions,
  nextRevealAt,
  parseTileMissionRules,
  type EventRules,
  type RevealOrder,
} from '@/lib/eventRules';
import { notifyTilesRevealed, notifyBountyClaim } from '@/lib/discord';
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
      .returning({ id: tiles.id, label: tiles.label, points: tiles.points, icon: tiles.icon });
    if (flipped.length > 0) {
      log.info('reveal-engine.reveal', {
        eventId: event.id,
        policy: rules.revealPolicy,
        count: flipped.length,
        hiddenLeft: hidden.length - flipped.length,
      });
      // Recompute against the post-flip state so the countdown points at the NEXT batch rather than
      // the one that just landed.
      const after = eventTiles.map((t) =>
        flipped.some((f) => f.id === t.id) ? { ...t, revealedAt: now } : t,
      );
      notifyTilesRevealed({
          clanId: event.clanId,
        eventName: event.name,
        tiles: flipped.map((t) => ({ label: t.label, points: t.points, icon: t.icon })),
        pointsMode: event.scoringMode === 'points',
        hiddenRemaining: hidden.length - flipped.length,
        bounty: rules.revealPolicy === 'bounty',
        eventId: event.id,
        nextRevealAt: nextRevealAt(event, rules, after),
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

// ---- Missions — a parallel announce track over the mission-flagged tile subset ------------------
// Independent of the board's revealPolicy: a classic bingo can drop missions while its normal tiles
// stay visible. Announcing a mission stamps `revealedAt` (its decay anchor); each mission carries its
// own scoring (tiles.rules) and can auto-expire. Reuses the same draw()/flip/notify primitives.

/**
 * One mission pass over a single event: announce due missions (interval / scheduled), then close
 * expired (past their per-mission window) and claimed (lockout) missions. Manual mode announces
 * nothing here — the admin drives it via {@link announceNextMission}. Idempotent.
 */
async function announceMissionsForEvent(event: EventRow, rules: EventRules, now: string): Promise<void> {
  const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, event.id));
  const missionTiles = eventTiles.filter((t) => t.mission);
  if (missionTiles.length === 0) return;

  const cfg = rules.mission;
  const announceMode = cfg?.announceMode ?? 'manual';
  const order: RevealOrder = cfg?.order ?? 'random';
  const intervalMinutes = cfg?.intervalMinutes ?? 60;

  const hidden = missionTiles.filter((t) => t.revealedAt == null);

  let toReveal: TileRow[] = [];
  if (announceMode === 'scheduled') {
    toReveal = hidden.filter((t) => t.revealAt != null && t.revealAt <= now);
  } else if (announceMode === 'interval' && hidden.length > 0) {
    // One mission per interval, catch-up target from event start (self-heals a missed tick).
    const startMs = Date.parse(event.startDate!);
    if (Number.isFinite(startMs)) {
      const dueBatches = Math.floor((Date.parse(now) - startMs) / (intervalMinutes * 60_000)) + 1;
      const target = Math.min(missionTiles.length, dueBatches);
      const need = target - (missionTiles.length - hidden.length);
      if (need > 0) toReveal = draw(hidden, need, order);
    }
  }
  await flipAndAnnounceMissions(event, toReveal, hidden.length);
  await closeExpiredAndClaimedMissions(event, missionTiles, now);
}

/** Conditionally flip the drawn missions live and announce the batch to Discord (mission wording). */
async function flipAndAnnounceMissions(event: EventRow, toReveal: TileRow[], hiddenCount: number): Promise<number> {
  if (toReveal.length === 0) return 0;
  const now = new Date().toISOString();
  const flipped = await db
    .update(tiles)
    .set({ revealedAt: now })
    .where(and(inArray(tiles.id, toReveal.map((t) => t.id)), isNull(tiles.revealedAt)))
    .returning({ id: tiles.id, label: tiles.label, points: tiles.points, icon: tiles.icon });
  if (flipped.length > 0) {
    log.info('reveal-engine.mission-announce', { eventId: event.id, count: flipped.length });
    notifyTilesRevealed({
          clanId: event.clanId,
      eventName: event.name,
      tiles: flipped.map((t) => ({ label: t.label, points: t.points, icon: t.icon })),
      pointsMode: event.scoringMode === 'points',
      hiddenRemaining: Math.max(0, hiddenCount - flipped.length),
      mission: true,
      eventId: event.id,
    }).catch(() => {});
  }
  return flipped.length;
}

/**
 * Close announced-open missions that are done: a lockout mission with a completion is CLAIMED (close at
 * the claim time + announce the finisher), and any mission past its `expiryHours` window is EXPIRED.
 * Mirrors the bounty reconcile + rotating-window trim, scoped to missions, with no next-tile draw.
 */
async function closeExpiredAndClaimedMissions(event: EventRow, missionTiles: TileRow[], now: string): Promise<void> {
  const open = missionTiles.filter((t) => t.revealedAt != null && t.closedAt == null);
  if (open.length === 0) return;

  const comps = await db
    .select({ tileId: completions.tileId, completedAt: completions.completedAt })
    .from(completions)
    .where(inArray(completions.tileId, open.map((t) => t.id)));
  const claimedAt = new Map<number, string>();
  for (const c of comps) {
    const prev = claimedAt.get(c.tileId);
    if (!prev || c.completedAt < prev) claimedAt.set(c.tileId, c.completedAt);
  }

  const nowMs = Date.parse(now);
  for (const t of open) {
    const m = parseTileMissionRules(t.rules);
    let closeAt: string | null = null;
    let claimed = false;
    if (m.lockout && claimedAt.has(t.id)) {
      closeAt = claimedAt.get(t.id)!; // lockout claim → close at the claim moment
      claimed = true;
    } else if (m.expiryHours != null && t.revealedAt) {
      const revealedMs = Date.parse(t.revealedAt);
      if (Number.isFinite(revealedMs) && nowMs - revealedMs >= m.expiryHours * 3_600_000) closeAt = now;
    }
    if (!closeAt) continue;
    const done = await db
      .update(tiles)
      .set({ closedAt: closeAt })
      .where(and(eq(tiles.id, t.id), isNull(tiles.closedAt)))
      .returning({ id: tiles.id });
    if (done.length > 0 && claimed) {
      void announceBountyClaim(event.clanId, event.id, event.name, { id: t.id, label: t.label, points: t.points }, t.id);
    }
  }
}

/**
 * Manual "Announce next mission" — draw ONE hidden mission (by the configured order) and flip it live.
 * Returns how many were announced (0 when the pool is empty). Admin-triggered from the event route.
 */
export async function announceNextMission(eventId: number): Promise<{ announced: number }> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { announced: 0 };
  const rules = parseEventRules(event.rules);
  const now = new Date().toISOString();
  if (!engineActive(event, now)) return { announced: 0 };
  const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, eventId));
  const hidden = eventTiles.filter((t) => t.mission && t.revealedAt == null);
  if (hidden.length === 0) return { announced: 0 };
  const order: RevealOrder = rules.mission?.order ?? 'random';
  const count = await flipAndAnnounceMissions(event, draw(hidden, 1, order), hidden.length);
  return { announced: count };
}

/** Cron pass: run the board reveal engine and the mission announce track over every live event. */
export async function processTileReveals(): Promise<void> {
  const now = new Date().toISOString();
  const allEvents = await db.select().from(events);
  for (const event of allEvents) {
    const rules = parseEventRules(event.rules);
    const revealMode = hasRevealPolicy(rules);
    const missions = hasMissions(rules);
    if (!revealMode && !missions) continue;
    if (!engineActive(event, now)) continue;
    try {
      if (revealMode) await revealForEvent(event, rules, now);
      if (missions) await announceMissionsForEvent(event, rules, now);
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
  // Only the call that ACTUALLY closes the tile announces it, so a claim posts to Discord exactly once
  // even though every completion path calls this fire-and-forget.
  const closed = await db
    .update(tiles)
    .set({ closedAt: now })
    .where(and(eq(tiles.id, tileId), isNull(tiles.closedAt)))
    .returning({ id: tiles.id, label: tiles.label, points: tiles.points });
  if (closed.length > 0) {
    void announceBountyClaim(event.clanId, event.id, event.name, closed[0], tileId);
  }
  if (!engineActive(event, now)) return;
  await revealForEvent(event, rules, now);
}

// Resolve who claimed a bounty tile and post it to the clan channel. Finisher = the crediting player
// of the first (claiming) completion — stat tiles carry creditPlayerId, submission-backed tiles
// resolve it from the latest submission on the tile. Fire-and-forget; failures never block rotation.
async function announceBountyClaim(
  clanId: number,
  eventId: number,
  eventName: string,
  tile: { id: number; label: string; points: number | null },
  tileId: number,
): Promise<void> {
  try {
    const claim = await db
      .select({ teamId: completions.teamId, creditPlayerId: completions.creditPlayerId, awardedPoints: completions.awardedPoints })
      .from(completions)
      .where(eq(completions.tileId, tileId))
      .orderBy(completions.completedAt)
      .limit(1);
    if (claim.length === 0) return;
    const { teamId, creditPlayerId, awardedPoints } = claim[0];

    let rsn: string | null = null;
    if (creditPlayerId != null) {
      const p = await db.select({ name: players.name }).from(players).where(eq(players.id, creditPlayerId)).limit(1);
      rsn = p[0]?.name ?? null;
    }
    if (!rsn) {
      const subs = await db
        .select({ name: players.name })
        .from(submissions)
        .leftJoin(players, eq(submissions.creditPlayerId, players.id))
        .where(and(eq(submissions.teamId, teamId), eq(submissions.tileId, tileId)))
        .orderBy(submissions.createdAt); // ascending → last write is the finishing hand
      rsn = subs.length > 0 ? subs[subs.length - 1].name ?? null : null;
    }

    await notifyBountyClaim({
      clanId,
      eventName,
      tileLabel: tile.label,
      points: awardedPoints ?? tile.points,
      rsn: rsn ?? 'Someone',
      eventId,
    });
  } catch (err) {
    log.info('reveal-engine.bounty-claim-notify-failed', { tileId, err: String(err) });
  }
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

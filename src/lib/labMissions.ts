// Mission controls on a lab board (/staff/lab/<id>): add a mission tile or mark any tile as one, set
// its placement rules, and drop or expire it on demand — so a mission can be watched through its
// whole life in minutes instead of waiting on a schedule.
//
// Nothing here decides how a mission behaves. The rules are lib/eventRules MissionRules, stored the
// way the tile editor stores them (serializeTileMissionRules); the drop and the close are the reveal
// engine's own (lib/revealEngine announceMissionTile / closeMissionTileNow / announceNextMission),
// and scoring is the completion gate's, as on any board. Every write is pinned to the lab event the
// route already resolved.

import { and, eq, isNull, max } from 'drizzle-orm';

import { db } from '@/db';
import { events, tiles } from '@/db/schema';
import {
  mergeEventRulesPatch,
  parseEventRules,
  serializeTileMissionRules,
  validateEventRules,
  type MissionAnnounceMode,
  type MissionRules,
} from '@/lib/eventRules';
import { labMissionSpec } from '@/lib/labPlan';
import { captureRevealStats } from '@/lib/revealStatsCapture';
import { announceMissionTile, announceNextMission, closeMissionTileNow } from '@/lib/revealEngine';

type EventRow = typeof events.$inferSelect;

export class LabMissionError extends Error {}

async function boardTile(eventId: number, tileId: number) {
  const [tile] = await db.select().from(tiles).where(and(eq(tiles.id, tileId), eq(tiles.eventId, eventId))).limit(1);
  if (!tile) throw new LabMissionError('That tile is not on this board.');
  if (tile.parentTileId != null) throw new LabMissionError('A combo part cannot be a mission — use the combo itself.');
  return tile;
}

/**
 * Give the board a mission announce policy if it has none (manual: the lab's buttons drop them), so
 * every surface that reads `rules.mission` treats it as a mission board. Leaves an existing policy alone.
 */
async function ensureMissionPolicy(event: EventRow): Promise<void> {
  if (parseEventRules(event.rules).mission) return;
  await setMissionPolicy(event, { announceMode: 'manual' });
}

/** Set the board's mission announce policy (manual, or every N minutes) and draw order. */
export async function setMissionPolicy(
  event: EventRow,
  input: { announceMode: MissionAnnounceMode; intervalMinutes?: number; order?: 'random' | 'sequential' },
): Promise<void> {
  if (input.announceMode !== 'manual' && input.announceMode !== 'interval') {
    throw new LabMissionError('The lab drops missions by hand or on an interval.');
  }
  // clan-scope: this clan -- the lab event the route resolved (lib/lab labEvent), re-read for its latest rules.
  const [fresh] = await db.select({ rules: events.rules }).from(events).where(eq(events.id, event.id)).limit(1);
  const current = parseEventRules(fresh?.rules ?? null).mission;
  const merged = mergeEventRulesPatch(fresh?.rules ?? null, {
    mission: {
      ...(current ?? {}),
      announceMode: input.announceMode,
      order: input.order ?? current?.order ?? 'random',
      intervalMinutes: input.intervalMinutes ?? current?.intervalMinutes ?? 15,
    },
  });
  const checked = validateEventRules(merged);
  if ('error' in checked) throw new LabMissionError(checked.error);
  await db.update(events).set({ rules: checked.rules }).where(eq(events.id, event.id));
}

/** A new hidden mission tile at the end of the board: a real, creditable tile from the lab plan not already on it. Returns its id. */
export async function addLabMission(event: EventRow, label?: string): Promise<number> {
  await ensureMissionPolicy(event);
  const [{ last }] = await db.select({ last: max(tiles.position) }).from(tiles).where(eq(tiles.eventId, event.id));
  const position = (last ?? -1) + 1;
  const existing = await db.select({ label: tiles.label }).from(tiles).where(eq(tiles.eventId, event.id));
  const plan = labMissionSpec(existing.map((t) => t.label));
  const [tile] = await db
    .insert(tiles)
    .values({
      eventId: event.id,
      position,
      ...plan,
      label: (label?.trim() || plan.label).slice(0, 80),
      mission: 1,
      points: event.scoringMode === 'points' ? 25 : 1,
    })
    .returning({ id: tiles.id });
  return tile.id;
}

/** Make a tile a mission (hidden until announced) or a plain tile again (visible, rules cleared). */
export async function markLabMission(event: EventRow, tileId: number, on: boolean): Promise<void> {
  await boardTile(event.id, tileId);
  if (on) await ensureMissionPolicy(event);
  await db
    .update(tiles)
    .set(
      on
        ? { mission: 1, revealedAt: null, closedAt: null, revealStats: null, revealAt: null }
        : { mission: 0, rules: null, revealedAt: null, closedAt: null, revealStats: null },
    )
    .where(and(eq(tiles.id, tileId), eq(tiles.eventId, event.id)));
}

/** A mission's own scoring and placement ladder (lib/eventRules MissionRules), stored canonically. */
export async function setLabMissionRules(event: EventRow, tileId: number, rules: Partial<MissionRules>): Promise<MissionRules> {
  const tile = await boardTile(event.id, tileId);
  if (!tile.mission) throw new LabMissionError('Mark the tile as a mission first.');
  const stored = serializeTileMissionRules(rules);
  await db.update(tiles).set({ rules: stored }).where(eq(tiles.id, tileId));
  return JSON.parse(stored ?? 'null') ?? rules;
}

/** Drop a named mission now, or the next one by the board's order when no tile is named. */
export async function announceLabMission(event: EventRow, tileId?: number): Promise<number> {
  if (tileId != null) {
    const tile = await boardTile(event.id, tileId);
    if (!tile.mission) throw new LabMissionError('That tile is not a mission.');
    if (tile.revealedAt) throw new LabMissionError('That mission is already out.');
  }
  const { announced } = tileId != null ? await announceMissionTile(event.id, tileId) : await announceNextMission(event.id);
  if (announced === 0) throw new LabMissionError(tileId != null ? 'The session is not running.' : 'No hidden missions left to announce.');
  return announced;
}

/** Expire an announced mission now: prizes owed are settled, then it closes to everyone. */
export async function expireLabMission(event: EventRow, tileId: number): Promise<void> {
  const tile = await boardTile(event.id, tileId);
  if (!tile.mission || !tile.revealedAt) throw new LabMissionError('Only an announced mission can expire.');
  if (tile.closedAt) throw new LabMissionError('That mission is already closed.');
  await closeMissionTileNow(event.id, tileId);
}

/**
 * Put a mission back in the hidden pool (or reopen a closed one as live), the same two states the
 * tile editor's reveal override writes. Completions stay; Reset clears those.
 */
export async function resetLabMission(event: EventRow, tileId: number, to: 'hidden' | 'live'): Promise<void> {
  const tile = await boardTile(event.id, tileId);
  if (!tile.mission) throw new LabMissionError('That tile is not a mission.');
  if (to === 'hidden') {
    await db.update(tiles).set({ revealedAt: null, closedAt: null, revealStats: null }).where(eq(tiles.id, tileId));
    return;
  }
  const [opened] = await db
    .update(tiles)
    .set({ revealedAt: tile.revealedAt ?? new Date().toISOString(), closedAt: null })
    .where(and(eq(tiles.id, tileId), isNull(tiles.parentTileId)))
    .returning({ id: tiles.id });
  if (opened && !tile.revealedAt) await captureRevealStats([opened.id]);
}

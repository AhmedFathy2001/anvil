// The tile lab's stat simulator — piece three of lib/lab.
//
// Stat tiles score off hiscores (a baseline at the start, a reading now), which no faked chat line
// can move. So the lab writes the two readings itself. It uses the BENCH mechanism to make them
// stick: a frozen participant is skipped by the hiscores sweep and scored off `frozenStats` instead
// of live readings (lib/statsSweep, lib/statTileCredit), which is exactly "these numbers and no
// others". The real tile engine then runs on them unchanged.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { completions, eventParticipants, tiles } from '@/db/schema';
import { foldLabPush, setStatValue, type Snapshot } from '@/lib/labTileProgress';
import { notifyTeamTiles } from '@/lib/pushNotify';
import { creditStatTilesForTeam } from '@/lib/statTileCredit';
import { computeGainFromJson, snapshotValue } from '@/lib/statTracking';
import { statKeys } from '@/lib/tileKinds';

function parse(json: string | null | undefined): Snapshot | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' ? (v as Snapshot) : null;
  } catch {
    return null;
  }
}

export { setStatValue };

export interface SimulateInput {
  participantId: number;
  statType: string;
  /** One hiscores key, or a tile's comma-separated trackedStat (the gain goes on its first key). */
  key: string;
  /** Starting value. Omitted: keep the current baseline's value, or start from 0. */
  baseline?: number;
  /** Added to the current reading (cumulative across calls). */
  gain: number;
}

/**
 * Move one participant's reading of one stat, then run the real stat-tile check for their team.
 * Returns the gain the engine now sees for that key and the labels of any tiles it completed.
 */
export async function simulateStatGain(eventId: number, input: SimulateInput): Promise<{ gain: number; completed: string[] }> {
  const [p] = await db
    .select()
    .from(eventParticipants)
    .where(and(eq(eventParticipants.id, input.participantId), eq(eventParticipants.eventId, eventId)))
    .limit(1);
  if (!p || p.teamId == null) throw new Error('participant not on this lab board');

  const key = statKeys(input.key)[0] ?? input.key;
  // Start from what is already there — a real hiscores reading if the sweep fetched one — so other
  // keys keep sensible values and a composite tile's siblings are not zeroed.
  const reading: Snapshot = parse(p.frozenStats) ?? parse(p.cachedStats) ?? { skills: {}, bosses: {} };
  const baseline: Snapshot = parse(p.statsSnapshot) ?? structuredClone(reading);

  const start = input.baseline ?? (snapshotValue(baseline as never, input.statType, key) || 0);
  setStatValue(baseline, input.statType, key, start);
  const before = Math.max(start, snapshotValue(reading as never, input.statType, key));
  setStatValue(reading, input.statType, key, before + input.gain);

  const now = new Date().toISOString();
  await db
    .update(eventParticipants)
    .set({
      statsSnapshot: JSON.stringify(baseline),
      snapshotAt: p.snapshotAt ?? now,
      frozenAt: now,
      frozenStats: JSON.stringify(reading),
    })
    .where(eq(eventParticipants.id, p.id));

  const statTiles = (await db.query.tiles.findMany({ where: eq(tiles.eventId, eventId) })).filter(
    (t) => !!t.trackedStat && !!t.statType && !!t.statGoal && !t.autoTrackDisabled,
  );
  const done = statTiles.length
    ? await db.query.completions.findMany({
        where: and(eq(completions.teamId, p.teamId), inArray(completions.tileId, statTiles.map((t) => t.id))),
      })
    : [];
  const doneIds = new Set(done.map((c) => c.tileId));
  const open = statTiles.filter((t) => !doneIds.has(t.id));
  const completed = open.length
    ? await creditStatTilesForTeam({ eventId, teamId: p.teamId, statTiles: open, notify: false })
    : [];

  const gain = computeGainFromJson(JSON.stringify(baseline), JSON.stringify(reading), {}, [key], input.statType);
  return { gain, completed };
}

/**
 * A stats push from a character in a live lab session, applied to that session's board ONLY — the
 * board-scoped half of /api/plugin/stats. The real route also writes the account's live overlay and
 * stat history (lib/accountPush) and moves weekly competitions; none of that runs for a lab push, so
 * the character's real profile and clans never see it. What does run is the real stat-tile engine
 * (lib/statTileCredit) on the lab participant's own baseline and reading, which are pinned the way
 * the simulator pins them (frozenAt), so the hiscores sweep leaves them alone.
 *
 * Returns the labels of the tiles it completed. Nothing happens for a character on no team.
 */
export async function applyLabStatsPush(eventId: number, accountId: number, pushed: Record<string, number>): Promise<{ completed: string[] }> {
  if (Object.keys(pushed).length === 0) return { completed: [] };
  const [p] = await db
    .select()
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.accountId, accountId)))
    .limit(1);
  if (!p || p.teamId == null) return { completed: [] };

  const { baseline, reading } = foldLabPush(parse(p.statsSnapshot), parse(p.frozenStats) ?? parse(p.cachedStats), pushed);
  const now = new Date().toISOString();
  await db
    .update(eventParticipants)
    .set({
      statsSnapshot: JSON.stringify(baseline),
      snapshotAt: p.snapshotAt ?? now,
      frozenAt: now,
      frozenStats: JSON.stringify(reading),
    })
    .where(eq(eventParticipants.id, p.id));

  // The same tiles the real route picks: auto-tracked stat tiles that read a key this push moved.
  const keys = new Set(Object.keys(pushed));
  const statTiles = (await db.query.tiles.findMany({ where: eq(tiles.eventId, eventId) })).filter(
    (t) =>
      !!t.trackedStat &&
      (t.statType === 'boss' || t.statType === 'kc' || t.statType === 'skill') &&
      !!t.statGoal &&
      !t.autoTrackDisabled &&
      statKeys(t.trackedStat).some((k) => keys.has(k)),
  );
  if (statTiles.length === 0) return { completed: [] };
  notifyTeamTiles(eventId, p.teamId, statTiles.map((t) => t.id));
  const completed = await creditStatTilesForTeam({ eventId, teamId: p.teamId, statTiles });
  return { completed };
}

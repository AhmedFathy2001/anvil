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
import { HISCORES_ACTIVITIES } from '@/lib/hiscoresActivities';
import { creditStatTilesForTeam } from '@/lib/statTileCredit';
import { computeGainFromJson, snapshotValue } from '@/lib/statTracking';
import { statKeys } from '@/lib/tileKinds';

type Snapshot = Record<string, unknown> & {
  skills?: Record<string, { xp?: number; level?: number; rank?: number }>;
  bosses?: Record<string, { score?: number; rank?: number }>;
};

function parse(json: string | null | undefined): Snapshot | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' ? (v as Snapshot) : null;
  } catch {
    return null;
  }
}

/** Write one key's value into a snapshot, in the shape snapshotValue reads back. */
export function setStatValue(snap: Snapshot, statType: string, key: string, value: number): Snapshot {
  const v = Math.max(0, Math.round(value));
  if (statType === 'skill') {
    snap.skills = { ...(snap.skills ?? {}), [key]: { ...(snap.skills?.[key] ?? {}), xp: v } };
    return snap;
  }
  const activity = HISCORES_ACTIVITIES.find((a) => a.key === key);
  if (activity) {
    let node = snap as Record<string, unknown>;
    for (const step of activity.path.slice(0, -1)) {
      node[step] = { ...((node[step] as object) ?? {}) };
      node = node[step] as Record<string, unknown>;
    }
    const last = activity.path[activity.path.length - 1];
    node[last] = { ...((node[last] as object) ?? {}), score: v };
    return snap;
  }
  snap.bosses = { ...(snap.bosses ?? {}), [key]: { ...(snap.bosses?.[key] ?? {}), score: v } };
  return snap;
}

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

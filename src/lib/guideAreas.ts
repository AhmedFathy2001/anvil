// Where each content is in the game (guide_areas), for the pre-trip check: which map regions are its
// banks and lobbies. Read from the database and cached in memory for a minute — the plugin config
// and /api/version hand the ids to every plugin, so this sits on hot paths and must never be the
// reason they fail. If the table can't be read in time (or is empty), the last good list is used,
// else the seed it shipped with (lib/tripContent TRIP_REGIONS): the same answer as before the table.

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { guideAreas } from '@/db/schema';
import { regionIds, regionsFromAreas, TRIP_REGIONS, type TripRegions } from '@/lib/tripContent';

const TTL_MS = 60_000;
const READ_TIMEOUT_MS = 1_500;

let cached: { at: number; regions: TripRegions; ids: number[] } | null = null;
let inflight: Promise<TripRegions> | null = null;

async function read(): Promise<TripRegions> {
  const rows = await Promise.race([
    db
      .select({ regionId: guideAreas.regionId, contentKey: guideAreas.contentKey, label: guideAreas.label, cues: guideAreas.cues, noBank: guideAreas.noBank, tripCheck: guideAreas.tripCheck })
      .from(guideAreas)
      .where(eq(guideAreas.tripCheck, true)),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('guide_areas read timed out')), READ_TIMEOUT_MS).unref?.()),
  ]);
  const regions = regionsFromAreas(rows);
  if (!Object.keys(regions).length) throw new Error('guide_areas is empty');
  return regions;
}

/** The pre-trip check's regions, region id → where and what. */
export async function tripRegions(): Promise<TripRegions> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.regions;
  inflight ??= read()
    .then((regions) => {
      cached = { at: Date.now(), regions, ids: regionIds(regions) };
      return regions;
    })
    .catch(() => {
      // Keep serving what we had; retry after the TTL rather than on every request.
      const regions = cached?.regions ?? TRIP_REGIONS;
      cached = { at: Date.now(), regions, ids: regionIds(regions) };
      return regions;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Every trip region id, sorted, for the plugin's `tripRegions`. */
export async function tripRegionIds(): Promise<number[]> {
  await tripRegions();
  return cached?.ids ?? regionIds(TRIP_REGIONS);
}

/** After a write to guide_areas (slice 2's staff editor), so the next read sees it. */
export function invalidateGuideAreas(): void {
  cached = null;
}

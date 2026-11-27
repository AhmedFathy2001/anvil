// The Tombs of Amascut raid level a character's pre-trip check assumes (lib/tripCheck scales the
// bosses by it), and the loadout plan picked per trip (lib/tripLoadout: Learner / Experienced / Max
// DPS). OWNER-ONLY like the items: kept on the character's own item-snapshot rows (container
// 'trip-prefs', no items), read and written for the account's own person only (callers check).

import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { playerItemSnapshots } from '@/db/schema';

/** The container key (never one of CONTAINER_KINDS, 'state' or 'target'). */
export const TRIP_PREFS_ROW = 'trip-prefs';

/** What the check assumes until the player picks: an Expert raid. */
export const DEFAULT_RAID_LEVEL = 300;
/** The levels the card offers: Entry, Normal, Expert and up, in fives as the game counts them. */
export const RAID_LEVELS = [0, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600] as const;

/** A raid level from a request or a stored row, or null: a whole number 0–600 in steps of 5. */
export function cleanRaidLevel(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 600 && n % 5 === 0 ? n : null;
}

async function prefsOf(accountId: number): Promise<Record<string, unknown>> {
  // clan-scope: global -- a character's own trip prefs, read for its own person (callers check).
  const [row] = await db
    .select({ state: playerItemSnapshots.state })
    .from(playerItemSnapshots)
    .where(and(eq(playerItemSnapshots.accountId, accountId), eq(playerItemSnapshots.container, TRIP_PREFS_ROW)))
    .limit(1);
  return (row?.state as Record<string, unknown> | null) ?? {};
}

/** Merges `patch` into the prefs row (the raid level and each trip's plan live side by side). */
async function savePrefs(accountId: number, patch: Record<string, unknown>): Promise<void> {
  const at = new Date().toISOString();
  await db
    .insert(playerItemSnapshots)
    .values({ accountId, container: TRIP_PREFS_ROW, items: [], state: patch, readAt: at, updatedAt: at })
    .onConflictDoUpdate({
      target: [playerItemSnapshots.accountId, playerItemSnapshots.container],
      set: { state: sql`coalesce(${playerItemSnapshots.state}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb`, readAt: at, updatedAt: at },
    });
}

export async function raidLevelFor(accountId: number): Promise<number> {
  return cleanRaidLevel((await prefsOf(accountId)).raidLevel) ?? DEFAULT_RAID_LEVEL;
}

export async function saveRaidLevel(accountId: number, raidLevel: number): Promise<void> {
  await savePrefs(accountId, { raidLevel });
}

/** A trip key as a prefs field: "plan:toa". */
const planKey = (contentKey: string) => `plan:${contentKey.slice(0, 40)}`;

/** The plan picked for this trip (unchecked: lib/tripLoadout cleanPlan reads it), or null. */
export async function tripPlanFor(accountId: number, contentKey: string): Promise<unknown> {
  return (await prefsOf(accountId))[planKey(contentKey)] ?? null;
}

export async function saveTripPlan(accountId: number, contentKey: string, plan: string): Promise<void> {
  await savePrefs(accountId, { [planKey(contentKey)]: plan });
}

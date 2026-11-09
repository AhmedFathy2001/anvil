import { db } from '@/db';
import { raceRoadPicks } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { parseEventRules } from '@/lib/eventRules';
import { raceRouteOpts, type TeamRouteOpts } from '@/lib/raceRoutes';

/** teamRoute / canCreditRaceTile options for this event's road mode ("Roads stay open" or none). */
export function eventRaceOpts(event: { format: string | null; rules: string | null }): TeamRouteOpts {
  return event.format === 'tilerace' ? raceRouteOpts(parseEventRules(event.rules).raceRoad) : {};
}

/**
 * A team's road picks on a "Choose and lock in" race (events.rules.raceRoad = 'choose'), as the
 * step → tile map lib/raceRoutes teamRoute takes. Null on every other board ("By achievement"), so
 * callers pass it straight through and nothing changes there.
 */
export async function loadRacePicks(event: { format: string | null; rules: string | null }, teamId: number): Promise<Map<number, number> | null> {
  if (event.format !== 'tilerace' || parseEventRules(event.rules).raceRoad !== 'choose') return null;
  // clan-scope: global -- keyed by a team id the caller already scoped.
  const rows = await db.select({ step: raceRoadPicks.step, tileId: raceRoadPicks.tileId }).from(raceRoadPicks).where(eq(raceRoadPicks.teamId, teamId));
  return new Map(rows.map((r) => [r.step, r.tileId]));
}

/** Every listed team's picks (the board views); null off "Choose and lock in". */
export async function loadRacePicksFor(event: { format: string | null; rules: string | null }, teamIds: number[]): Promise<Map<number, Map<number, number>> | null> {
  if (event.format !== 'tilerace' || parseEventRules(event.rules).raceRoad !== 'choose') return null;
  const out = new Map<number, Map<number, number>>(teamIds.map((id) => [id, new Map()]));
  if (!teamIds.length) return out;
  // clan-scope: global -- keyed by team ids the caller already scoped.
  const rows = await db.select().from(raceRoadPicks).where(inArray(raceRoadPicks.teamId, teamIds));
  for (const r of rows) out.get(r.teamId)?.set(r.step, r.tileId);
  return out;
}

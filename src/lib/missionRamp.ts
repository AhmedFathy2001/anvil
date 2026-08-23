import { tileTierKey, DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';
import type { RampPhase } from '@/lib/eventRules';

/**
 * Missions that get harder as the board runs.
 *
 * A mission pool drawn at random hands out an Ultra on day one and a Troll tile in the last hour,
 * which is backwards: the early days should be things anyone can pick up while the board fills, and
 * the closing stretch should be worth racing for. A host can already author that by hand in
 * 'scheduled' mode — one revealAt per mission — but that's a timestamp per tile, re-typed for every
 * event, and it can't survive the board being cloned into different dates.
 *
 * So the ramp is expressed as SHARES of the event rather than dates: "the first third is easy, the
 * middle is medium and hard, the last third is ultra". Clone the board into a week instead of a
 * weekend and it still means the same thing. Empty ramp = the old behaviour, one pool, no phases.
 *
 * Pure: the engine passes in the tiles and the clock.
 */

export type { RampPhase };

export interface RampEvent {
  // Optional as well as nullable: callers hand this straight from an event row or a partial prop
  // shape, and an absent date means the same thing as a null one — no run to take a share of.
  startDate?: string | null;
  endDate?: string | null;
  forceEndedAt?: string | null;
}

/**
 * How far through the event we are, 0–100, or null when that can't be known.
 *
 * A board with no end date has no "through" to speak of — it runs until someone ends it — so a ramp
 * simply doesn't apply and every mission stays eligible. Better than inventing a duration and
 * silently gating the pool on it.
 */
export function eventProgressPct(event: RampEvent, nowMs: number): number | null {
  if (!event.startDate || !event.endDate) return null;
  const start = Date.parse(event.startDate);
  const end = Date.parse(event.endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const pct = ((nowMs - start) / (end - start)) * 100;
  return Math.max(0, Math.min(100, pct));
}

/** The phase covering `pct`, or null when the ramp is empty / doesn't reach that far. */
export function phaseAt(ramp: RampPhase[], pct: number): RampPhase | null {
  const ordered = [...ramp].sort((a, b) => a.throughPct - b.throughPct);
  for (const phase of ordered) {
    if (pct <= phase.throughPct) return phase;
  }
  // Past the last phase's window (a ramp that stops at 80%): the final phase keeps running rather
  // than the pool reverting to everything for the closing stretch, which is the opposite of intent.
  return ordered.length > 0 ? ordered[ordered.length - 1] : null;
}

export interface PoolChoice<T> {
  pool: T[];
  /** The tiers the ramp asked for, for the log line. Null when no ramp applied. */
  tiers: string[] | null;
  /** True when the ramp's tiers had nothing left and we fell back to the whole pool. */
  fellBack: boolean;
}

/**
 * The missions eligible right now.
 *
 * Falls back to the WHOLE hidden pool when the current phase's tiers are exhausted. A ramp that
 * announces nothing because the easy missions ran out would stall the feature silently for the rest
 * of the event — and the host asked for a difficulty curve, not a hard gate.
 */
export function missionPool<T extends { points: number | null }>(
  hidden: T[],
  ramp: RampPhase[],
  event: RampEvent,
  nowMs: number,
  bands: TierBand[] = DEFAULT_TIER_BANDS,
): PoolChoice<T> {
  if (ramp.length === 0 || hidden.length === 0) return { pool: hidden, tiers: null, fellBack: false };
  const pct = eventProgressPct(event, nowMs);
  if (pct == null) return { pool: hidden, tiers: null, fellBack: false };

  const phase = phaseAt(ramp, pct);
  if (!phase || phase.tiers.length === 0) return { pool: hidden, tiers: null, fellBack: false };

  const wanted = new Set(phase.tiers);
  const matched = hidden.filter((t) => {
    const key = tileTierKey(t.points, bands);
    return key != null && wanted.has(key);
  });
  return matched.length > 0
    ? { pool: matched, tiers: phase.tiers, fellBack: false }
    : { pool: hidden, tiers: phase.tiers, fellBack: true };
}

/**
 * A ramp phase as dates, for the admin panel.
 *
 * Hosts think in days ("easy for the first couple of days"), but the ramp is stored as shares so it
 * survives a clone into different dates. Showing both is what makes a percentage editable without
 * anyone doing the arithmetic in their head.
 */
export function phaseWindow(event: RampEvent, from: number, through: number): { from: string; to: string } | null {
  if (!event.startDate || !event.endDate) return null;
  const start = Date.parse(event.startDate);
  const end = Date.parse(event.endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const at = (pct: number) => new Date(start + ((end - start) * pct) / 100).toISOString();
  return { from: at(Math.max(0, from)), to: at(Math.min(100, through)) };
}

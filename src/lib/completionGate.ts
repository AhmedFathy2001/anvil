import { db } from '@/db';
import { completions, events, tiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  completionAward,
  hasRevealPolicy,
  isMissionTile,
  parseEventRules,
  parseTileMissionRules,
  type EventRules,
} from '@/lib/eventRules';
import { parseStamp } from '@/lib/dbTime';

// The one rules check every completion-insert path runs (submission auto-credit, plugin stat
// push, hiscores sweep, manual admin/captain toggle). Decides whether a completion may land
// under the event's rules and, when it may, the frozen points it earns (completions.awardedPoints).
//
// Callers: run the gate BEFORE inserting; skip the insert when `allowed` is false; put
// `awardedPoints` on the inserted row; and when `bounty` is true fire handleBountyClaim
// (lib/revealEngine) after a successful insert so the rotation advances immediately.

export interface CompletionGateResult {
  allowed: boolean;
  /** Human-readable reason when blocked (surfaced by the manual route; loggable elsewhere). */
  reason?: string;
  /** Frozen award for completions.awardedPoints. Null = no rule modifiers → live tile weight. */
  awardedPoints: number | null;
  /** True on bounty events: the caller should invoke handleBountyClaim after inserting. */
  bounty: boolean;
  /**
   * Blocked because the event has not started. Unlike the rules blocks (reveal / lockout), this is
   * temporal and NON-overridable — the manual route honours it even for admins, because there is no
   * board-surgery reason to mark a tile done before the event exists in time.
   */
  beforeStart?: boolean;
  rules: EventRules;
}

type EventRow = typeof events.$inferSelect;
type TileRow = typeof tiles.$inferSelect;

/**
 * Has the event started? The one temporal truth every completion path keys off. `startDate <= now`
 * (parseStamp reads either stored time format). A null startDate is NOT started — a running event
 * always carries a start (the start action, scheduled or "start now", sets it), so null means draft /
 * never-begun, and a tile must not complete there.
 */
export function eventHasStarted(event: Pick<EventRow, 'startDate'>, now: number = Date.now()): boolean {
  const startMs = parseStamp(event.startDate);
  return startMs != null && startMs <= now;
}

// The scoring fields a mission overrides on the event rules (lockout / first-clear bonus / decay).
// expiryHours is engine-only (auto-close), not a gate concern.
function pickMissionScoring(tileRules: string | null): Pick<EventRules, 'lockout' | 'firstBonus' | 'decay'> {
  const m = parseTileMissionRules(tileRules);
  return { lockout: m.lockout, firstBonus: m.firstBonus, decay: m.decay };
}

export async function evaluateCompletionGate(args: {
  event: EventRow;
  tile: TileRow;
  teamId: number;
}): Promise<CompletionGateResult> {
  const { event, tile, teamId } = args;
  const eventRules = parseEventRules(event.rules);
  const isMission = isMissionTile(tile);
  // A mission carries its OWN scoring (lockout/firstBonus/decay), merged over the event rules; a normal
  // tile just uses the event rules. Everything below keys off this one merged object.
  const rules: EventRules = isMission
    ? { ...eventRules, ...pickMissionScoring(tile.rules) }
    : eventRules;
  // A mission is reveal-gated even on a classic board (hidden until announced); the base board follows
  // its own policy. Bounty stays BOARD-only so a mission claim never triggers board rotation.
  const tileRevealGated = hasRevealPolicy(eventRules) || isMission;
  const bounty = eventRules.revealPolicy === 'bounty';

  // Nothing completes before the whistle — checked first, ahead of every rules block, and applied to
  // EVERY path (sweep, plugin push, submission auto-credit, manual toggle). A gain accruing pre-start
  // is already held to zero by the baseline anchoring (lib/statTracking), but a manual toggle, a
  // submission, or any non-stat tile kind has no baseline to lean on — so the completion itself is
  // gated here. `beforeStart` marks it non-overridable for the manual route's admin bypass.
  if (!eventHasStarted(event)) {
    return { allowed: false, reason: "The event hasn't started yet.", awardedPoints: null, bounty, beforeStart: true, rules };
  }

  if (tileRevealGated && tile.revealedAt == null) {
    const reason = isMission ? 'This mission has not been announced yet.' : 'This tile has not been revealed yet.';
    return { allowed: false, reason, awardedPoints: null, bounty, rules };
  }
  if (tileRevealGated && tile.closedAt != null) {
    // Rotating tasks / expired missions close on time; bounties + lockout missions close on first claim.
    const reason = isMission
      ? 'This mission is over.'
      : rules.revealPolicy === 'rotating'
        ? 'This task has expired.'
        : 'This tile has already been claimed.';
    return { allowed: false, reason, awardedPoints: null, bounty, rules };
  }

  // Only hit the DB when a rule actually cares who completed the tile before.
  const needExisting = rules.lockout || rules.firstBonus > 0;
  let existing: { teamId: number }[] = [];
  if (needExisting) {
    existing = await db
      .select({ teamId: completions.teamId })
      .from(completions)
      .where(eq(completions.tileId, tile.id));
  }
  if (rules.lockout && existing.some((c) => c.teamId !== teamId)) {
    return {
      allowed: false,
      reason: 'Another team completed this tile first — it is locked.',
      awardedPoints: null,
      bounty,
      rules,
    };
  }

  const awardedPoints = completionAward({
    scoringMode: event.scoringMode,
    rules,
    tilePoints: tile.points,
    tileRevealedAt: tile.revealedAt,
    isFirst: existing.length === 0,
  });
  return { allowed: true, awardedPoints, bounty, rules };
}

import { db } from '@/db';
import { completions, events, tiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  completionAward,
  hasRevealPolicy,
  parseEventRules,
  type EventRules,
} from '@/lib/eventRules';

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
  rules: EventRules;
}

type EventRow = typeof events.$inferSelect;
type TileRow = typeof tiles.$inferSelect;

export async function evaluateCompletionGate(args: {
  event: EventRow;
  tile: TileRow;
  teamId: number;
}): Promise<CompletionGateResult> {
  const { event, tile, teamId } = args;
  const rules = parseEventRules(event.rules);
  const revealMode = hasRevealPolicy(rules);
  const bounty = rules.revealPolicy === 'bounty';

  if (revealMode && tile.revealedAt == null) {
    return { allowed: false, reason: 'This tile has not been revealed yet.', awardedPoints: null, bounty, rules };
  }
  if (revealMode && tile.closedAt != null) {
    return { allowed: false, reason: 'This tile has already been claimed.', awardedPoints: null, bounty, rules };
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

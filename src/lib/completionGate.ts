import { db } from '@/db';
import { completions, eventParticipants, events, tiles } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { raceGraph, canCreditRaceTile, raceTileNeedsBaseline } from '@/lib/raceRoutes';
import { parseRevealStats } from '@/lib/revealStats';
import { loadRacePicks } from '@/lib/raceRoutePicks';
import {
  completionAward,
  hasRevealPolicy,
  isMissionTile,
  missionClaimCap,
  missionPlaceGp,
  parseEventRules,
  parseTileMissionRules,
  type EventRules,
  type MissionRules,
} from '@/lib/eventRules';
import { getCofferBalance } from '@/lib/coffer';
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
  /** Blocked only because the tile isn't open on the team's race route (lib/raceRoutes). */
  raceLocked?: boolean;
  rules: EventRules;
  /**
   * Set when the completion is landing on a mission that pays a placement ladder: where in the
   * order this claim came, the gp its place is owed, and whether the coffer could cover it at the
   * moment the points were frozen. The caller passes it to lib/missionAwards after the insert so
   * the reservation is made against the same decision the points were computed from.
   */
  missionAward?: { place: number; gp: number; funded: boolean };
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

/**
 * Whether an event-owned row genuinely happened during the event.
 *
 * This is deliberately stricter than merely checking that the event is live now. Old versions of
 * the ingest paths could attach activity while a board was only revealed, before its start. Those
 * rows must stay quarantined after the whistle too; otherwise an invalid pre-start completion that
 * is hidden today would suddenly score when the scheduled start arrives.
 */
export function eventActivityIsValid(
  event: Pick<EventRow, 'startDate'>,
  occurredAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  const startMs = parseStamp(event.startDate);
  const occurredMs = parseStamp(occurredAt);
  return startMs != null && startMs <= now && occurredMs != null && occurredMs >= startMs;
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
  /** Internal: the gate is running for a combo part's parent (see below). */
  forPart?: boolean;
}): Promise<CompletionGateResult> {
  const { event, tile, teamId, forPart = false } = args;
  // A COMBO PART (lib/combo) runs on its combo's gate — a part of a hidden, claimed or locked-out combo
  // must not progress — but its own row is only progress: no award to freeze, no bounty to claim, no
  // mission place to take. The combo's completion (lib/comboCompletion) goes through the gate for real.
  if (tile.parentTileId != null) {
    const parent = await db.query.tiles.findFirst({ where: eq(tiles.id, tile.parentTileId) });
    if (!parent) return { allowed: false, reason: 'This part has no combo.', awardedPoints: null, bounty: false, rules: parseEventRules(event.rules) };
    const g = await evaluateCompletionGate({ event, tile: parent, teamId, forPart: true });
    return { allowed: g.allowed, reason: g.reason, beforeStart: g.beforeStart, rules: g.rules, awardedPoints: null, bounty: false };
  }
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

  // Tile race: only a tile OPEN on the team's route credits (lib/raceRoutes) — the next tile on a
  // straight line, a link from the committed tile on a branching board. Every insert path runs this
  // gate, so the hiscores sweep and live stat pushes can't credit a locked or closed-off race tile
  // either. A combo part's own progress isn't held (forPart); its combo is, when it completes.
  if (event.format === 'tilerace' && !forPart && !isMission && tile.parentTileId == null) {
    const board = await db.select().from(tiles).where(and(eq(tiles.eventId, event.id), isNull(tiles.parentTileId)));
    const done = (await db.select({ tileId: completions.tileId }).from(completions).where(eq(completions.teamId, teamId))).map((r) => r.tileId);
    const picks = await loadRacePicks(event, teamId);
    const graph = raceGraph(board);
    if (!done.includes(tile.id) && !canCreditRaceTile(graph, done, tile.id, picks)) {
      return { allowed: false, reason: 'That tile isn’t open on your team’s route yet.', awardedPoints: null, bounty, rules, raceLocked: true };
    }
    // A stat (XP / KC) race tile counts only what the team gains AFTER it opened for them: its
    // baseline is captured at the open (lib/raceRoutesDb). Missing one — a capture that hasn't landed
    // yet, or a race already running when this shipped — take it now and count from here.
    if (!done.includes(tile.id) && tile.trackedStat && tile.statType && raceTileNeedsBaseline(graph, tile.id, eventRules.raceRoad)) {
      const stats = parseRevealStats(tile.revealStats);
      const mine = await db.select({ id: eventParticipants.id }).from(eventParticipants).where(and(eq(eventParticipants.eventId, event.id), eq(eventParticipants.teamId, teamId)));
      if (mine.length && !mine.some((p) => stats?.[p.id] != null)) {
        const { captureRaceOpenStats } = await import('@/lib/revealStatsCapture');
        await captureRaceOpenStats(event.id, teamId, [tile.id]);
        return { allowed: false, reason: 'This tile counts from when it opened for your team — counting starts now.', awardedPoints: null, bounty, rules };
      }
    }
  }

  // A mission's placement ladder needs to know the finishing ORDER, so it joins lockout and the
  // first-clear bonus in the set of rules that care who got here first.
  const mission: MissionRules | null = isMission ? parseTileMissionRules(tile.rules) : null;
  const reward = mission?.reward ?? null;
  const claimCap = mission ? missionClaimCap(mission) : rules.lockout ? 1 : null;

  // Only hit the DB when a rule actually cares who completed the tile before.
  const needExisting = rules.lockout || rules.firstBonus > 0 || reward != null || claimCap != null;
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
  // A claim cap is lockout for more than one winner: the places fill up, and once they are gone the
  // mission is over for anyone who hasn't already scored it.
  if (claimCap != null && !existing.some((c) => c.teamId === teamId) && existing.length >= claimCap) {
    return {
      allowed: false,
      reason:
        claimCap === 1
          ? 'Another team completed this tile first — it is locked.'
          : `All ${claimCap} places on this mission have been taken.`,
      awardedPoints: null,
      bounty,
      rules,
    };
  }

  // Where this claim lands in the order, and — for a place that pays gp — whether the coffer can
  // cover it RIGHT NOW. Both decisions are frozen here: the points below are computed from them,
  // and lib/missionAwards reserves against the same answer after the row is inserted.
  const place = existing.length + 1;
  // The mission's own rules, so a weekend's stamped prize multiplier is part of what is owed.
  const placeGp = mission ? missionPlaceGp(mission, place) : 0;
  let funded = true;
  if (placeGp > 0) {
    const balance = await getCofferBalance(event.clanId);
    funded = balance.available >= placeGp;
  }

  const awardedPoints = completionAward({
    scoringMode: event.scoringMode,
    rules,
    tilePoints: tile.points,
    tileRevealedAt: tile.revealedAt,
    isFirst: existing.length === 0,
    reward,
    place,
    funded,
    multiplier: mission?.multiplier,
  });
  return {
    allowed: true,
    awardedPoints,
    bounty,
    rules,
    ...(placeGp > 0 ? { missionAward: { place, gp: placeGp, funded } } : {}),
  };
}

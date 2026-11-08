// Tile controls on a lab board (/staff/lab/<id>): complete, clear, or set the progress of any tile,
// for any team, as if a chosen player on that team had done it. Where each tile kind keeps its
// progress is lib/labTileProgress; this file writes it and then lets the REAL engine decide —
// lib/submissions syncDropTileCompletion for submission-backed tiles, lib/statTileCredit for KC / XP
// tiles — so announcements, the activity feed, combos and bounties behave exactly as on a real board.
//
// Only when the engine holds a finished tile back (a count-only plugin kind waits for a screenshot,
// a race or event rule blocks it, the tile's auto-credit is switched off, or the kind has no number
// at all) does it fall back to the admin's manual completion: the same row, gate award, announcement
// and blackout check as the event completions route, with the chosen player credited.
//
// Every write is pinned to the lab event the route already resolved (lib/lab labEvent).

import { branchingRaceWin } from '@/lib/raceRoutesDb';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { completions, eventParticipants, statTileProgress, submissions, teams, tileClaims, tiles, type events } from '@/db/schema';
import { afterPartCompletion } from '@/lib/comboCompletion';
import { evaluateCompletionGate } from '@/lib/completionGate';
import { notifyTeamWin, notifyTileCompletion } from '@/lib/discord';
import { parseJsonArray, statKeys } from '@/lib/tileKinds';
import {
  clampProgress,
  LAB_PROGRESS_NOTE,
  progressGoal,
  progressRows,
  progressStore,
  reachesGoal,
  withStatProgress,
  type ProgressStore,
  type Snapshot,
} from '@/lib/labTileProgress';
import { handleBountyClaim, reopenBountyTileIfUnclaimed } from '@/lib/revealEngine';
import { creditStatTilesForTeam } from '@/lib/statTileCredit';
import { syncDropTileCompletion } from '@/lib/submissions';
import { computeGainFromJson, isIndividualMode, isMilestoneBasis, milestoneStateFromJson } from '@/lib/statTracking';

type EventRow = typeof events.$inferSelect;
type TileRow = typeof tiles.$inferSelect;
type TeamRow = typeof teams.$inferSelect;
type Participant = typeof eventParticipants.$inferSelect;

/** A request the board cannot honour (wrong team, tile or player for this session). */
export class LabTileError extends Error {}

export interface TileControlResult {
  /** Whether the team has the tile completed after the action. */
  complete: boolean;
  /** The team's progress on the tile after the action, when the kind has a number. */
  progress: number | null;
  goal: number | null;
  store: ProgressStore | null;
}

async function loadTarget(eventId: number, teamId: number, tileId: number) {
  const [tile] = await db.select().from(tiles).where(and(eq(tiles.id, tileId), eq(tiles.eventId, eventId))).limit(1);
  if (!tile) throw new LabTileError('That tile is not on this board.');
  const [team] = await db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.eventId, eventId))).limit(1);
  if (!team) throw new LabTileError('That team is not on this board.');
  return { tile, team };
}

async function loadPlayer(eventId: number, teamId: number, participantId: number): Promise<Participant> {
  const [p] = await db
    .select()
    .from(eventParticipants)
    .where(and(eq(eventParticipants.id, participantId), eq(eventParticipants.eventId, eventId), eq(eventParticipants.teamId, teamId)))
    .limit(1);
  if (!p) throw new LabTileError('That player is not on this team.');
  return p;
}

async function isComplete(teamId: number, tileId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: completions.id })
    .from(completions)
    .where(and(eq(completions.teamId, teamId), eq(completions.tileId, tileId)))
    .limit(1);
  return !!row;
}

/**
 * The admin's manual completion (api/events/<id>/completions POST), crediting `player`: the rules gate
 * still freezes the award, but its blocks are bypassed exactly as for an admin — except "before the
 * start", which no one may bypass.
 */
async function forceComplete(event: EventRow, tile: TileRow, team: TeamRow, player: Participant | null): Promise<void> {
  const gate = await evaluateCompletionGate({ event, tile, teamId: team.id });
  if (!gate.allowed && gate.beforeStart) throw new LabTileError(gate.reason ?? 'The session has not started.');
  const [inserted] = await db
    .insert(completions)
    .values({ teamId: team.id, tileId: tile.id, awardedPoints: gate.awardedPoints, creditPlayerId: player?.id ?? null })
    .onConflictDoNothing()
    .returning({ id: completions.id });
  if (!inserted) return;
  if (tile.parentTileId != null) {
    await afterPartCompletion(tile, team.id, { change: 'added', notifyClanId: event.clanId, finisher: player?.name ?? null });
    return;
  }
  if (gate.bounty) handleBountyClaim(event.id, tile.id).catch(() => {});
  notifyTileCompletion({
    clanId: event.clanId,
    eventName: event.name,
    tileLabel: tile.label,
    teamName: team.name,
    teamId: team.id,
    teamColor: team.color,
    tileType: tile.tileType,
    trackedStat: tile.trackedStat,
    statType: tile.statType,
    eventId: event.id,
    tile,
    finisher: player?.name ?? null,
  }).catch(() => {});
  // Blackout: board tiles only (combo parts are not cells).
  const boardTiles = await db.select({ id: tiles.id }).from(tiles).where(and(eq(tiles.eventId, event.id), isNull(tiles.parentTileId)));
  const done = await db.select({ tileId: completions.tileId }).from(completions).where(eq(completions.teamId, team.id));
  const doneIds = new Set(done.map((d) => d.tileId));
  const race = await branchingRaceWin(event, team.id);
  if (race ? race.won : boardTiles.length > 0 && boardTiles.every((t) => doneIds.has(t.id))) {
    notifyTeamWin({
      clanId: event.clanId,
      eventName: event.name,
      teamName: team.name,
      teamId: team.id,
      teamColor: team.color,
      totalTiles: race ? race.steps : boardTiles.length,
      eventId: event.id,
    }).catch(() => {});
  }
}

/** Take a completion away the way the engine does: a combo part re-checks its combo, a bounty reopens. */
async function removeCompletion(event: EventRow, tile: TileRow, teamId: number): Promise<void> {
  const removed = await db
    .delete(completions)
    .where(and(eq(completions.teamId, teamId), eq(completions.tileId, tile.id)))
    .returning({ id: completions.id });
  if (removed.length === 0) return;
  if (tile.parentTileId != null) await afterPartCompletion(tile, teamId, { change: 'removed', silent: true });
  else await reopenBountyTileIfUnclaimed(event.id, tile.id).catch(() => {});
}

// ── Stat tiles ───────────────────────────────────────────────────────────────────────────────

function parseSnap(json: string | null | undefined): Snapshot | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' ? (v as Snapshot) : null;
  } catch {
    return null;
  }
}

/** A member's gain (or lifetime, on a milestone tile) on this tile, as lib/statTileCredit reads it on a lab board. */
function statProgressOf(tile: TileRow, p: Participant): number {
  const keys = statKeys(tile.trackedStat);
  const current = p.frozenAt ? p.frozenStats : p.cachedStats;
  if (isMilestoneBasis(tile.statBasis)) {
    const ms = milestoneStateFromJson(p.statsSnapshot, current, {}, keys, tile.statType!, tile.statGoal!);
    return ms.eligible ? ms.lifetime : 0;
  }
  return computeGainFromJson(p.statsSnapshot, current, {}, keys, tile.statType!);
}

/** Pin a member's reading of this tile's keys so their progress on it is `target` (lib/labStats freezes the same way). */
async function pinStat(tile: TileRow, p: Participant, target: number): Promise<void> {
  const reading = parseSnap(p.frozenStats) ?? parseSnap(p.cachedStats) ?? { skills: {}, bosses: {} };
  const baseline = parseSnap(p.statsSnapshot) ?? structuredClone(reading);
  const milestone = isMilestoneBasis(tile.statBasis) && target > 0;
  withStatProgress(baseline, reading, tile.statType!, statKeys(tile.trackedStat), target, { milestone });
  const now = new Date().toISOString();
  await db
    .update(eventParticipants)
    .set({ statsSnapshot: JSON.stringify(baseline), snapshotAt: p.snapshotAt ?? now, frozenAt: now, frozenStats: JSON.stringify(reading) })
    .where(eq(eventParticipants.id, p.id));
}

async function teamPlayers(eventId: number, teamId: number): Promise<Participant[]> {
  return db
    .select()
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.teamId, teamId)));
}

/** The team's progress on a stat tile: the sum on a team tile, the best member on a solo or milestone one. */
async function statTeamProgress(eventId: number, tile: TileRow, teamId: number): Promise<number> {
  const values = (await teamPlayers(eventId, teamId)).map((p) => statProgressOf(tile, p));
  const individual = isMilestoneBasis(tile.statBasis) || isIndividualMode(tile.trackingMode);
  return individual ? Math.max(0, ...values) : values.reduce((a, b) => a + b, 0);
}

async function setStatProgress(event: EventRow, tile: TileRow, team: TeamRow, player: Participant, n: number): Promise<void> {
  const individual = isMilestoneBasis(tile.statBasis) || isIndividualMode(tile.trackingMode);
  if (!individual) {
    // A team tile sums every member, so "progress N" means the chosen player has N and nobody else any.
    for (const other of await teamPlayers(event.id, team.id)) {
      if (other.id !== player.id && statProgressOf(tile, other) > 0) await pinStat(tile, other, 0);
    }
  }
  await pinStat(tile, player, n);
  // Lowering a finished tile un-finishes it (the stat engine only ever adds a completion).
  if (!reachesGoal('stat', n, tile.statGoal)) await removeCompletion(event, tile, team.id);
  // The overshoot ledger orders gains between checks; a hand-set number has no order to keep.
  await db.delete(statTileProgress).where(and(eq(statTileProgress.teamId, team.id), eq(statTileProgress.tileId, tile.id)));
  if (!tile.autoTrackDisabled) await creditStatTilesForTeam({ eventId: event.id, teamId: team.id, statTiles: [tile] });
}

// ── Submission-backed tiles ──────────────────────────────────────────────────────────────────

async function writeRows(tile: TileRow, teamId: number, player: Participant, rows: ReturnType<typeof progressRows>): Promise<void> {
  await db.delete(submissions).where(and(eq(submissions.tileId, tile.id), eq(submissions.teamId, teamId)));
  if (rows.length === 0) return;
  await db.insert(submissions).values(
    rows.map((r) => ({
      tileId: tile.id,
      teamId,
      playerId: player.id,
      creditPlayerId: player.id,
      amount: r.amount,
      itemId: r.itemId,
      durationSeconds: r.durationSeconds,
      goal: r.goal,
      note: LAB_PROGRESS_NOTE,
      source: 'web',
    })),
  );
}

/** Credit one of each item a collection asks for (its own amount each), so every set is satisfied. */
function collectionRows(tile: TileRow): ReturnType<typeof progressRows> {
  return parseJsonArray<{ itemId?: number; requiredAmount?: number }>(tile.itemRequirements)
    .filter((r) => Number.isInteger(r.itemId))
    .map((r) => ({ amount: Math.max(1, r.requiredAmount ?? 1), itemId: r.itemId!, durationSeconds: null, goal: null }));
}

// ── The three actions ────────────────────────────────────────────────────────────────────────

async function result(event: EventRow, tile: TileRow, teamId: number, progress?: number): Promise<TileControlResult> {
  const store = progressStore(tile);
  const goal = progressGoal(tile, store);
  let value: number | null = progress ?? null;
  if (store === 'stat') value = await statTeamProgress(event.id, tile, teamId);
  return { complete: await isComplete(teamId, tile.id), progress: store ? value : null, goal, store };
}

/**
 * Set the team's progress on a tile to `n`, credited to one of its players. Reaching the goal
 * completes it (through the real engine first); falling below it un-completes it.
 */
export async function labSetTileProgress(event: EventRow, teamId: number, tileId: number, participantId: number, n: number): Promise<TileControlResult> {
  const { tile, team } = await loadTarget(event.id, teamId, tileId);
  const player = await loadPlayer(event.id, teamId, participantId);
  const store = progressStore(tile);
  if (!store) throw new LabTileError('This tile has no number to set — complete or clear it instead.');
  const value = clampProgress(store, n);
  const goal = progressGoal(tile, store);
  const reached = reachesGoal(store, value, goal);

  if (store === 'stat') {
    await setStatProgress(event, tile, team, player, value);
  } else {
    await writeRows(tile, team.id, player, progressRows(tile, store, value));
    await syncDropTileCompletion(tile.id, team.id);
    if (!reached) await removeCompletion(event, tile, team.id);
  }
  // Held back by something other than the count (no screenshot, a rule, auto-credit off): finish it by hand.
  if (reached && !(await isComplete(team.id, tile.id))) await forceComplete(event, tile, team, player);
  return result(event, tile, team.id, value);
}

/** Complete a tile for a team as if `participantId` finished it: its progress is set to the goal first. */
export async function labCompleteTile(event: EventRow, teamId: number, tileId: number, participantId: number): Promise<TileControlResult> {
  const { tile, team } = await loadTarget(event.id, teamId, tileId);
  const player = await loadPlayer(event.id, teamId, participantId);
  if (await isComplete(team.id, tile.id)) return result(event, tile, team.id);
  const store = progressStore(tile);
  const goal = progressGoal(tile, store);
  if (store && goal != null && goal > 0) return labSetTileProgress(event, teamId, tileId, participantId, goal);
  const collection = collectionRows(tile);
  if (collection.length > 0) {
    await writeRows(tile, team.id, player, collection);
    await syncDropTileCompletion(tile.id, team.id);
  }
  if (!(await isComplete(team.id, tile.id))) await forceComplete(event, tile, team, player);
  return result(event, tile, team.id);
}

/**
 * Clear a tile for a team: its completion, submissions, claims and stat ledger go, and every member's
 * gain on a stat tile goes back to zero (otherwise the next check would complete it again). A combo
 * clears its parts too.
 */
export async function labClearTile(event: EventRow, teamId: number, tileId: number): Promise<TileControlResult> {
  const { tile, team } = await loadTarget(event.id, teamId, tileId);
  const parts = await db.select().from(tiles).where(and(eq(tiles.eventId, event.id), eq(tiles.parentTileId, tile.id)));
  for (const part of parts) await clearOne(event, part, team);
  await clearOne(event, tile, team);
  return result(event, tile, team.id, 0);
}

async function clearOne(event: EventRow, tile: TileRow, team: TeamRow): Promise<void> {
  if (progressStore(tile) === 'stat') {
    for (const p of await teamPlayers(event.id, team.id)) {
      if (statProgressOf(tile, p) > 0) await pinStat(tile, p, 0);
    }
  }
  await db.delete(submissions).where(and(eq(submissions.tileId, tile.id), eq(submissions.teamId, team.id)));
  await db.delete(statTileProgress).where(and(eq(statTileProgress.teamId, team.id), eq(statTileProgress.tileId, tile.id)));
  await db.delete(tileClaims).where(and(eq(tileClaims.eventId, event.id), eq(tileClaims.teamId, team.id), eq(tileClaims.tileId, tile.id)));
  await removeCompletion(event, tile, team.id);
}

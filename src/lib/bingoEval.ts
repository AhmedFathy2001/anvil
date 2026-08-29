// Bingo stat-tile COMPLETION, evaluated per event over STORED snapshots.
//
// The hiscores sweep (/api/cron/stats) settles completions in-memory from the snapshots it fetched
// this tick. Forge fetches instead, so its consumer (lib/forgeConsume) writes each account's snapshot
// into eventParticipants.cachedStats (and, first time, the start-anchored statsSnapshot baseline) and
// then calls this per touched event. Reading the STORED baseline/current/overlay for EVERY participant
// — fetched this tick or not — is what makes a team total whole without the cron's per-tick assumption
// that all teammates were fetched together.
//
// The scoring RULES are identical to the sweep's Phase 3 and reuse the same primitives
// (computeGain / milestoneState / evaluateCompletionGate / buildContributionSnapshot), so a tile
// completes one way whichever sweep is running. The two paths are mutually exclusive (the sweep-owner
// flag), so this never races the cron; within a call, the completions unique index (team_tile_unique)
// plus onConflictDoNothing is the real dedup, and notify fires only on a genuine insert.
//
// Pre-event safety is inherited, not re-implemented: baselines are start-anchored + overlay-absorbed
// upstream (lib/statTracking), and evaluateCompletionGate refuses any completion before the event
// started — so nothing here can credit or complete a tile pre-event.

import { eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { completions, clanRoster, eventParticipants, events, teams, tiles } from '@/db/schema';
import { evaluateCompletionGate } from '@/lib/completionGate';
import { handleBountyClaim } from '@/lib/revealEngine';
import { notifyTileCompletion } from '@/lib/discord';
import { parsePluginStats } from '@/lib/pluginStats';
import { statKeys } from '@/lib/tileKinds';
import {
  buildContributionSnapshot,
  computeGainFromJson,
  isIndividualMode,
  isMilestoneBasis,
  milestoneStateFromJson,
} from '@/lib/statTracking';
import { log } from '@/lib/logger';

export interface BingoEvalResult {
  eventId: number;
  tilesCompleted: { tileLabel: string; teamName: string; playerName: string }[];
}

/**
 * Evaluate one event's stat-tile completions from stored snapshots. Idempotent: a tile already
 * completed is skipped (in-memory set + the DB unique index), so this is safe to call every tick and
 * to re-run after a crash. Returns the tiles it newly completed, for the consumer's tick log.
 */
export async function evaluateBingoEvent(eventId: number): Promise<BingoEvalResult> {
  const result: BingoEvalResult = { eventId, tilesCompleted: [] };

  // clan-scope: global -- addressed by event id, which the caller already resolved; this evaluates
  // that one event's own board and carries event.clanId into every downstream notify.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return result;

  const eventTiles = await db.query.tiles.findMany({ where: eq(tiles.eventId, eventId) });
  // Same filter as the sweep: a stat tile is tracked/goal'd and not flipped to manual.
  const statTiles = eventTiles.filter((t) => t.trackedStat && t.statType && t.statGoal && !t.autoTrackDisabled);
  if (statTiles.length === 0) return result;

  const eventTeams = await db.query.teams.findMany({ where: eq(teams.eventId, eventId) });
  const teamMap = new Map(eventTeams.map((t) => [t.id, t]));
  const participants = await db.query.eventParticipants.findMany({ where: eq(eventParticipants.eventId, eventId) });

  const tileIds = eventTiles.map((t) => t.id);
  const existing = tileIds.length
    ? await db.select({ teamId: completions.teamId, tileId: completions.tileId }).from(completions).where(inArray(completions.tileId, tileIds))
    : [];
  const completionSet = new Set(existing.map((c) => `${c.teamId}-${c.tileId}`));

  // The live overlay is per-account, addressed here by the participant's seat (clanRoster is the
  // seat→account view). Frozen (benched) players ignore the overlay — their current is pinned.
  const seatIds = participants.map((p) => p.clanMemberId).filter((x): x is number => x != null);
  const liveBySeat = new Map<number, Record<string, number>>();
  if (seatIds.length > 0) {
    const rows = await db
      .select({ id: clanRoster.id, liveStats: clanRoster.liveStats })
      // clan-scope: global -- seatIds are exactly this event's own participants' seats, gathered above.
      .from(clanRoster)
      .where(inArray(clanRoster.id, seatIds));
    for (const r of rows) liveBySeat.set(r.id, parsePluginStats(r.liveStats));
  }

  /** A participant's "current" snapshot + effective overlay — frozen players read frozenStats + {}. */
  function currentOf(p: (typeof participants)[number]): { currentJson: string | null; liveMap: Record<string, number> } {
    if (p.frozenAt) return { currentJson: p.frozenStats, liveMap: {} };
    return { currentJson: p.cachedStats, liveMap: (p.clanMemberId != null ? liveBySeat.get(p.clanMemberId) : undefined) ?? {} };
  }

  // Team-mode accumulation, filled while walking participants; drained after.
  const teamGains = new Map<string, number>();
  const teamMemberGains = new Map<string, { playerId: number; gained: number }[]>();

  // ── Individual / milestone completions per member, and team-mode accumulation. ───────────────────
  for (const p of participants) {
    if (!p.teamId || !p.statsSnapshot) continue; // no team, or not baselined yet → nothing to score
    const { currentJson, liveMap } = currentOf(p);
    for (const tile of statTiles) {
      const key = `${p.teamId}-${tile.id}`;
      if (completionSet.has(key)) continue;
      const keys = statKeys(tile.trackedStat);
      const milestone = isMilestoneBasis(tile.statBasis);

      // Team-mode tile: accumulate every member's gain (benched included, via frozenStats) toward the
      // team total; the completion is decided after the walk.
      if (!milestone && !isIndividualMode(tile.trackingMode)) {
        const gained = computeGainFromJson(p.statsSnapshot, currentJson, liveMap, keys, tile.statType!);
        teamGains.set(key, (teamGains.get(key) || 0) + gained);
        if (gained > 0) {
          const members = teamMemberGains.get(key) ?? [];
          members.push({ playerId: p.id, gained });
          teamMemberGains.set(key, members);
        }
        continue;
      }

      // Individual / milestone tile — settled per member, and never for a benched player (their gain
      // is frozen; if they had reached it while active it is already completed).
      if (p.frozenAt) continue;
      const ms = milestone
        ? milestoneStateFromJson(p.statsSnapshot, currentJson, liveMap, keys, tile.statType!, tile.statGoal!)
        : null;
      const gained = ms ? ms.lifetime : computeGainFromJson(p.statsSnapshot, currentJson, liveMap, keys, tile.statType!);
      const meetsGoal = ms ? ms.reached : gained >= tile.statGoal!;
      if (!meetsGoal) continue;

      const gate = await evaluateCompletionGate({ event, tile, teamId: p.teamId });
      if (!gate.allowed) continue;
      const inserted = await db
        .insert(completions)
        .values({
          teamId: p.teamId,
          tileId: tile.id,
          creditPlayerId: p.id, // hiscores completion has no submission — this names the finisher
          statContributions: JSON.stringify(buildContributionSnapshot(tile.statGoal!, [{ playerId: p.id, gained }])),
          awardedPoints: gate.awardedPoints,
        })
        .onConflictDoNothing()
        .returning({ id: completions.id });
      completionSet.add(key);
      if (inserted.length > 0) {
        if (gate.bounty) handleBountyClaim(event.id, tile.id).catch(() => {});
        const team = teamMap.get(p.teamId);
        result.tilesCompleted.push({ tileLabel: tile.label, teamName: team?.name || 'Unknown', playerName: p.name });
        if (team) {
          notifyTileCompletion({
            clanId: event.clanId,
            eventName: event.name,
            tileLabel: tile.label,
            teamName: team.name,
            teamColor: team.color,
            tileType: tile.tileType,
            trackedStat: tile.trackedStat,
            statType: tile.statType,
            eventId: event.id,
            tile,
          }).catch(() => {});
        }
      }
    }
  }

  // ── Team-mode completions from the accumulated totals. ───────────────────────────────────────────
  for (const tile of statTiles) {
    if (isIndividualMode(tile.trackingMode) || isMilestoneBasis(tile.statBasis)) continue;
    for (const team of eventTeams) {
      const key = `${team.id}-${tile.id}`;
      if (completionSet.has(key)) continue;
      if ((teamGains.get(key) || 0) < tile.statGoal!) continue;

      const gate = await evaluateCompletionGate({ event, tile, teamId: team.id });
      if (!gate.allowed) continue;
      const inserted = await db
        .insert(completions)
        .values({
          teamId: team.id,
          tileId: tile.id,
          // Freeze the per-member split so "who got what %" can't drift as the team's KC/XP climbs on.
          statContributions: JSON.stringify(buildContributionSnapshot(tile.statGoal!, teamMemberGains.get(key) ?? [])),
          awardedPoints: gate.awardedPoints,
        })
        .onConflictDoNothing()
        .returning({ id: completions.id });
      completionSet.add(key);
      if (inserted.length > 0) {
        if (gate.bounty) handleBountyClaim(event.id, tile.id).catch(() => {});
        result.tilesCompleted.push({ tileLabel: tile.label, teamName: team.name, playerName: '(team total)' });
        notifyTileCompletion({
          clanId: event.clanId,
          eventName: event.name,
          tileLabel: tile.label,
          teamName: team.name,
          teamColor: team.color,
          tileType: tile.tileType,
          trackedStat: tile.trackedStat,
          statType: tile.statType,
          eventId: event.id,
          tile,
        }).catch(() => {});
      }
    }
  }

  if (result.tilesCompleted.length > 0) {
    log.info('forge-bingo.completed', { eventId, count: result.tilesCompleted.length });
  }
  return result;
}

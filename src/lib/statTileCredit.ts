import { db } from '@/db';
import { completions, eventParticipants, events, teams, tiles } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { statKeys } from '@/lib/tileKinds';
import { computeGainFromJson, isIndividualMode, isMilestoneBasis, milestoneStateFromJson, buildContributionSnapshot } from '@/lib/statTracking';
import { liveStatsForMembers } from '@/lib/liveStats';
import { notifyTileCompletion } from '@/lib/discord';
import { evaluateCompletionGate } from '@/lib/completionGate';
import { handleBountyClaim } from '@/lib/revealEngine';

type StatTile = typeof tiles.$inferSelect;

/**
 * Complete any of `statTiles` this team has reached, off every member's live gain (max of hiscores
 * and the plugin overlay over their baseline). Returns the labels of the tiles it completed.
 *
 * The live plugin push runs this for the tiles its keys touched; the admin "Recompute completions"
 * runs it for every stat tile, which is what heals a tile that crossed its goal while no check ran
 * (a pushing account the sweep leaves to the plugin, whose push couldn't find its board).
 *
 * Only ever ADDS a completion (onConflictDoNothing), so it is safe to re-run.
 */
export async function creditStatTilesForTeam(opts: {
  eventId: number;
  teamId: number;
  statTiles: StatTile[];
  /** Whose webhooks announce it — the pushing member's clan on a live push; the host otherwise. */
  notifyClanId?: number;
  /** False to complete without announcing. */
  notify?: boolean;
}): Promise<string[]> {
  const { eventId, teamId, statTiles } = opts;
  const completed: string[] = [];
  if (statTiles.length === 0) return completed;

  const teamPlayers = await db
    .select({
      id: eventParticipants.id,
      clanMemberId: eventParticipants.clanMemberId,
      statsSnapshot: eventParticipants.statsSnapshot,
      cachedStats: eventParticipants.cachedStats,
      frozenAt: eventParticipants.frozenAt,
      frozenStats: eventParticipants.frozenStats,
    })
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.teamId, teamId)));
  // Every team player's live overlay. Gain = sum over keys of max(0, max(hiscores, live) − baseline).
  const teamLive = await liveStatsForMembers(teamPlayers.map((p) => p.clanMemberId));
  const gainFor = (p: (typeof teamPlayers)[number], keys: string[], statType: string): number => {
    // Benched players are pinned to frozenStats (no live overlay) so their locked gain still counts
    // toward the team total but never climbs.
    if (p.frozenAt) return computeGainFromJson(p.statsSnapshot, p.frozenStats, {}, keys, statType);
    const plug = (p.clanMemberId != null && teamLive.get(p.clanMemberId)) || {};
    return computeGainFromJson(p.statsSnapshot, p.cachedStats, plug, keys, statType);
  };

  const tileIds = statTiles.map((t) => t.id);
  const existing = await db
    .select({ teamId: completions.teamId, tileId: completions.tileId })
    .from(completions)
    .where(and(inArray(completions.tileId, tileIds), eq(completions.teamId, teamId)));
  const done = new Set(existing.map((c) => c.tileId));
  // clan-scope: global -- the event id came from a participant row the caller already scoped.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });

  for (const tile of statTiles) {
    if (done.has(tile.id) || !tile.trackedStat || !tile.statType || !tile.statGoal) continue;
    // Event-rules gate: unrevealed/claimed tiles and lockout losses never credit, no matter what the
    // stats say. Also freezes the rule-adjusted award for the insert below.
    const gate = event ? await evaluateCompletionGate({ event, tile, teamId }) : null;
    if (gate && !gate.allowed) continue;
    const keys = statKeys(tile.trackedStat);
    // A MILESTONE tile asks whether someone crossed a lifetime threshold during the event, and is
    // always settled per member — a team's lifetime totals summed together are meaningless (see
    // lib/statTracking.milestoneState). So it behaves like an individual tile whatever the tracking
    // mode says, and the finisher is whoever became eligible and reached it.
    const milestone = isMilestoneBasis(tile.statBasis);
    const msFor = (p: (typeof teamPlayers)[number]) =>
      p.frozenAt
        ? milestoneStateFromJson(p.statsSnapshot, p.frozenStats, {}, keys, tile.statType!, tile.statGoal!)
        : milestoneStateFromJson(
            p.statsSnapshot,
            p.cachedStats,
            (p.clanMemberId != null && teamLive.get(p.clanMemberId)) || {},
            keys,
            tile.statType!,
            tile.statGoal!,
          );

    const individual = milestone || isIndividualMode(tile.trackingMode);
    // For an individual tile, the finisher is the player who reached the goal alone (attributed so the
    // activity feed can name them — a stat completion has no submission). Team tiles have no one player.
    const individualFinisher = milestone
      ? teamPlayers.find((p) => msFor(p).reached)
      : individual
        ? teamPlayers.find((p) => gainFor(p, keys, tile.statType!) >= tile.statGoal!)
        : undefined;
    const meets = individual
      ? individualFinisher != null
      : teamPlayers.reduce((sum, p) => sum + gainFor(p, keys, tile.statType!), 0) >= tile.statGoal!;
    if (!meets) continue;

    // Freeze the per-member split at completion: the lone finisher for individual tiles, or every
    // contributing team member's current gain for team tiles. Locks "who got what %" against the
    // stat continuing to climb after the tile is done.
    const splitRows = milestone
      ? [{ playerId: individualFinisher!.id, gained: msFor(individualFinisher!).lifetime }]
      : individual
        ? [{ playerId: individualFinisher!.id, gained: gainFor(individualFinisher!, keys, tile.statType!) }]
        : teamPlayers.map((p) => ({ playerId: p.id, gained: gainFor(p, keys, tile.statType!) }));

    // Notify only on a genuine insert — the sweep + a push can both cross a threshold and would
    // otherwise double-ping Discord.
    const inserted = await db
      .insert(completions)
      .values({
        teamId,
        tileId: tile.id,
        creditPlayerId: individualFinisher?.id ?? null,
        statContributions: JSON.stringify(buildContributionSnapshot(tile.statGoal!, splitRows)),
        awardedPoints: gate?.awardedPoints ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: completions.id });
    if (inserted.length === 0) continue;
    if (gate?.bounty) handleBountyClaim(eventId, tile.id).catch(() => {});
    done.add(tile.id);
    completed.push(tile.label);
    if (opts.notify !== false && event && team) {
      notifyTileCompletion({
        clanId: opts.notifyClanId ?? event.clanId,
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
      }).catch(() => {});
    }
  }
  return completed;
}

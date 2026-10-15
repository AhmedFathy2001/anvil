import { db } from '@/db';
import { clanRoster, completions, eventParticipants, events, statTileProgress, teams, tiles } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { statKeys } from '@/lib/tileKinds';
import { computeGainFromJson, isIndividualMode, isMilestoneBasis, milestoneStateFromJson, buildContributionSnapshot } from '@/lib/statTracking';
import { liveStatsForMembers, parseStatKeyTimes } from '@/lib/liveStats';
import { advanceLedger, parseLedger, settleOvershoot, tiedWith, type Ledger, type Observation } from '@/lib/overshoot';
import { parseStamp } from '@/lib/dbTime';
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
 *
 * Every check also records, per open team tile, each member's gain and the window their latest
 * increase happened in (stat_tile_progress, lib/overshoot) — so the check that completes a tile can
 * cap its split at the goal in the order the gains happened: the kills past the goal come off whoever
 * crossed the line, or off everyone whose window overlaps theirs when nobody can say who was first.
 */
export async function creditStatTilesForTeam(opts: {
  eventId: number;
  teamId: number;
  statTiles: StatTile[];
  /** Whose webhooks announce it — the pushing member's clan on a live push; the host otherwise. */
  notifyClanId?: number;
  /** False to complete without announcing. */
  notify?: boolean;
  /** Told about each tile this call completed (the sweep keeps its own tally). */
  onCompleted?: (tile: StatTile) => void;
}): Promise<string[]> {
  const { eventId, teamId, statTiles } = opts;
  const completed: string[] = [];
  if (statTiles.length === 0) return completed;

  const teamPlayers = await db
    .select({
      id: eventParticipants.id,
      name: eventParticipants.name,
      clanMemberId: eventParticipants.clanMemberId,
      statsSnapshot: eventParticipants.statsSnapshot,
      cachedStats: eventParticipants.cachedStats,
      frozenAt: eventParticipants.frozenAt,
      frozenStats: eventParticipants.frozenStats,
      lastStatsFetch: eventParticipants.lastStatsFetch,
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

  // When each member's reading of each key is from: their hiscores fetch, or a push that raised it.
  const memberIds = teamPlayers.map((p) => p.clanMemberId).filter((id): id is number => id != null);
  const keyTimesByMember = new Map<number, Record<string, string>>();
  if (memberIds.length > 0) {
    // clan-scope: global -- seats of this team's own event rows, read by id.
    const rows = await db
      .select({ id: clanRoster.id, keyTimes: clanRoster.liveStatKeyTimes })
      .from(clanRoster)
      .where(inArray(clanRoster.id, memberIds));
    for (const r of rows) keyTimesByMember.set(r.id, parseStatKeyTimes(r.keyTimes));
  }
  const freshAt = (p: (typeof teamPlayers)[number], keys: string[]): number => {
    if (p.frozenAt) return parseStamp(p.frozenAt) ?? 0;
    const times = (p.clanMemberId != null && keyTimesByMember.get(p.clanMemberId)) || {};
    return Math.max(parseStamp(p.lastStatsFetch) ?? 0, ...keys.map((k) => parseStamp(times[k]) ?? 0));
  };

  const nameOf = new Map(teamPlayers.map((p) => [p.id, p.name]));
  const tileIds = statTiles.map((t) => t.id);
  const ledgerRows = await db
    .select({ tileId: statTileProgress.tileId, data: statTileProgress.data })
    .from(statTileProgress)
    .where(and(eq(statTileProgress.teamId, teamId), inArray(statTileProgress.tileId, tileIds)));
  const ledgers = new Map(ledgerRows.map((r) => [r.tileId, { raw: r.data, ledger: parseLedger(r.data) }]));
  const existing = await db
    .select({ teamId: completions.teamId, tileId: completions.tileId })
    .from(completions)
    .where(and(inArray(completions.tileId, tileIds), eq(completions.teamId, teamId)));
  const done = new Set(existing.map((c) => c.tileId));
  // clan-scope: global -- the event id came from a participant row the caller already scoped.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  const eventStartMs = parseStamp(event?.startDate) ?? 0;
  const nowIso = new Date().toISOString();

  for (const tile of statTiles) {
    if (done.has(tile.id) || !tile.trackedStat || !tile.statType || !tile.statGoal) continue;
    // Event-rules gate: unrevealed/claimed tiles and lockout losses never credit, no matter what the
    // stats say. Also freezes the rule-adjusted award for the insert below.
    const gate = event ? await evaluateCompletionGate({ event, tile, teamId }) : null;
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

    // Team tiles: fold this check into the tile's ledger, whatever it decides.
    let ledger: Ledger | null = null;
    let risen: number[] = [];
    if (!individual) {
      const obs: Observation[] = teamPlayers.map((p) => ({
        playerId: p.id,
        gained: gainFor(p, keys, tile.statType!),
        freshAt: freshAt(p, keys),
      }));
      ({ next: ledger, risen } = advanceLedger(ledgers.get(tile.id)?.ledger ?? {}, obs, eventStartMs));
    }
    const saveLedger = async () => {
      if (!ledger) return;
      const data = JSON.stringify(ledger);
      if (data === ledgers.get(tile.id)?.raw) return;
      await db
        .insert(statTileProgress)
        .values({ teamId, tileId: tile.id, data, updatedAt: nowIso })
        .onConflictDoUpdate({ target: [statTileProgress.teamId, statTileProgress.tileId], set: { data, updatedAt: nowIso } });
    };
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
    if (!meets || (gate && !gate.allowed)) {
      await saveLedger();
      continue;
    }

    // Freeze the per-member split at completion: the lone finisher for individual tiles, or every
    // contributing team member's current gain for team tiles. Locks "who got what %" against the
    // stat continuing to climb after the tile is done.
    const splitRows = milestone
      ? [{ playerId: individualFinisher!.id, gained: msFor(individualFinisher!).lifetime }]
      : individual
        ? [{ playerId: individualFinisher!.id, gained: gainFor(individualFinisher!, keys, tile.statType!) }]
        : settleTeamSplit(tile.statGoal!, ledger!, risen);

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
    // Done either way (ours or a racing check's) — the ledger has nothing left to order.
    if (ledger) await db.delete(statTileProgress).where(and(eq(statTileProgress.teamId, teamId), eq(statTileProgress.tileId, tile.id)));
    if (inserted.length === 0) continue;
    if (gate?.bounty) handleBountyClaim(eventId, tile.id).catch(() => {});
    done.add(tile.id);
    completed.push(tile.label);
    opts.onCompleted?.(tile);
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
        // The one whose update crossed the line: the lone finisher of a solo tile, or the single
        // member who rose in the check that completed a team tile (several at once → nobody named).
        finisher: individualFinisher?.name ?? (risen.length === 1 ? nameOf.get(risen[0]) ?? null : null),
        contributors: splitRows
          .filter((r) => r.gained > 0 && nameOf.has(r.playerId))
          .sort((a, b) => b.gained - a.gained)
          .map((r) => ({ name: nameOf.get(r.playerId)!, amount: r.gained })),
      }).catch(() => {});
    }
  }
  return completed;
}

/**
 * A team tile's split at completion, capped at the goal in the order the gains happened: the overshoot
 * comes off the members whose latest increase can't be ordered against the update(s) that crossed the
 * line (lib/overshoot). With no earlier check on record every member is new, so everyone is tied and it
 * scales — the honest answer when nothing says who was first.
 */
function settleTeamSplit(goal: number, ledger: Ledger, crossers: number[]): { playerId: number; gained: number }[] {
  const tied = tiedWith(ledger, crossers);
  return settleOvershoot(
    goal,
    Object.entries(ledger).map(([id, e]) => ({
      playerId: Number(id),
      gained: e.g,
      increase: e.g - e.base,
      tied: tied.has(Number(id)),
    })),
  );
}

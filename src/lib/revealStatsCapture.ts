import { db } from '@/db';
import { eventParticipants, events, statTileProgress, tiles } from '@/db/schema';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { statKeys } from '@/lib/tileKinds';
import { computeGainFromJson, effectiveValue, jsonStatValue } from '@/lib/statTracking';
import { liveStatsForMembers } from '@/lib/liveStats';
import { eventHasStarted } from '@/lib/completionGate';
import type { RevealStats } from '@/lib/revealStats';
import { log } from '@/lib/logger';

/**
 * Capture where every player stands on each just-announced mission's stat (lib/revealStats), so the
 * mission counts only what happens after the announce. Call it right after stamping `revealedAt`.
 *
 * Reads the same inputs the scorers do — hiscores plus the live plugin overlay — so the captured
 * standing and every later gain are measured on one scale. Only fills tiles that have none yet (an
 * un-announce clears it), and skips an event that hasn't started: its baselines ARE the starting line.
 * Best-effort: a failure here must never undo the announce, so it logs and returns.
 */
export async function captureRevealStats(tileIds: number[]): Promise<void> {
  if (tileIds.length === 0) return;
  try {
    const statTiles = await db
      .select({ id: tiles.id, eventId: tiles.eventId, trackedStat: tiles.trackedStat, statType: tiles.statType })
      .from(tiles)
      .where(
        and(
          inArray(tiles.id, tileIds),
          eq(tiles.mission, 1),
          isNotNull(tiles.trackedStat),
          isNotNull(tiles.statType),
          isNotNull(tiles.revealedAt),
          isNull(tiles.revealStats),
        ),
      );
    if (statTiles.length === 0) return;

    for (const eventId of new Set(statTiles.map((t) => t.eventId))) {
      // clan-scope: global -- the event id came from tile rows the caller already scoped.
      const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
      if (!event || !eventHasStarted(event)) continue;
      const players = await db
        .select({
          id: eventParticipants.id,
          clanMemberId: eventParticipants.clanMemberId,
          statsSnapshot: eventParticipants.statsSnapshot,
          cachedStats: eventParticipants.cachedStats,
          frozenAt: eventParticipants.frozenAt,
          frozenStats: eventParticipants.frozenStats,
        })
        .from(eventParticipants)
        .where(eq(eventParticipants.eventId, eventId));
      const live = await liveStatsForMembers(players.map((p) => p.clanMemberId));

      for (const tile of statTiles.filter((t) => t.eventId === eventId)) {
        const keys = statKeys(tile.trackedStat);
        const stats: RevealStats = {};
        for (const p of players) {
          // Benched players read their frozen stats with no overlay, exactly as the scorers do.
          const current = p.frozenAt ? p.frozenStats : p.cachedStats;
          const plug = p.frozenAt ? {} : (p.clanMemberId != null && live.get(p.clanMemberId)) || {};
          stats[p.id] = {
            g: computeGainFromJson(p.statsSnapshot, current, plug, keys, tile.statType!),
            l: keys.reduce((sum, k) => sum + effectiveValue(jsonStatValue(current, tile.statType!, k), plug, k), 0),
          };
        }
        await db
          .update(tiles)
          .set({ revealStats: JSON.stringify(stats) })
          .where(and(eq(tiles.id, tile.id), isNull(tiles.revealStats)));
        // Any progress ledger recorded before the announce measured gains from the event start; the
        // overshoot split (lib/overshoot) must start over on the new scale.
        await db.delete(statTileProgress).where(eq(statTileProgress.tileId, tile.id));
      }
    }
  } catch (error) {
    log.warn('reveal-stats.capture-fail', { tileIds }, error);
  }
}

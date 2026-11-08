import { db } from '@/db';
import { eventParticipants, events, statTileProgress, tiles } from '@/db/schema';
import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { statKeys } from '@/lib/tileKinds';
import { computeGainFromJson, effectiveValue, jsonStatValue } from '@/lib/statTracking';
import { liveStatsForMembers } from '@/lib/liveStats';
import { eventHasStarted } from '@/lib/completionGate';
import type { RevealStats } from '@/lib/revealStats';
import { log } from '@/lib/logger';
import { parseEventRules } from '@/lib/eventRules';
import { countedModes, statGainWithModes } from '@/lib/modeStats';

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
          modeStats: eventParticipants.modeStats,
        })
        .from(eventParticipants)
        .where(eq(eventParticipants.eventId, eventId));
      const live = await liveStatsForMembers(players.map((p) => p.clanMemberId));
      // Measured on the scorers' scale, game modes the board counts included (lib/modeStats).
      const modes = countedModes(parseEventRules(event.rules));

      for (const tile of statTiles.filter((t) => t.eventId === eventId)) {
        const keys = statKeys(tile.trackedStat);
        const stats: RevealStats = {};
        for (const p of players) {
          // Benched players read their frozen stats with no overlay, exactly as the scorers do.
          const current = p.frozenAt ? p.frozenStats : p.cachedStats;
          const plug = p.frozenAt ? {} : (p.clanMemberId != null && live.get(p.clanMemberId)) || {};
          stats[p.id] = {
            g: p.frozenAt
              ? computeGainFromJson(p.statsSnapshot, current, plug, keys, tile.statType!)
              : statGainWithModes(p.statsSnapshot, current, plug, keys, tile.statType!, p.modeStats, modes),
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

/**
 * TILE RACES COUNT FROM WHEN A TILE OPENS FOR THE TEAM (lib/raceRoutes). The same capture as a
 * mission's announce, but per team: a race tile opens for each team at its own moment, so this
 * fills in only that team's players, keeping every entry already there (another team's, or this
 * team's from an earlier open). Merged in SQL so two teams opening the same tile at once don't
 * clobber each other. Unlike missions it runs before the start too — a step-0 tile needs none
 * (no entry = counts from the event start), and later steps only open once the race is on.
 * Best-effort like captureRevealStats; the completion gate refuses a race stat tile whose team has
 * no entry yet and captures then, so a missed capture costs a tick, never a free credit.
 */
export async function captureRaceOpenStats(eventId: number, teamId: number, tileIds: number[]): Promise<number> {
  if (tileIds.length === 0) return 0;
  try {
    const statTiles = await db
      .select({ id: tiles.id, trackedStat: tiles.trackedStat, statType: tiles.statType, revealStats: tiles.revealStats })
      .from(tiles)
      .where(and(inArray(tiles.id, tileIds), eq(tiles.eventId, eventId), isNotNull(tiles.trackedStat), isNotNull(tiles.statType)));
    if (statTiles.length === 0) return 0;
    // clan-scope: global -- the event id came from tile rows the caller already scoped.
    const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
    if (!event) return 0;
    const players = await db
      .select({
        id: eventParticipants.id,
        clanMemberId: eventParticipants.clanMemberId,
        statsSnapshot: eventParticipants.statsSnapshot,
        cachedStats: eventParticipants.cachedStats,
        frozenAt: eventParticipants.frozenAt,
        frozenStats: eventParticipants.frozenStats,
        modeStats: eventParticipants.modeStats,
      })
      .from(eventParticipants)
      .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.teamId, teamId)));
    if (players.length === 0) return 0;
    const live = await liveStatsForMembers(players.map((p) => p.clanMemberId));
    const modes = countedModes(parseEventRules(event.rules));
    let captured = 0;
    for (const tile of statTiles) {
      const have = (tile.revealStats ? (JSON.parse(tile.revealStats) as RevealStats) : {}) ?? {};
      const missing = players.filter((p) => have[p.id] == null);
      if (!missing.length) continue;
      const keys = statKeys(tile.trackedStat);
      const stats: RevealStats = {};
      for (const p of missing) {
        const current = p.frozenAt ? p.frozenStats : p.cachedStats;
        const plug = p.frozenAt ? {} : (p.clanMemberId != null && live.get(p.clanMemberId)) || {};
        stats[p.id] = {
          g: p.frozenAt
            ? computeGainFromJson(p.statsSnapshot, current, plug, keys, tile.statType!)
            : statGainWithModes(p.statsSnapshot, current, plug, keys, tile.statType!, p.modeStats, modes),
          l: keys.reduce((sum, k) => sum + effectiveValue(jsonStatValue(current, tile.statType!, k), plug, k), 0),
        };
      }
      // New entries on the LEFT so anything already stored wins (`||` keeps the right-hand value).
      await db
        .update(tiles)
        .set({ revealStats: sql`(${JSON.stringify(stats)}::jsonb || COALESCE(${tiles.revealStats}, '{}')::jsonb)::text` })
        .where(eq(tiles.id, tile.id));
      // This team's progress ledger measured from the event start; the overshoot split starts over.
      await db.delete(statTileProgress).where(and(eq(statTileProgress.tileId, tile.id), eq(statTileProgress.teamId, teamId)));
      captured++;
    }
    return captured;
  } catch (error) {
    log.warn('reveal-stats.race-capture-fail', { eventId, teamId, tileIds }, error);
    return 0;
  }
}

/** Forget a team's race baselines on these tiles (a rolled-back step locks them again). */
export async function clearRaceOpenStats(eventId: number, teamId: number, tileIds: number[]): Promise<void> {
  if (tileIds.length === 0) return;
  const ids = (await db.select({ id: eventParticipants.id }).from(eventParticipants).where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.teamId, teamId)))).map((p) => String(p.id));
  if (!ids.length) return;
  await db
    .update(tiles)
    .set({ revealStats: sql`NULLIF((COALESCE(${tiles.revealStats}, '{}')::jsonb ${sql.join(ids.map((id) => sql`- ${id}::text`), sql` `)})::text, '{}')` })
    .where(and(inArray(tiles.id, tileIds), isNotNull(tiles.revealStats)));
}

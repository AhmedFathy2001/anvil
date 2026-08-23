import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { eventParticipants, tiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { statKeys } from '@/lib/tileKinds';
import { computeGain, effectiveValue, snapshotValue } from '@/lib/statTracking';
import { liveStatsForMembers } from '@/lib/liveStats';
import type { HiscoresSnapshot } from '@/lib/hiscores';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { searchParams } = new URL(request.url);
  const teamIdFilter = searchParams.get('teamId');

  // Get all tiles with tracked stats for this event
  const eventTiles = await db.query.tiles.findMany({
    where: eq(tiles.eventId, eId),
  });

  const trackedStats = eventTiles
    .filter((t) => t.trackedStat && t.statType)
    .map((t) => ({ key: t.trackedStat!, type: t.statType! }));

  // Deduplicate tracked stats
  const uniqueStats = Array.from(
    new Map(trackedStats.map((s) => [s.key, s])).values()
  );

  if (uniqueStats.length === 0) {
    return NextResponse.json([]);
  }

  let eventPlayers = await db.query.eventParticipants.findMany({
    where: eq(eventParticipants.eventId, eId),
  });

  if (teamIdFilter) {
    eventPlayers = eventPlayers.filter((p) => p.teamId === parseInt(teamIdFilter, 10));
  }

  // Real-time plugin overlay, keyed by clan member (shared with weekly). Effective current =
  // max(hiscores, live) so a tile reflects a fresh kill / training burst before the sweep catches up.
  const memberLive = await liveStatsForMembers(eventPlayers.map((p) => p.clanMemberId));

  const result: {
    playerId: number;
    playerName: string;
    teamId: number | null;
    gains: Record<string, number>;
    current: Record<string, number>;
    /** Value at event start — milestone tiles gate eligibility on it (baseline < goal). */
    baseline: Record<string, number>;
    lastFetch: string | null;
    error?: string;
  }[] = [];

  for (const player of eventPlayers) {
    if (!player.statsSnapshot) {
      result.push({
        playerId: player.id,
        playerName: player.name,
        teamId: player.teamId,
        gains: {},
        current: {},
      baseline: {},
        lastFetch: player.lastStatsFetch,
        error: 'No snapshot',
      });
      continue;
    }

    let snapshot: HiscoresSnapshot;
    try {
      snapshot = JSON.parse(player.statsSnapshot);
    } catch {
      result.push({
        playerId: player.id,
        playerName: player.name,
        teamId: player.teamId,
        gains: {},
        current: {},
      baseline: {},
        lastFetch: player.lastStatsFetch,
        error: 'Invalid snapshot',
      });
      continue;
    }

    // Benched (sub-out) player: pin to the frozen snapshot with no live overlay, so their gain stays
    // locked at the sub moment everywhere it's displayed.
    const currentJson = player.frozenAt ? player.frozenStats : player.cachedStats;
    const frozenView = !!player.frozenAt;

    // Use cached stats if available
    if (currentJson) {
      try {
        const currentStats = JSON.parse(currentJson) as HiscoresSnapshot;
        const pluginMap = frozenView
          ? {}
          : (player.clanMemberId != null && memberLive.get(player.clanMemberId)) || {};

        // gains keyed by the composite trackedStat so clients keep indexing by tile.trackedStat.
        const gains: Record<string, number> = {};
        const current: Record<string, number> = {};
        // What they had when the event started. MILESTONE tiles need it: a member is eligible for one
        // only while their baseline is below the goal (lib/statTracking.milestoneState), and the goal
        // lives on the tile rather than here — so the caller pairs this with its own goal instead of
        // this route guessing which tile a stat belongs to.
        const baseline: Record<string, number> = {};
        for (const { key, type } of uniqueStats) {
          const keys = statKeys(key);
          gains[key] = computeGain(snapshot, currentStats, pluginMap, keys, type);
          current[key] = keys.reduce(
            (sum, part) => sum + effectiveValue(snapshotValue(currentStats, type, part), pluginMap, part),
            0,
          );
          baseline[key] = keys.reduce((sum, part) => sum + snapshotValue(snapshot, type, part), 0);
        }

        result.push({
          playerId: player.id,
          playerName: player.name,
          teamId: player.teamId,
          gains,
          current,
          baseline,
          lastFetch: player.lastStatsFetch,
        });
      } catch {
        result.push({
          playerId: player.id,
          playerName: player.name,
          teamId: player.teamId,
          gains: {},
          current: {},
          baseline: {},
          lastFetch: player.lastStatsFetch,
          error: 'Invalid cached stats',
        });
      }
    } else {
      result.push({
        playerId: player.id,
        playerName: player.name,
        teamId: player.teamId,
        gains: {},
        current: {},
      baseline: {},
        lastFetch: null,
        error: 'Not fetched yet',
      });
    }
  }

  return NextResponse.json(result);
}

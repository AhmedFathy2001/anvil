import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, tiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface Snapshot {
  skills: Record<string, { rank: number; level: number; xp: number }>;
  bosses: Record<string, { rank: number; score: number }>;
}

function computeGains(
  snapshot: Snapshot,
  current: Snapshot,
  trackedStats: { key: string; type: string }[]
): Record<string, number> {
  const gains: Record<string, number> = {};

  for (const { key, type } of trackedStats) {
    if (type === 'skill') {
      const snapshotXp = snapshot.skills?.[key]?.xp ?? 0;
      const currentXp = current.skills?.[key]?.xp ?? 0;
      gains[key] = Math.max(0, currentXp - snapshotXp);
    } else if (type === 'boss') {
      const snapshotKc = snapshot.bosses?.[key]?.score ?? 0;
      const currentKc = current.bosses?.[key]?.score ?? 0;
      const sKc = snapshotKc < 0 ? 0 : snapshotKc;
      const cKc = currentKc < 0 ? 0 : currentKc;
      gains[key] = Math.max(0, cKc - sKc);
    }
  }

  return gains;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

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

  let eventPlayers = await db.query.players.findMany({
    where: eq(players.eventId, eId),
  });

  if (teamIdFilter) {
    eventPlayers = eventPlayers.filter((p) => p.teamId === parseInt(teamIdFilter, 10));
  }

  const result: {
    playerId: number;
    playerName: string;
    teamId: number | null;
    gains: Record<string, number>;
    current: Record<string, number>;
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
        lastFetch: player.lastStatsFetch,
        error: 'No snapshot',
      });
      continue;
    }

    let snapshot: Snapshot;
    try {
      snapshot = JSON.parse(player.statsSnapshot);
    } catch {
      result.push({
        playerId: player.id,
        playerName: player.name,
        teamId: player.teamId,
        gains: {},
        current: {},
        lastFetch: player.lastStatsFetch,
        error: 'Invalid snapshot',
      });
      continue;
    }

    // Use cached stats if available
    if (player.cachedStats) {
      try {
        const currentStats = JSON.parse(player.cachedStats) as Snapshot;
        const gains = computeGains(snapshot, currentStats, uniqueStats);

        const current: Record<string, number> = {};
        for (const { key, type } of uniqueStats) {
          if (type === 'skill') {
            current[key] = currentStats.skills?.[key]?.xp ?? 0;
          } else if (type === 'boss') {
            const kc = currentStats.bosses?.[key]?.score ?? 0;
            current[key] = kc < 0 ? 0 : kc;
          }
        }

        result.push({
          playerId: player.id,
          playerName: player.name,
          teamId: player.teamId,
          gains,
          current,
          lastFetch: player.lastStatsFetch,
        });
      } catch {
        result.push({
          playerId: player.id,
          playerName: player.name,
          teamId: player.teamId,
          gains: {},
          current: {},
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
        lastFetch: null,
        error: 'Not fetched yet',
      });
    }
  }

  return NextResponse.json(result);
}

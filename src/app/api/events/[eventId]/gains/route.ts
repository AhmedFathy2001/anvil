import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, tiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getStatsByGamemode } from 'osrs-json-hiscores';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Snapshot {
  skills: Record<string, { rank: number; level: number; xp: number }>;
  bosses: Record<string, { rank: number; score: number }>;
  clues?: Record<string, { rank: number; score: number }>;
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
      // -1 means unranked, treat as 0
      const sKc = snapshotKc < 0 ? 0 : snapshotKc;
      const cKc = currentKc < 0 ? 0 : currentKc;
      gains[key] = Math.max(0, cKc - sKc);
    }
  }

  return gains;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

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
    return NextResponse.json({ players: [] });
  }

  const eventPlayers = await db.query.players.findMany({
    where: eq(players.eventId, eId),
  });

  const result: {
    playerId: number;
    playerName: string;
    teamId: number | null;
    gains: Record<string, number>;
    current: Record<string, number>;
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
        error: 'Invalid snapshot',
      });
      continue;
    }

    try {
      const currentStats = await getStatsByGamemode(player.name) as Snapshot;
      const gains = computeGains(snapshot, currentStats, uniqueStats);

      // Build current values map
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
      });
    } catch {
      result.push({
        playerId: player.id,
        playerName: player.name,
        teamId: player.teamId,
        gains: {},
        current: {},
        error: 'Failed to fetch current stats',
      });
    }

    await delay(1200);
  }

  return NextResponse.json(result);
}

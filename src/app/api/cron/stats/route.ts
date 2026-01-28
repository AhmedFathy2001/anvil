import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, tiles, teams, completions, events } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getStatsByGamemode } from 'osrs-json-hiscores';
import { notifyTileCompletion } from '@/lib/discord';

// Vercel Cron protection - only allow requests from Vercel's cron system
const CRON_SECRET = process.env.CRON_SECRET;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Snapshot {
  skills: Record<string, { rank: number; level: number; xp: number }>;
  bosses: Record<string, { rank: number; score: number }>;
}

export async function GET(request: Request) {
  // Verify request is from Vercel Cron or has valid secret
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const authHeader = request.headers.get('authorization');
  const hasValidSecret = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (!isVercelCron && !hasValidSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: {
    eventId: number;
    eventName: string;
    playersChecked: number;
    tilesCompleted: { tileLabel: string; teamName: string; playerName: string }[];
    errors: string[];
  }[] = [];

  // Get all active events (with start date in the past and end date in the future or no end date)
  const allEvents = await db.select().from(events);
  const now = new Date().toISOString();

  const activeEvents = allEvents.filter((e) => {
    // Event has started
    if (e.startDate && e.startDate > now) return false;
    // Event hasn't ended
    if (e.endDate && e.endDate < now) return false;
    return true;
  });

  for (const event of activeEvents) {
    const eventResult = {
      eventId: event.id,
      eventName: event.name,
      playersChecked: 0,
      tilesCompleted: [] as { tileLabel: string; teamName: string; playerName: string }[],
      errors: [] as string[],
    };

    // Get stat-tracked tiles for this event
    const eventTiles = await db.query.tiles.findMany({
      where: eq(tiles.eventId, event.id),
    });

    const statTiles = eventTiles.filter((t) => t.trackedStat && t.statType && t.statGoal);
    if (statTiles.length === 0) {
      results.push(eventResult);
      continue;
    }

    // Get all teams for this event
    const eventTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, event.id),
    });
    const teamMap = new Map(eventTeams.map((t) => [t.id, t]));

    // Get existing completions
    const existingCompletions = await db.query.completions.findMany();
    const completionSet = new Set(
      existingCompletions.map((c) => `${c.teamId}-${c.tileId}`)
    );

    // Get all players with snapshots
    const eventPlayers = await db.query.players.findMany({
      where: eq(players.eventId, event.id),
    });

    // Track gains per team per tile for team-mode tiles
    const teamGains = new Map<string, number>(); // "teamId-tileId" -> total gained

    for (const player of eventPlayers) {
      if (!player.statsSnapshot || !player.teamId) continue;

      let snapshot: Snapshot;
      try {
        snapshot = JSON.parse(player.statsSnapshot);
      } catch {
        eventResult.errors.push(`Invalid snapshot for ${player.name}`);
        continue;
      }

      try {
        const currentStats = await getStatsByGamemode(player.name) as Snapshot;

        // Cache the stats
        await db.update(players)
          .set({
            cachedStats: JSON.stringify(currentStats),
            lastStatsFetch: new Date().toISOString(),
          })
          .where(eq(players.id, player.id));

        eventResult.playersChecked++;

        // Check each stat tile
        for (const tile of statTiles) {
          const key = `${player.teamId}-${tile.id}`;

          // Skip if already completed
          if (completionSet.has(key)) continue;

          let gained = 0;
          if (tile.statType === 'skill') {
            const snapshotXp = snapshot.skills?.[tile.trackedStat!]?.xp ?? 0;
            const currentXp = currentStats.skills?.[tile.trackedStat!]?.xp ?? 0;
            gained = Math.max(0, currentXp - snapshotXp);
          } else if (tile.statType === 'boss') {
            const snapshotKc = snapshot.bosses?.[tile.trackedStat!]?.score ?? 0;
            const currentKc = currentStats.bosses?.[tile.trackedStat!]?.score ?? 0;
            const sKc = snapshotKc < 0 ? 0 : snapshotKc;
            const cKc = currentKc < 0 ? 0 : currentKc;
            gained = Math.max(0, cKc - sKc);
          }

          if (tile.trackingMode === 'individual') {
            // Individual mode: any player meeting goal completes tile for team
            if (gained >= tile.statGoal!) {
              // Complete the tile
              await db.insert(completions).values({
                teamId: player.teamId,
                tileId: tile.id,
              }).onConflictDoNothing();

              completionSet.add(key);
              const team = teamMap.get(player.teamId);

              eventResult.tilesCompleted.push({
                tileLabel: tile.label,
                teamName: team?.name || 'Unknown',
                playerName: player.name,
              });

              // Send Discord notification
              if (team) {
                notifyTileCompletion({
                  eventName: event.name,
                  tileLabel: tile.label,
                  teamName: team.name,
                  teamColor: team.color,
                  tileType: tile.tileType,
                  trackedStat: tile.trackedStat,
                  statType: tile.statType,
                }).catch(() => {});
              }
            }
          } else {
            // Team mode: accumulate gains
            const teamKey = `${player.teamId}-${tile.id}`;
            const existing = teamGains.get(teamKey) || 0;
            teamGains.set(teamKey, existing + gained);
          }
        }

        await delay(1200);
      } catch (err) {
        eventResult.errors.push(`Failed to fetch stats for ${player.name}`);
      }
    }

    // Check team-mode tile completions
    for (const tile of statTiles) {
      if (tile.trackingMode !== 'team') continue;

      for (const team of eventTeams) {
        const key = `${team.id}-${tile.id}`;
        if (completionSet.has(key)) continue;

        const totalGained = teamGains.get(key) || 0;
        if (totalGained >= tile.statGoal!) {
          await db.insert(completions).values({
            teamId: team.id,
            tileId: tile.id,
          }).onConflictDoNothing();

          completionSet.add(key);

          eventResult.tilesCompleted.push({
            tileLabel: tile.label,
            teamName: team.name,
            playerName: '(team total)',
          });

          // Send Discord notification
          notifyTileCompletion({
            eventName: event.name,
            tileLabel: tile.label,
            teamName: team.name,
            teamColor: team.color,
            tileType: tile.tileType,
            trackedStat: tile.trackedStat,
            statType: tile.statType,
          }).catch(() => {});
        }
      }
    }

    results.push(eventResult);
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, tiles, teams, completions, events } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getStatsByGamemode } from 'osrs-json-hiscores';
import { notifyTileCompletion, notifyEventStart, notifyEventEnd, notifyTeamWin } from '@/lib/discord';

// Vercel Cron protection - only allow requests from Vercel's cron system
const CRON_SECRET = process.env.CRON_SECRET;

// Sequential hiscores polling per player — default Vercel function timeout (15 s on Pro,
// 10 s on Hobby) is way under what this loop needs. Bump to the Pro cap; Hobby clips to 60 s.
export const maxDuration = 300;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Snapshot {
  skills: Record<string, { rank: number; level: number; xp: number }>;
  bosses: Record<string, { rank: number; score: number }>;
}

export async function GET(request: Request) {
  // In production we require CRON_SECRET. The `x-vercel-cron` header alone isn't enough —
  // it's spoofable outside Vercel's edge, and forgetting the secret turns cron into a public endpoint.
  if (process.env.NODE_ENV === 'production' && !CRON_SECRET) {
    return NextResponse.json(
      { error: 'Server misconfigured: CRON_SECRET is required in production' },
      { status: 500 },
    );
  }
  const authHeader = request.headers.get('authorization');
  const hasValidSecret = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  // Dev only: allow the Vercel-cron header when no secret is configured, so local simulation works.
  const devBypass = !CRON_SECRET && request.headers.get('x-vercel-cron') === '1';
  if (!hasValidSecret && !devBypass) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: {
    eventId: number;
    eventName: string;
    playersChecked: number;
    playersSnapshotted: number;
    tilesCompleted: { tileLabel: string; teamName: string; playerName: string }[];
    errors: string[];
  }[] = [];

  // Get all events
  const allEvents = await db.select().from(events);
  const now = new Date().toISOString();

  // Check for events that just started (need start notification)
  for (const event of allEvents) {
    if (event.startDate && event.startDate <= now && !event.startNotified) {
      await notifyEventStart({
        eventName: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
      });
      await db.update(events)
        .set({ startNotified: 1 })
        .where(eq(events.id, event.id));
    }
  }

  // Check for events that just ended (need end notification)
  for (const event of allEvents) {
    if (event.endDate && event.endDate < now && !event.endNotified) {
      const eventTeams = await db.select().from(teams).where(eq(teams.eventId, event.id));
      const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, event.id));
      const eventTileIds = eventTiles.map(t => t.id);
      const eventCompletions = eventTileIds.length > 0
        ? await db.select().from(completions).where(inArray(completions.tileId, eventTileIds))
        : [];

      const pointsMode = event.scoringMode === 'points';
      const scoredTiles = eventTiles.filter(t => !t.optional);
      const weightById = new Map(scoredTiles.map(t => [t.id, pointsMode ? (t.points ?? 0) : 1]));
      const totalScore = scoredTiles.reduce((sum, t) => sum + (pointsMode ? (t.points ?? 0) : 1), 0);

      const standings = eventTeams.map(team => {
        const teamScore = eventCompletions
          .filter(c => c.teamId === team.id && weightById.has(c.tileId))
          .reduce((sum, c) => sum + (weightById.get(c.tileId) || 0), 0);
        return { teamName: team.name, tilesCompleted: teamScore };
      });

      await notifyEventEnd({
        eventName: event.name,
        standings,
        totalTiles: pointsMode ? totalScore : scoredTiles.length,
        unit: pointsMode ? 'pts' : 'tiles',
      });
      await db.update(events)
        .set({ endNotified: 1 })
        .where(eq(events.id, event.id));
    }
  }

  // Filter to only active events for stat tracking
  const activeEvents = allEvents.filter((e) => {
    // Skip force-ended events
    if (e.forceEndedAt) return false;
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
      playersSnapshotted: 0,
      tilesCompleted: [] as { tileLabel: string; teamName: string; playerName: string }[],
      errors: [] as string[],
    };

    // Get all players for this event
    const eventPlayers = await db.query.players.findMany({
      where: eq(players.eventId, event.id),
    });

    // Auto-snapshot: Check if any players need snapshots (event started but no snapshot yet)
    const playersNeedingSnapshot = eventPlayers.filter(p => p.teamId && !p.statsSnapshot);

    for (const player of playersNeedingSnapshot) {
      try {
        const stats = await getStatsByGamemode(player.name) as Snapshot;
        const statsJson = JSON.stringify(stats);
        const timestamp = new Date().toISOString();
        await db.update(players)
          .set({
            statsSnapshot: statsJson,
            snapshotAt: timestamp,
            cachedStats: statsJson,
            lastStatsFetch: timestamp,
          })
          .where(eq(players.id, player.id));

        eventResult.playersSnapshotted++;
        await delay(1200);
      } catch {
        eventResult.errors.push(`Failed to snapshot ${player.name}`);
      }
    }

    // Re-fetch players after snapshotting
    const updatedPlayers = playersNeedingSnapshot.length > 0
      ? await db.query.players.findMany({ where: eq(players.eventId, event.id) })
      : eventPlayers;

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

    // Get existing completions for this event's tiles
    const eventTileIds = eventTiles.map(t => t.id);
    const existingCompletions = eventTileIds.length > 0
      ? await db.select().from(completions).where(inArray(completions.tileId, eventTileIds))
      : [];
    const completionSet = new Set(
      existingCompletions.map((c) => `${c.teamId}-${c.tileId}`)
    );

    // Track gains per team per tile for team-mode tiles
    const teamGains = new Map<string, number>(); // "teamId-tileId" -> total gained

    for (const player of updatedPlayers) {
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

    // Check if any team completed ALL required (non-optional) tiles (blackout/win)
    const requiredTiles = eventTiles.filter((t) => !t.optional);
    const requiredTileIds = new Set(requiredTiles.map((t) => t.id));
    const totalRequiredTiles = requiredTiles.length;

    for (const team of eventTeams) {
      // Only count completions of required tiles
      const teamCompletionCount = Array.from(completionSet).filter(key => {
        if (!key.startsWith(`${team.id}-`)) return false;
        const tileId = parseInt(key.split('-')[1], 10);
        return requiredTileIds.has(tileId);
      }).length;

      if (teamCompletionCount >= totalRequiredTiles && totalRequiredTiles > 0) {
        // Check if we already notified for this team's win (check if they had all tiles before this run)
        // We do this by checking if any tile was completed in this run for this team
        const justCompletedTile = eventResult.tilesCompleted.some(tc => tc.teamName === team.name);
        if (justCompletedTile) {
          notifyTeamWin({
            eventName: event.name,
            teamName: team.name,
            teamColor: team.color,
            totalTiles: totalRequiredTiles,
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

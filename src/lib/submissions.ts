import { db } from '@/db';
import { submissions, tiles, completions, teams, events } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { notifyTileCompletion, notifyTeamWin } from '@/lib/discord';

export async function syncDropTileCompletion(tileId: number, teamId: number) {
  // Get the tile to check requiredAmount
  const tile = await db.query.tiles.findFirst({
    where: eq(tiles.id, tileId),
  });

  if (!tile || tile.tileType !== 'drop' || !tile.requiredAmount) {
    return null;
  }

  // Sum submissions for this tile + team
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)` })
    .from(submissions)
    .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)));

  const totalAmount = result[0]?.total ?? 0;
  const isComplete = totalAmount >= tile.requiredAmount;

  // Check existing completion
  const existing = await db.query.completions.findFirst({
    where: and(eq(completions.teamId, teamId), eq(completions.tileId, tileId)),
  });

  if (isComplete && !existing) {
    // Auto-complete
    await db.insert(completions).values({ teamId, tileId });

    // Send Discord notification for drop tile completion
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    });
    const event = team ? await db.query.events.findFirst({
      where: eq(events.id, team.eventId),
    }) : null;

    if (team && event) {
      notifyTileCompletion({
        eventName: event.name,
        tileLabel: tile.label,
        teamName: team.name,
        teamColor: team.color,
        tileType: tile.tileType,
        trackedStat: tile.trackedStat,
        statType: tile.statType,
      }).catch(() => {}); // Silently ignore errors

      // Check for blackout win
      const eventTiles = await db.query.tiles.findMany({
        where: eq(tiles.eventId, event.id),
      });
      const teamCompletions = await db.query.completions.findMany({
        where: eq(completions.teamId, teamId),
      });
      const eventTileIds = new Set(eventTiles.map(t => t.id));
      const completedTileIds = new Set(teamCompletions.map(c => c.tileId).filter(id => eventTileIds.has(id)));

      if (completedTileIds.size === eventTiles.length && eventTiles.length > 0) {
        notifyTeamWin({
          eventName: event.name,
          teamName: team.name,
          teamColor: team.color,
          totalTiles: eventTiles.length,
        }).catch(() => {}); // Silently ignore errors
      }
    }
  } else if (!isComplete && existing) {
    // Revert completion
    await db.delete(completions).where(eq(completions.id, existing.id));
  }

  return { totalAmount, requiredAmount: tile.requiredAmount, isComplete };
}

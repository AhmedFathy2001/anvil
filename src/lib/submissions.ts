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

  const itemRequirements = tile.itemRequirements
    ? JSON.parse(tile.itemRequirements) as { itemId: number; name: string; requiredAmount: number }[]
    : null;

  let totalAmount: number;
  let isComplete: boolean;

  if (itemRequirements) {
    // Per-item mode: check each item individually
    const perItemTotals = await db
      .select({
        itemId: submissions.itemId,
        total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)`,
      })
      .from(submissions)
      .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)))
      .groupBy(submissions.itemId);

    const itemTotalMap = new Map(perItemTotals.map(r => [r.itemId, Number(r.total)]));
    totalAmount = perItemTotals.reduce((sum, r) => sum + Number(r.total), 0);
    isComplete = itemRequirements.every(req => (itemTotalMap.get(req.itemId) ?? 0) >= req.requiredAmount);
  } else {
    // Simple mode: existing behavior
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)` })
      .from(submissions)
      .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)));

    totalAmount = result[0]?.total ?? 0;
    isComplete = totalAmount >= tile.requiredAmount;
  }

  if (isComplete) {
    // Auto-complete — use onConflictDoNothing to avoid race condition
    const [inserted] = await db.insert(completions).values({ teamId, tileId })
      .onConflictDoNothing()
      .returning();

    // Only notify if we actually inserted (not a duplicate)
    if (inserted) {
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
        }).catch(() => {});

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
          }).catch(() => {});
        }
      }
    }
  } else {
    // Revert completion if it exists (idempotent DELETE)
    await db.delete(completions).where(
      and(eq(completions.teamId, teamId), eq(completions.tileId, tileId))
    );
  }

  return { totalAmount, requiredAmount: tile.requiredAmount, isComplete };
}

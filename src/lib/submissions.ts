import { db } from '@/db';
import { submissions, tiles, completions, teams, events } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { notifyTileCompletion, notifyTeamWin } from '@/lib/discord';

// Recompute a team's completion state for a submission-backed tile (drop / kill / timed)
// and insert or revert the `completions` row accordingly. Named for its original drop-only
// role; it now dispatches on tile_type. Stat (hiscores) tiles don't flow through here.
export async function syncDropTileCompletion(
  tileId: number,
  teamId: number,
  // When notifyCompletion is false the caller is folding the "tile completed" announcement into its
  // own submission message (one webhook request instead of two). The team-win post still fires.
  { notifyCompletion = true }: { notifyCompletion?: boolean } = {},
) {
  // Get the tile to check its completion criteria
  const tile = await db.query.tiles.findFirst({
    where: eq(tiles.id, tileId),
  });

  if (!tile) return null;

  let totalAmount: number;
  let isComplete: boolean;

  if (tile.tileType === 'timed') {
    // Timed clear: pass/fail. Complete when any submission's reported duration is at or
    // under the cap. No threshold configured → never auto-completes.
    if (tile.timeThresholdSeconds == null) return null;
    const fastest = await db
      .select({ best: sql<number | null>`MIN(${submissions.durationSeconds})` })
      .from(submissions)
      .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)));
    const best = fastest[0]?.best ?? null;
    totalAmount = best ?? 0;
    isComplete = best != null && best <= tile.timeThresholdSeconds;
  } else if (tile.tileType === 'value') {
    // Loot-value tiles: pass/fail on a single haul. A submission's `amount` carries the haul's
    // gp value; the tile completes when any one haul meets the threshold in requiredAmount.
    if (!tile.requiredAmount) return null;
    const richest = await db
      .select({ best: sql<number | null>`MAX(${submissions.amount})` })
      .from(submissions)
      .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)));
    const best = richest[0]?.best ?? null;
    totalAmount = best ?? 0;
    isComplete = best != null && best >= tile.requiredAmount;
  } else if (tile.tileType === 'kill' || tile.tileType === 'gain' || tile.tileType === 'deathless' || tile.tileType === 'diary' || tile.tileType === 'lms' || tile.tileType === 'valuetotal') {
    // Kill count / item gains / deathless runs / diary completions / LMS qualifying games /
    // aggregate loot value: accumulate the submitted amount toward the required amount,
    // exactly like a simple drop tile (no per-item breakdown). For 'valuetotal', amount is
    // each haul's gp and requiredAmount the total gp to collect. (LMS placement / deathless
    // gating happens plugin-side, like kill targeting.)
    if (!tile.requiredAmount) return null;
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)` })
      .from(submissions)
      .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)));
    totalAmount = result[0]?.total ?? 0;
    isComplete = totalAmount >= tile.requiredAmount;
  } else if (tile.tileType === 'drop' && tile.requiredAmount) {
    const itemRequirements = tile.itemRequirements
      ? JSON.parse(tile.itemRequirements) as { itemId: number; name: string; requiredAmount: number; group?: string | null }[]
      : null;

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
      // Grouped ("any full set") mode: requirements carrying a `group` name form sets that are
      // OR-ed — the tile completes when ONE set is fully collected (no mixing across sets).
      // Ungrouped requirements stay AND-ed on top, and a tile with no groups at all keeps the
      // classic all-of collection semantics.
      const met = (req: { itemId: number; requiredAmount: number }) =>
        (itemTotalMap.get(req.itemId) ?? 0) >= req.requiredAmount;
      const ungrouped = itemRequirements.filter((r) => !r.group?.trim());
      const groups = new Map<string, typeof itemRequirements>();
      for (const r of itemRequirements) {
        const g = r.group?.trim();
        if (!g) continue;
        const key = g.toLowerCase();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }
      const anySetDone = groups.size === 0 || [...groups.values()].some((set) => set.every(met));
      isComplete = ungrouped.every(met) && anySetDone;
    } else {
      // Simple mode: existing behavior
      const result = await db
        .select({ total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)` })
        .from(submissions)
        .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)));

      totalAmount = result[0]?.total ?? 0;
      isComplete = totalAmount >= tile.requiredAmount;
    }
  } else {
    return null;
  }

  // Tile race: a drop tile can't auto-complete until the team has finished every
  // earlier tile in the sequence. Until then we leave it pending so the ordered
  // track stays strict, exactly like manual completions in the completions route.
  let raceBlocked = false;
  if (isComplete) {
    const raceEvent = await db.query.events.findFirst({ where: eq(events.id, tile.eventId) });
    if (raceEvent?.format === 'tilerace') {
      const raceTiles = await db.query.tiles.findMany({ where: eq(tiles.eventId, tile.eventId) });
      const teamDone = await db.query.completions.findMany({ where: eq(completions.teamId, teamId) });
      const doneTileIds = new Set(teamDone.map((c) => c.tileId));
      raceBlocked = raceTiles.some((t) => t.position < tile.position && !doneTileIds.has(t.id));
    }
  }

  if (isComplete && !raceBlocked) {
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
        if (notifyCompletion) {
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
  } else if (!isComplete) {
    // Revert completion if it exists (idempotent DELETE). A race-blocked tile is
    // left untouched — its earlier-tile gate, not its own progress, is what's missing.
    await db.delete(completions).where(
      and(eq(completions.teamId, teamId), eq(completions.tileId, tileId))
    );
  }

  return { totalAmount, requiredAmount: tile.requiredAmount, isComplete: isComplete && !raceBlocked };
}

import { db } from '@/db';
import { submissions, tiles, completions, teams, events } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { notifyTileCompletion, notifyTeamWin } from '@/lib/discord';
import { parseTrialRankTile } from '@/lib/barracudaTrials';
import { evaluateCompletionGate } from '@/lib/completionGate';
import { handleBountyClaim, reopenBountyTileIfUnclaimed } from '@/lib/revealEngine';
import { countProgress } from '@/lib/countProgress';
import { evaluateCollection, type CollectionRequirement } from '@/lib/collectionSets';

/**
 * A team's progress on one submission-backed count tile, under that tile's tracking mode
 * (lib/countProgress owns the rule; this just feeds it the rows). Reads the attribution columns
 * rather than SUM-ing in SQL so the server and the board's client-side bars can't drift apart.
 */
export async function countTileProgress(
  tileId: number,
  teamId: number,
  trackingMode: string | null | undefined,
) {
  const rows = await db
    .select({
      playerId: submissions.playerId,
      creditPlayerId: submissions.creditPlayerId,
      amount: submissions.amount,
    })
    .from(submissions)
    .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)));
  return countProgress(rows, trackingMode);
}

// Recompute a team's completion state for a submission-backed tile (drop / kill / timed)
// and insert or revert the `completions` row accordingly. Named for its original drop-only
// role; it now dispatches on tile_type. Stat (hiscores) tiles don't flow through here.
export async function syncDropTileCompletion(
  tileId: number,
  teamId: number,
  // notifyCompletion=false: the caller folds the "tile completed" post into its own submission message
  // (one webhook, not two); the team-win post still fires. silent=true: suppress BOTH posts — for a bulk
  // maintenance recompute that heals already-full tiles, which shouldn't re-announce old completions.
  { notifyCompletion = true, silent = false }: { notifyCompletion?: boolean; silent?: boolean } = {},
) {
  // Get the tile to check its completion criteria
  const tile = await db.query.tiles.findFirst({
    where: eq(tiles.id, tileId),
  });

  if (!tile) return null;

  // Admin kill-switch: this tile is flagged manual, so the site must not auto-credit it. The
  // submission row itself was already stored by the caller (evidence is preserved) — we just
  // don't insert/revert a completion here. A captain/admin completes it via the completions
  // route instead. Bail before the delete branch so an existing manual completion is left intact.
  if (tile.autoTrackDisabled) return null;

  let totalAmount: number;
  let isComplete: boolean;
  // Solo ("any one member") count tiles: who reached the goal, and whether the ONLY thing keeping
  // the tile incomplete is that no single member got there alone. Both stay false/null for every
  // team-mode tile, which is every tile kind that doesn't expose the Team/Solo toggle.
  let finisherPlayerId: number | null = null;
  let soloShortfall = false;

  // Collection tiles (a SET of items via itemRequirements) complete when their sets are satisfied. Keyed on
  // the PRESENCE of itemRequirements — independent of tile.tileType and tile.requiredAmount — because older
  // / bulk-imported collections can carry a non-'drop' tileType or a stale requiredAmount, which made the
  // `tile.tileType === 'drop' && tile.requiredAmount` guard below skip them so a full set never completed
  // server-side (the clog masked it with a client-side full-set check).
  const itemRequirements = tile.itemRequirements
    ? (JSON.parse(tile.itemRequirements) as CollectionRequirement[])
    : null;

  if (itemRequirements && itemRequirements.length > 0) {
    const perItemTotals = await db
      .select({ itemId: submissions.itemId, total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)` })
      .from(submissions)
      .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)))
      .groupBy(submissions.itemId);
    const itemTotalMap = new Map(perItemTotals.map((r) => [r.itemId, Number(r.total)]));
    totalAmount = perItemTotals.reduce((sum, r) => sum + Number(r.total), 0);
    // Sets: how the tile's `group` tags combine is lib/collectionSets' call — OR-ed alternative sets
    // ('any', the default and what every legacy collection does) or AND-ed one-from-each-source
    // sets ('all'), with each group's own require count. Ungrouped items are always required.
    isComplete = evaluateCollection(
      itemRequirements.map((r) => ({ ...r, currentAmount: itemTotalMap.get(r.itemId) ?? 0 })),
      tile.groupMode,
    ).isComplete;
  } else if (tile.tileType === 'timed') {
    // Barracuda Trials rank tiles ("Gwenith Glide — Marlin"): the plugin only submits an EXACT rank
    // match, so the rank is the gate — complete on any submission, no time cap (each rank is its own
    // challenge, so a cap is meaningless). Normal timed tiles: pass/fail on duration ≤ cap; no
    // threshold configured (and not a rank tile) → never auto-completes.
    const rankTile = parseTrialRankTile(tile.timedActivity) != null;
    if (tile.timeThresholdSeconds == null && !rankTile) return null;
    const fastest = await db
      .select({ best: sql<number | null>`MIN(${submissions.durationSeconds})` })
      .from(submissions)
      .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)));
    const best = fastest[0]?.best ?? null;
    totalAmount = best ?? 0;
    isComplete = best != null && (rankTile || best <= tile.timeThresholdSeconds!);
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
  } else if (tile.tileType === 'kill' || tile.tileType === 'pvp' || tile.tileType === 'gain' || tile.tileType === 'deathless' || tile.tileType === 'diary' || tile.tileType === 'ca' || tile.tileType === 'lms' || tile.tileType === 'valuetotal') {
    // Kill count / PvP kills / item gains / deathless runs / diary or CA completions / LMS qualifying
    // games / aggregate loot value: accumulate the submitted amount toward the required amount,
    // exactly like a simple drop tile (no per-item breakdown). For 'valuetotal', amount is
    // each haul's gp and requiredAmount the total gp to collect. (LMS placement / deathless
    // gating happens plugin-side, like kill targeting.)
    if (!tile.requiredAmount) return null;
    const progress = await countTileProgress(tileId, teamId, tile.trackingMode);
    totalAmount = progress.current;
    finisherPlayerId = progress.finisherPlayerId;
    isComplete = totalAmount >= tile.requiredAmount;
    soloShortfall = !isComplete && progress.teamTotal >= tile.requiredAmount;
  } else if (tile.tileType === 'drop' && tile.requiredAmount) {
    // Simple drop pool (no per-item requirements — collections are handled by the branch above).
    // Drop tiles have no Team/Solo toggle in the editor, so this is always the team sum; it goes
    // through the same helper so there is one definition of progress rather than two.
    const progress = await countTileProgress(tileId, teamId, tile.trackingMode);
    totalAmount = progress.current;
    finisherPlayerId = progress.finisherPlayerId;
    isComplete = totalAmount >= tile.requiredAmount;
    soloShortfall = !isComplete && progress.teamTotal >= tile.requiredAmount;
  } else {
    return null;
  }

  // Tile race: a drop tile can't auto-complete until the team has finished every
  // earlier tile in the sequence. Until then we leave it pending so the ordered
  // track stays strict, exactly like manual completions in the completions route.
  let raceBlocked = false;
  let tileEvent: typeof events.$inferSelect | undefined;
  if (isComplete) {
    tileEvent = await db.query.events.findFirst({ where: eq(events.id, tile.eventId) });
    if (tileEvent?.format === 'tilerace') {
      const raceTiles = await db.query.tiles.findMany({ where: eq(tiles.eventId, tile.eventId) });
      const teamDone = await db.query.completions.findMany({ where: eq(completions.teamId, teamId) });
      const doneTileIds = new Set(teamDone.map((c) => c.tileId));
      raceBlocked = raceTiles.some((t) => t.position < tile.position && !doneTileIds.has(t.id));
    }
  }

  // Event-rules gate (lib/completionGate): unrevealed/claimed tiles and lockout losses stay
  // pending exactly like a race block — the evidence keeps accruing, the credit doesn't land.
  // Also freezes the rule-adjusted award (first bonus / decay) for the row we're about to insert.
  let ruleBlocked = false;
  let awardedPoints: number | null = null;
  let bountyEvent = false;
  if (isComplete && !raceBlocked && tileEvent) {
    const gate = await evaluateCompletionGate({ event: tileEvent, tile, teamId });
    ruleBlocked = !gate.allowed;
    awardedPoints = gate.awardedPoints;
    bountyEvent = gate.bounty;
  }

  if (isComplete && !raceBlocked && !ruleBlocked) {
    // Auto-complete — use onConflictDoNothing to avoid race condition. A Solo tile names its
    // finisher (the one member who reached the count alone) the way stat tiles do, so the activity
    // feed reads "Kayle completed 10 CoX raids" instead of attributing it to the team.
    const [inserted] = await db.insert(completions).values({ teamId, tileId, awardedPoints, creditPlayerId: finisherPlayerId })
      .onConflictDoNothing()
      .returning();

    // Only notify if we actually inserted (not a duplicate)
    if (inserted) {
      // Bounty rotation: close the claimed tile and draw the next one right away (the cron
      // tick is the backstop). Fire-and-forget — a draw hiccup must never fail the credit.
      if (bountyEvent) handleBountyClaim(tile.eventId, tileId).catch(() => {});

      const team = await db.query.teams.findFirst({
        where: eq(teams.id, teamId),
      });
      const event = team ? await db.query.events.findFirst({
        where: eq(events.id, team.eventId),
      }) : null;

      if (team && event) {
        if (notifyCompletion && !silent) {
          notifyTileCompletion({
            eventName: event.name,
            tileLabel: tile.label,
            teamName: team.name,
            teamColor: team.color,
            tileType: tile.tileType,
            trackedStat: tile.trackedStat,
            statType: tile.statType,
            eventId: event.id,
            tile,
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

        if (!silent && completedTileIds.size === eventTiles.length && eventTiles.length > 0) {
          notifyTeamWin({
            eventName: event.name,
            teamName: team.name,
            teamColor: team.color,
            totalTiles: eventTiles.length,
            eventId: event.id,
          }).catch(() => {});
        }
      }
    }
  } else if (!isComplete && !soloShortfall) {
    // Revert completion if it exists (idempotent DELETE). A race-blocked tile is
    // left untouched — its earlier-tile gate, not its own progress, is what's missing.
    //
    // `soloShortfall` is the grandfather clause for enforcing Solo mode on submission tiles: the
    // team has the count but no single member does, which is exactly the state a board sat in
    // while the Solo setting was inert. Those tiles were already credited under the old (team-sum)
    // reading, so we leave the existing completion alone rather than yanking a finished tile out
    // from under a live board. Nothing here can CREATE a completion, so going forward the stricter
    // rule is what decides; only the historical credit is protected.
    const removed = await db.delete(completions).where(
      and(eq(completions.teamId, teamId), eq(completions.tileId, tileId))
    ).returning({ id: completions.id });
    // Bounty events: if that was the claiming completion (e.g. its submissions were deleted),
    // reopen the tile so the bounty isn't silently lost. Fire-and-forget, like the claim hook.
    if (removed.length > 0) {
      reopenBountyTileIfUnclaimed(tile.eventId, tileId).catch(() => {});
    }
  }

  return { totalAmount, requiredAmount: tile.requiredAmount, isComplete: isComplete && !raceBlocked && !ruleBlocked };
}

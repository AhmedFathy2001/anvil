'use client';

import { useMemo } from 'react';
import type { Tile, Submission, ItemRequirementProgress } from '@/lib/types';
import { countProgress, isPrimaryCredit } from '@/lib/countProgress';
import { altProgress, altGoalProgressNote, parseAltGoal } from '@/lib/altGoal';

/** An either/or tile's alternative (lib/altGoal): its capped progress and the "or 37/100 searches" note. */
export interface AltGoalProgress {
  current: number;
  required: number;
  note: string;
}

interface DropProgress {
  current: number;
  required: number;
  /** Either/or tiles: the alternative's progress, shown next to the primary bar. */
  alt?: AltGoalProgress;
}

export function useDropProgress(tiles: Tile[], submissions: Submission[]) {
  return useMemo(() => {
    const dropProgress = new Map<number, DropProgress>();
    const perItemProgressMap = new Map<number, ItemRequirementProgress[]>();
    const altProgressMap = new Map<number, AltGoalProgress>();

    for (const tile of tiles) {
      // Count/aggregate tiles all sum submission `amount` toward `requiredAmount` (drop = item drops,
      // kill = NPC kills, lap = agility laps, gain = items gathered, diary/ca = completions,
      // deathless = runs, lms = games, value/valuetotal = gp — where the sum is a rough progress
      // indicator; single-haul completion is server-side on max). Only drops carry per-item
      // requirements; the rest sum a single amount.
      if (
        (tile.tileType === 'drop' || tile.tileType === 'kill' || tile.tileType === 'lap'
          || tile.tileType === 'pvp'
          || tile.tileType === 'gain' || tile.tileType === 'diary' || tile.tileType === 'ca'
          || tile.tileType === 'deathless' || tile.tileType === 'lms'
          || tile.tileType === 'value' || tile.tileType === 'valuetotal')
        && tile.requiredAmount
      ) {
        const tileSubs = submissions.filter((s) => s.tileId === tile.id && isPrimaryCredit(s));
        // Mode-aware (lib/countProgress — the same rule the server completes on): Team Total sums the
        // team, Solo shows the best single member's count, so the bar can't read 10/10 on a tile that
        // needs one member to get there alone.
        const { current } = countProgress(tileSubs, tile.trackingMode, tile.itemRequirements ? null : tile.countMode);
        dropProgress.set(tile.id, { current, required: tile.requiredAmount });

        if (tile.itemRequirements) {
          const reqs = JSON.parse(tile.itemRequirements) as { itemId: number; name: string; requiredAmount: number }[];
          perItemProgressMap.set(tile.id, reqs.map(req => ({
            ...req,
            currentAmount: tileSubs.filter(s => s.itemId === req.itemId).reduce((sum, s) => sum + s.amount, 0),
          })));
        }
      }
    }

    // Either/or tiles: the alternative's own progress, capped per member exactly as the server does.
    for (const tile of tiles) {
      const goal = parseAltGoal(tile.altGoal);
      if (!goal) continue;
      const rows = submissions.filter((s) => s.tileId === tile.id && !isPrimaryCredit(s));
      const { current } = altProgress(rows, goal, tile.trackingMode);
      const alt = { current, required: goal.amount, note: altGoalProgressNote(goal, current) };
      altProgressMap.set(tile.id, alt);
      const primary = dropProgress.get(tile.id);
      if (primary) dropProgress.set(tile.id, { ...primary, alt });
    }

    return { dropProgress, perItemProgressMap, altProgressMap };
  }, [tiles, submissions]);
}

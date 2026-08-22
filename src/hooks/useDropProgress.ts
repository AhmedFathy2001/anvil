'use client';

import { useMemo } from 'react';
import type { Tile, Submission, ItemRequirementProgress } from '@/lib/types';
import { countProgress } from '@/lib/countProgress';

interface DropProgress {
  current: number;
  required: number;
}

export function useDropProgress(tiles: Tile[], submissions: Submission[]) {
  return useMemo(() => {
    const dropProgress = new Map<number, DropProgress>();
    const perItemProgressMap = new Map<number, ItemRequirementProgress[]>();

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
        const tileSubs = submissions.filter((s) => s.tileId === tile.id);
        // Mode-aware (lib/countProgress — the same rule the server completes on): Team Total sums the
        // team, Solo shows the best single member's count, so the bar can't read 10/10 on a tile that
        // needs one member to get there alone.
        const { current } = countProgress(tileSubs, tile.trackingMode);
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

    return { dropProgress, perItemProgressMap };
  }, [tiles, submissions]);
}

'use client';

import { useMemo } from 'react';
import type { Tile, Submission, ItemRequirementProgress } from '@/lib/types';

interface DropProgress {
  current: number;
  required: number;
}

export function useDropProgress(tiles: Tile[], submissions: Submission[]) {
  return useMemo(() => {
    const dropProgress = new Map<number, DropProgress>();
    const perItemProgressMap = new Map<number, ItemRequirementProgress[]>();

    for (const tile of tiles) {
      if (tile.tileType === 'drop' && tile.requiredAmount) {
        const tileSubs = submissions.filter((s) => s.tileId === tile.id);
        const current = tileSubs.reduce((sum, s) => sum + s.amount, 0);
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

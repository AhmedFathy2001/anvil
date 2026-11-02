'use client';

import { useMemo } from 'react';
import type { Tile, Submission, ItemRequirementProgress } from '@/lib/types';
import { countProgress } from '@/lib/countProgress';
import { parseCapBy } from '@/lib/tileCaps';
import { comboProgressLine, comboView, type ComboView } from '@/lib/comboProgress';

interface DropProgress {
  current: number;
  required: number;
  /** A combo's own wording (lib/combo): "1 of 2" / "75%" on the cell, the open parts on hover. */
  text?: string;
  note?: string;
  /** A combo's full view — the detail modal lists its parts from it. */
  combo?: ComboView;
}

/** A completion as the board holds it — enough to tell which team finished which part. */
interface DoneRow {
  tileId: number;
  teamId?: number;
  creditPlayerId?: number | null;
}

/**
 * Per-tile count progress for ONE team's board. `completions` (that team's, or every team's with
 * `teamId` to pick theirs) lets a COMBO (lib/combo) read which of its parts are done.
 */
export function useDropProgress(tiles: Tile[], submissions: Submission[], completions?: DoneRow[], teamId?: number) {
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
          || tile.tileType === 'value' || tile.tileType === 'valuetotal'
          // Collection-log NEW SLOTS; a whole-page tile is read off members' logs server-side.
          || (tile.tileType === 'clog' && tile.countMode !== 'complete'))
        && tile.requiredAmount
      ) {
        // Every row: a capped counter's cap rows (lib/tileCaps) limit its count; countProgress only
        // ever adds the tile's own credits.
        const tileSubs = submissions.filter((s) => s.tileId === tile.id);
        // Mode-aware (lib/countProgress — the same rule the server completes on): Team Total sums the
        // team, Solo shows the best single member's count, so the bar can't read 10/10 on a tile that
        // needs one member to get there alone.
        const { current } = countProgress(
          tileSubs,
          tile.trackingMode,
          tile.tileType === 'clog' ? 'slots' : tile.itemRequirements ? null : tile.countMode,
          parseCapBy(tile.capBy),
        );
        dropProgress.set(tile.id, { current, required: tile.requiredAmount });

        if (tile.itemRequirements) {
          const reqs = JSON.parse(tile.itemRequirements) as { itemId: number; name: string; requiredAmount: number }[];
          perItemProgressMap.set(tile.id, reqs.map(req => ({
            ...req,
            currentAmount: tileSubs.filter(s => s.itemId === req.itemId && s.goal == null).reduce((sum, s) => sum + s.amount, 0),
          })));
        }
      }

      // COMBO (lib/combo): parts done against what the rule needs, or a mix's combined share.
      if (tile.tileType === 'combo' && tile.parts?.length) {
        const done = new Map(
          (completions ?? [])
            .filter((c) => teamId == null || c.teamId == null || c.teamId === teamId)
            .map((c) => [c.tileId, c.creditPlayerId ?? null] as const),
        );
        const view = comboView(tile, tile.parts, (id) => ({
          done: done.has(id),
          doneBy: done.get(id) ?? null,
          subs: submissions.filter((s) => s.tileId === id),
        }));
        dropProgress.set(tile.id, {
          current: view.done,
          required: view.needed,
          text: view.share != null ? view.summary : `${Math.min(view.done, view.needed)} of ${view.needed}`,
          note: comboProgressLine(view),
          combo: view,
        });
      }
    }

    return { dropProgress, perItemProgressMap };
  }, [tiles, submissions, completions, teamId]);
}

'use client';

import { useMemo, useState } from 'react';
import BingoBoard from './BingoBoard';
import TileRaceBoard from './TileRaceBoard';
import LeaguesBoard from './LeaguesBoard';
import BoardStatusTabs, { type StatusFilter, type TileStatus } from './BoardStatusTabs';
import { isTileRaceFormat } from '@/lib/utils';
import { deriveTileIcon } from '@/lib/tileIcons';

interface Tile {
  id: number;
  position: number;
  label: string;
  icon?: string | null;
  description?: string | null;
  tileType?: string;
  requiredAmount?: number | null;
  trackedStat?: string | null;
  statGoal?: number | null;
  statType?: string | null;
  optional?: number | null;
  points?: number | null;
  // Structured tracking config — used to derive a display icon when `icon` is unset
  // (the icon column is legacy; callers pass full API tiles so these ride along).
  trackedItemIds?: string | null;
  itemRequirements?: string | null;
  timedActivity?: string | null;
  targetNpcs?: string | null;
}

interface Completion {
  teamId: number;
  tileId: number;
}

interface Team {
  id: number;
  name: string;
  color: string;
}

interface EventBoardProps {
  /** Event format — 'tilerace' renders the linear track, anything else the grid. */
  format?: string | null;
  tiles: Tile[];
  boardSize: number;
  completions: Completion[];
  teams: Team[];
  activeTeamId?: number;
  interactive?: boolean;
  onTileClick?: (tileId: number) => void;
  dropProgress?: Map<number, { current: number; required: number }>;
  statProgress?: Map<number, { current: number; goal: number; statType?: string }>;
  expanded?: boolean;
  pointsMode?: boolean;
  /** When set, tiles outside this set are de-emphasised (grid/track) or hidden (list). */
  matchedTileIds?: Set<number> | null;
  /** Show the complete/incomplete/in-progress status filter (mirrors the plugin). Default on. */
  showStatusFilter?: boolean;
  /**
   * Tiles this viewer can see but members can't (staff looking at a reveal-policy board before its
   * tiles open). Marked rather than hidden — staff still need to configure them, but the board
   * should not read as "this is what everyone sees".
   */
  staffOnlyTileIds?: Set<number> | null;
}

/**
 * Renders the right board for an event's format. Drop-in replacement for BingoBoard —
 * pass the same props plus `format`. Keeps the format branch in one place so every
 * board surface (scoreboard, captain, player, admin) stays consistent.
 */
export default function EventBoard({
  format,
  boardSize,
  pointsMode,
  tiles,
  showStatusFilter = true,
  ...rest
}: EventBoardProps) {
  const { completions, activeTeamId, dropProgress, statProgress, matchedTileIds } = rest;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Per-tile completion status — mirrors the plugin's ClogTaskModel.statusOf: completed when the
  // (active team's) tile is claimed, else in-progress when any partial progress exists, else
  // not-started. Every surface already feeds EventBoard the completion + progress it needs, so this
  // one derivation gives every board the same status filter for free.
  const statusById = useMemo(() => {
    const completedSet = new Set(
      completions.filter((c) => (activeTeamId ? c.teamId === activeTeamId : true)).map((c) => c.tileId),
    );
    const m = new Map<number, TileStatus>();
    for (const t of tiles) {
      if (completedSet.has(t.id)) {
        m.set(t.id, 'completed');
      } else {
        const started = (dropProgress?.get(t.id)?.current ?? 0) > 0 || (statProgress?.get(t.id)?.current ?? 0) > 0;
        m.set(t.id, started ? 'in_progress' : 'not_started');
      }
    }
    return m;
  }, [tiles, completions, activeTeamId, dropProgress, statProgress]);

  const counts = useMemo(() => {
    let inProgress = 0;
    let notStarted = 0;
    let completed = 0;
    for (const s of statusById.values()) {
      if (s === 'completed') completed++;
      else if (s === 'in_progress') inProgress++;
      else notStarted++;
    }
    return { all: statusById.size, inProgress, notStarted, completed };
  }, [statusById]);

  // Fold the status filter into whatever text/category/tier filter the surface already applied.
  const combinedMatched = useMemo(() => {
    if (statusFilter === 'all') return matchedTileIds ?? null;
    const statusSet = new Set<number>();
    for (const [id, s] of statusById) if (s === statusFilter) statusSet.add(id);
    if (!matchedTileIds) return statusSet;
    return new Set([...statusSet].filter((id) => matchedTileIds.has(id)));
  }, [statusFilter, statusById, matchedTileIds]);

  // One derivation point for every board surface: tiles without an explicit icon get one
  // derived from their tracking config (item / skill / signature-reward / coins).
  const iconedTiles = tiles.map((t) => (t.icon ? t : { ...t, icon: deriveTileIcon(t) }));
  const boardRest = { ...rest, matchedTileIds: combinedMatched };

  const board = isTileRaceFormat(format) ? (
    <TileRaceBoard tiles={iconedTiles} {...boardRest} />
  ) : pointsMode ? (
    // Leagues-style (points scoring) renders as a task-list accordion, not a square grid —
    // so it isn't bound to a perfect-square tile count. The status map lets it sort
    // incomplete-first by default, like the plugin's collection-log list.
    <LeaguesBoard tiles={iconedTiles} {...boardRest} statusById={statusById} />
  ) : (
    <BingoBoard boardSize={boardSize} pointsMode={pointsMode} tiles={iconedTiles} {...boardRest} />
  );

  // Only worth showing once a board actually has some progress to sort by.
  const showTabs = showStatusFilter && tiles.length > 0 && (counts.completed > 0 || counts.inProgress > 0);
  if (!showTabs) return board;
  return (
    <div>
      <BoardStatusTabs value={statusFilter} onChange={setStatusFilter} counts={counts} />
      {board}
    </div>
  );
}

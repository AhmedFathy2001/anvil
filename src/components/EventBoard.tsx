'use client';

import BingoBoard from './BingoBoard';
import TileRaceBoard from './TileRaceBoard';
import LeaguesBoard from './LeaguesBoard';
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
}

/**
 * Renders the right board for an event's format. Drop-in replacement for BingoBoard —
 * pass the same props plus `format`. Keeps the format branch in one place so every
 * board surface (scoreboard, captain, player, admin) stays consistent.
 */
export default function EventBoard({ format, boardSize, pointsMode, tiles, ...rest }: EventBoardProps) {
  // One derivation point for every board surface: tiles without an explicit icon get one
  // derived from their tracking config (item / skill / signature-reward / coins).
  const iconedTiles = tiles.map((t) => (t.icon ? t : { ...t, icon: deriveTileIcon(t) }));
  if (isTileRaceFormat(format)) {
    return <TileRaceBoard tiles={iconedTiles} {...rest} />;
  }
  // Leagues-style (points scoring) renders as a task-list accordion, not a square grid —
  // so it isn't bound to a perfect-square tile count.
  if (pointsMode) {
    return <LeaguesBoard tiles={iconedTiles} {...rest} />;
  }
  return <BingoBoard boardSize={boardSize} pointsMode={pointsMode} tiles={iconedTiles} {...rest} />;
}

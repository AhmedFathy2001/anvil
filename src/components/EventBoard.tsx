'use client';

import BingoBoard from './BingoBoard';
import TileRaceBoard from './TileRaceBoard';
import LeaguesBoard from './LeaguesBoard';
import { isTileRaceFormat } from '@/lib/utils';

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
}

/**
 * Renders the right board for an event's format. Drop-in replacement for BingoBoard —
 * pass the same props plus `format`. Keeps the format branch in one place so every
 * board surface (scoreboard, captain, player, admin) stays consistent.
 */
export default function EventBoard({ format, boardSize, pointsMode, ...rest }: EventBoardProps) {
  if (isTileRaceFormat(format)) {
    return <TileRaceBoard {...rest} />;
  }
  // Leagues-style (points scoring) renders as a task-list accordion, not a square grid —
  // so it isn't bound to a perfect-square tile count.
  if (pointsMode) {
    return <LeaguesBoard {...rest} />;
  }
  return <BingoBoard boardSize={boardSize} pointsMode={pointsMode} {...rest} />;
}

'use client';

import TileCell from './TileCell';
import { isManualOnlyDropTile } from '@/lib/clogManual';

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

interface BingoBoardProps {
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
  matchedTileIds?: Set<number> | null;
}

export default function BingoBoard({
  tiles,
  boardSize,
  completions,
  teams,
  activeTeamId,
  interactive,
  onTileClick,
  dropProgress,
  statProgress,
  expanded,
  pointsMode,
  matchedTileIds,
}: BingoBoardProps) {
  const sortedTiles = [...tiles].sort((a, b) => a.position - b.position);
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  return (
    <div
      className={`w-full mx-auto overflow-x-auto p-3 sm:p-4 bg-brown-dark/50 rounded-xl border border-card-border ${
        expanded ? 'max-w-6xl' : 'max-w-4xl'
      }`}
    >
      <div
        className="grid gap-1.5 sm:gap-2"
        style={{
          gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
          // Floor each cell at ~44px (incl. gap) so a large board stays tappable and legible on a
          // phone — it scrolls horizontally instead of shrinking cells into unreadable specks. On
          // wider screens the grid fills the container and cells expand evenly (1fr).
          minWidth: `${boardSize * 3.25}rem`,
        }}
      >
      {sortedTiles.map((tile) => {
        const tileCompletions = completions
          .filter((c) => c.tileId === tile.id)
          .filter((c) => (activeTeamId ? c.teamId === activeTeamId : true))
          .map((c) => {
            const team = teamMap.get(c.teamId);
            return {
              teamId: c.teamId,
              teamName: team?.name || 'Unknown',
              color: team?.color || '#888',
            };
          });

        const progress = dropProgress?.get(tile.id);
        const tileStat = statProgress?.get(tile.id);

        return (
          <TileCell
            key={tile.id}
            label={tile.label}
            icon={tile.icon}
            completedBy={tileCompletions}
            interactive={interactive}
            onClick={onTileClick ? () => onTileClick(tile.id) : undefined}
            size={boardSize}
            tileType={tile.tileType}
            progress={progress}
            statProgress={tileStat}
            expanded={expanded}
            points={pointsMode && !tile.optional ? (tile.points ?? 1) : undefined}
            dimmed={matchedTileIds ? !matchedTileIds.has(tile.id) : false}
            manualOnly={isManualOnlyDropTile(tile)}
            markersOnly={!activeTeamId}
          />
        );
      })}
      </div>
    </div>
  );
}

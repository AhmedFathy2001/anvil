'use client';

import TileCell from './TileCell';

interface Tile {
  id: number;
  position: number;
  label: string;
  icon?: string | null;
  description?: string | null;
  tileType?: string;
  requiredAmount?: number | null;
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
}: BingoBoardProps) {
  const sortedTiles = [...tiles].sort((a, b) => a.position - b.position);
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  return (
    <div
      className="grid gap-1.5 sm:gap-2 w-full max-w-4xl mx-auto p-3 sm:p-4 bg-brown-dark/50 rounded-xl border border-card-border"
      style={{
        gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
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
          />
        );
      })}
    </div>
  );
}

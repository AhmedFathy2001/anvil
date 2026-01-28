'use client';

interface Player {
  id: number;
  eventId: number;
  name: string;
  teamId: number | null;
  pickNumber: number | null;
  pickedAt: string | null;
}

interface Team {
  id: number;
  name: string;
  color: string;
}

interface Props {
  players: Player[];
  teams: Team[];
  interactive: boolean;
  onPick?: (playerId: number) => void;
  onPlayerClick?: (rsn: string) => void;
  picking?: boolean;
}

export default function DraftPlayerPool({ players, teams, interactive, onPick, onPlayerClick, picking }: Props) {
  const poolPlayers = players.filter((p) => p.teamId === null);

  if (poolPlayers.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-card-border rounded-xl">
        <p className="text-text-muted">Player pool is empty.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {poolPlayers.map((player) => (
        <div
          key={player.id}
          className={`border rounded-xl p-3 text-center transition-all ${
            interactive
              ? 'border-gold/40 bg-card-bg'
              : 'border-card-border bg-card-bg'
          } ${picking ? 'opacity-50' : ''}`}
        >
          {onPlayerClick ? (
            <button
              onClick={(e) => { e.stopPropagation(); onPlayerClick(player.name); }}
              className="font-medium text-sm text-gold hover:text-gold-light transition-colors underline decoration-gold/30 underline-offset-2"
              title="View Hiscores"
            >
              {player.name}
            </button>
          ) : (
            <span className="font-medium text-sm">{player.name}</span>
          )}
          {interactive && (
            <button
              disabled={picking}
              onClick={() => onPick?.(player.id)}
              className="block w-full mt-1.5 text-xs font-medium bg-gold/10 text-gold border border-gold/20 px-2 py-1 rounded-lg hover:bg-gold/20 transition-colors disabled:opacity-50"
            >
              Pick
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

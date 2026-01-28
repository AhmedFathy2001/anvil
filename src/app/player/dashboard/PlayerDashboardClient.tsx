'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import BingoBoard from '@/components/BingoBoard';
import TileDetailModal from '@/components/TileDetailModal';
import PlayerContributions from '@/components/PlayerContributions';

interface Tile {
  id: number;
  eventId: number;
  position: number;
  label: string;
  icon?: string | null;
  description?: string | null;
  tileType: string;
  requiredAmount?: number | null;
  trackedStat?: string | null;
  statType?: string | null;
  statGoal?: number | null;
  trackingMode?: string | null;
}

interface PlayerGain {
  playerId: number;
  playerName: string;
  gained: number;
  current: number;
}

interface Team {
  id: number;
  eventId: number;
  name: string;
  color: string;
}

interface Completion {
  id: number;
  teamId: number;
  tileId: number;
  completedAt: string;
}

interface Event {
  id: number;
  name: string;
  boardSize: number;
  createdAt: string;
}

interface Submission {
  id: number;
  tileId: number;
  teamId: number;
  playerId: number | null;
  creditPlayerId: number | null;
  amount: number;
  imageUrl: string | null;
  note: string | null;
  createdAt: string;
  uploaderName?: string | null;
  creditPlayerName?: string | null;
}

interface Player {
  id: number;
  name: string;
  teamId: number | null;
}

interface Props {
  event: Event;
  team: Team;
  tiles: Tile[];
  completions: Completion[];
  playerId: number;
  playerName: string;
  players: Player[];
}

export default function PlayerDashboardClient({ event, team, tiles, completions: initialCompletions, playerId, playerName, players }: Props) {
  const [completions, setCompletions] = useState(initialCompletions);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [gains, setGains] = useState<Record<number, PlayerGain[]>>({});
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);

  const teamPlayers = useMemo(() => players.filter((p) => p.teamId === team.id), [players, team.id]);

  const fetchSubmissions = useCallback(async () => {
    const res = await fetch(`/api/events/${event.id}/submissions?teamId=${team.id}`);
    if (res.ok) setSubmissions(await res.json());
  }, [event.id, team.id]);

  const fetchCompletions = useCallback(async () => {
    const res = await fetch(`/api/events/${event.id}/completions`);
    if (res.ok) {
      const data = await res.json();
      setCompletions(data.filter((c: Completion) => c.teamId === team.id));
    }
  }, [event.id, team.id]);

  const fetchGains = useCallback(async () => {
    const res = await fetch(`/api/events/${event.id}/gains?teamId=${team.id}`);
    if (res.ok) {
      const data = await res.json();
      const gainsMap: Record<number, PlayerGain[]> = {};
      for (const tile of tiles) {
        if (tile.trackedStat) {
          gainsMap[tile.id] = [];
          for (const p of teamPlayers) {
            const playerData = data.find((d: { playerId: number }) => d.playerId === p.id);
            if (playerData) {
              const gained = playerData.gains?.[tile.trackedStat] ?? 0;
              const current = playerData.current?.[tile.trackedStat] ?? 0;
              gainsMap[tile.id].push({
                playerId: p.id,
                playerName: p.name,
                gained,
                current,
              });
            }
          }
        }
      }
      setGains(gainsMap);
    }
  }, [event.id, team.id, tiles, teamPlayers]);

  useEffect(() => {
    fetchSubmissions();
    fetchGains();
  }, [fetchSubmissions, fetchGains]);

  async function handleSubmit(data: { tileId: number; teamId: number; amount: number; imageUrl: string; note: string; creditPlayerId: number | null }) {
    const res = await fetch(`/api/events/${event.id}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      await fetchSubmissions();
      await fetchCompletions();
    }
  }

  async function handleDeleteSubmission(submissionId: number) {
    const res = await fetch(`/api/events/${event.id}/submissions?submissionId=${submissionId}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchSubmissions();
      await fetchCompletions();
    }
  }

  // Build drop progress map
  const dropProgress = new Map<number, { current: number; required: number }>();
  for (const tile of tiles) {
    if (tile.tileType === 'drop' && tile.requiredAmount) {
      const tileSubs = submissions.filter((s) => s.tileId === tile.id);
      const current = tileSubs.reduce((sum, s) => sum + s.amount, 0);
      dropProgress.set(tile.id, { current, required: tile.requiredAmount });
    }
  }

  const completed = completions.length;
  const total = tiles.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const selectedTile = tiles.find((t) => t.id === selectedTileId);
  const selectedTileSubmissions = submissions.filter((s) => s.tileId === selectedTileId);
  const selectedTileCompletedBy = selectedTileId
    ? completions
        .filter((c) => c.tileId === selectedTileId)
        .map(() => ({ teamId: team.id, teamName: team.name, color: team.color }))
    : [];

  // Filter submissions where this player got credit
  const mySubmissions = submissions.filter((s) => s.creditPlayerId === playerId);

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-5 h-5 rounded-full ring-2 ring-offset-2 ring-offset-background"
          style={{ backgroundColor: team.color }}
        />
        <h1 className="text-2xl sm:text-3xl font-bold">{team.name}</h1>
        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-medium">{playerName}</span>
      </div>
      <p className="text-text-muted text-sm mb-2">{event.name}</p>

      {/* Progress bar */}
      <div className="mb-6 max-w-md">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-text-muted">{completed}/{total} completed</span>
          <span className="font-medium" style={{ color: team.color }}>{percentage}%</span>
        </div>
        <div className="w-full bg-brown-dark rounded-full h-2.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${percentage}%`,
              background: `linear-gradient(90deg, ${team.color}cc, ${team.color})`,
            }}
          />
        </div>
      </div>

      <BingoBoard
        tiles={tiles}
        boardSize={event.boardSize}
        completions={completions}
        teams={[team]}
        activeTeamId={team.id}
        onTileClick={(tileId) => {
          const tile = tiles.find((t) => t.id === tileId);
          // Allow opening drop tiles and stat-tracked tiles
          if (tile?.tileType === 'drop' || tile?.trackedStat) {
            setSelectedTileId(tileId);
          }
        }}
        dropProgress={dropProgress}
      />

      {/* My Contributions */}
      <div className="mt-8">
        <PlayerContributions
          submissions={mySubmissions}
          tiles={tiles}
          playerName={playerName}
        />
      </div>

      {/* Tile Detail Modal */}
      {selectedTile && (
        <TileDetailModal
          tile={selectedTile}
          submissions={selectedTileSubmissions}
          completedBy={selectedTileCompletedBy}
          canSubmit={selectedTile.tileType === 'drop'}
          canManage={false}
          canToggle={false}
          onSubmit={handleSubmit}
          onDelete={handleDeleteSubmission}
          onClose={() => setSelectedTileId(null)}
          eventId={event.id}
          teamId={team.id}
          dropProgress={dropProgress.get(selectedTile.id)}
          teamPlayers={teamPlayers.map((p) => ({ id: p.id, name: p.name }))}
          currentPlayerId={playerId}
          statProgress={gains[selectedTile.id]}
        />
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import BingoBoard from '@/components/BingoBoard';
import TileDetailModal from '@/components/TileDetailModal';

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
  players: Player[];
}

export default function CaptainBoardClient({ event, team: initialTeam, tiles, completions: initialCompletions, players }: Props) {
  const router = useRouter();
  const [team, setTeam] = useState(initialTeam);
  const [completions, setCompletions] = useState(initialCompletions);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [gains, setGains] = useState<Record<number, PlayerGain[]>>({});
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(team.name);
  const [savingName, setSavingName] = useState(false);

  const teamPlayers = useMemo(() => players.filter((p) => p.teamId === team.id), [players, team.id]);

  const fetchSubmissions = useCallback(async () => {
    const res = await fetch(`/api/events/${event.id}/submissions?teamId=${team.id}`);
    if (res.ok) {
      const data = await res.json();
      setSubmissions(data);
    }
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
      // Build gains map by tileId
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

  async function handleTileClick(tileId: number) {
    const tile = tiles.find((t) => t.id === tileId);
    if (!tile) return;

    // Open modal for drop tiles and stat-tracked tiles
    if (tile.tileType === 'drop' || tile.trackedStat) {
      setSelectedTileId(tileId);
    } else {
      // Standard tile: toggle completion
      const res = await fetch(`/api/events/${event.id}/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id, tileId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.action === 'added') {
          setCompletions([...completions, { id: data.id, teamId: team.id, tileId, completedAt: data.completedAt }]);
        } else {
          setCompletions(completions.filter((c) => !(c.teamId === team.id && c.tileId === tileId)));
        }
      }
      router.refresh();
    }
  }

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
    const res = await fetch(`/api/events/${event.id}/submissions?submissionId=${submissionId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await fetchSubmissions();
      await fetchCompletions();
    }
  }

  async function handleToggle(tileId: number) {
    const res = await fetch(`/api/events/${event.id}/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: team.id, tileId }),
    });
    if (res.ok) {
      await fetchCompletions();
    }
  }

  async function saveTeamName() {
    if (!newName.trim() || newName === team.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    const res = await fetch(`/api/events/${event.id}/teams`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: team.id, name: newName.trim() }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTeam({ ...team, name: updated.name });
    }
    setSavingName(false);
    setEditingName(false);
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
  const tilesLeft = total - completed;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const selectedTile = tiles.find((t) => t.id === selectedTileId);
  const selectedTileSubmissions = submissions.filter((s) => s.tileId === selectedTileId);
  const selectedTileCompletedBy = selectedTileId
    ? completions
        .filter((c) => c.tileId === selectedTileId)
        .map(() => ({ teamId: team.id, teamName: team.name, color: team.color }))
    : [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-5 h-5 rounded-full ring-2 ring-offset-2 ring-offset-background"
          style={{ backgroundColor: team.color }}
        />
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-xl font-bold bg-brown-dark border border-card-border rounded px-2 py-0.5"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTeamName();
                if (e.key === 'Escape') { setEditingName(false); setNewName(team.name); }
              }}
            />
            <button
              onClick={saveTeamName}
              disabled={savingName}
              className="text-xs text-accent-green-light hover:text-accent-green transition-colors"
            >
              {savingName ? '...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditingName(false); setNewName(team.name); }}
              className="text-xs text-text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <h1
            className="text-2xl sm:text-3xl font-bold cursor-pointer hover:text-gold transition-colors"
            onClick={() => setEditingName(true)}
            title="Click to edit team name"
          >
            {team.name}
          </h1>
        )}
        <span className="text-xs bg-accent-green/20 text-accent-green-light px-2 py-0.5 rounded-full font-medium">Captain</span>
      </div>
      <p className="text-text-muted text-sm mb-2">{event.name} · Click tiles to toggle or submit</p>

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
        <p className="text-xs text-text-muted mt-1">{tilesLeft} remaining</p>
      </div>

      <BingoBoard
        tiles={tiles}
        boardSize={event.boardSize}
        completions={completions}
        teams={[team]}
        activeTeamId={team.id}
        interactive
        onTileClick={handleTileClick}
        dropProgress={dropProgress}
      />

      {/* Tile Detail Modal */}
      {selectedTile && (
        <TileDetailModal
          tile={selectedTile}
          submissions={selectedTileSubmissions}
          completedBy={selectedTileCompletedBy}
          canSubmit={selectedTile.tileType === 'drop'}
          canManage={selectedTile.tileType === 'drop'}
          canToggle={!selectedTile.trackedStat && selectedTile.tileType !== 'drop'}
          onSubmit={handleSubmit}
          onDelete={handleDeleteSubmission}
          onToggle={handleToggle}
          onClose={() => setSelectedTileId(null)}
          eventId={event.id}
          teamId={team.id}
          dropProgress={dropProgress.get(selectedTile.id)}
          teamPlayers={teamPlayers.map((p) => ({ id: p.id, name: p.name }))}
          statProgress={gains[selectedTile.id]}
        />
      )}
    </div>
  );
}

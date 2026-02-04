'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import BingoBoard from '@/components/BingoBoard';
import TileDetailModal from '@/components/TileDetailModal';
import PlayerContributions from '@/components/PlayerContributions';
import LocalTime from '@/components/LocalTime';

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
  womCompetitionId?: number | null;
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
  startDate?: string | null;
  endDate?: string | null;
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
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [eventCountdown, setEventCountdown] = useState<string>('');

  const teamPlayers = useMemo(() => players.filter((p) => p.teamId === team.id), [players, team.id]);
  const eventStarted = !event.startDate || new Date(event.startDate) <= new Date();

  // Event countdown timer
  useEffect(() => {
    if (!event.startDate || eventStarted) {
      setEventCountdown('');
      return;
    }
    const updateCountdown = () => {
      const now = new Date();
      const start = new Date(event.startDate!);
      const diff = start.getTime() - now.getTime();
      if (diff <= 0) {
        setEventCountdown('');
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      if (days > 0) {
        setEventCountdown(`${days}d ${hours}h ${mins}m`);
      } else if (hours > 0) {
        setEventCountdown(`${hours}h ${mins}m ${secs}s`);
      } else {
        setEventCountdown(`${mins}m ${secs}s`);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [event.startDate, eventStarted]);

  // Refresh countdown timer
  useEffect(() => {
    if (!nextRefresh) {
      setCountdown('');
      return;
    }
    const interval = setInterval(() => {
      const now = new Date();
      const diff = nextRefresh.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown('');
        setNextRefresh(null);
      } else {
        const min = Math.floor(diff / 60000);
        const sec = Math.floor((diff % 60000) / 1000);
        setCountdown(`${min}:${sec.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [nextRefresh]);

  async function refreshMyStats() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/events/${event.id}/refresh-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastFetch(data.lastFetch);
        await fetchGains();
      } else if (res.status === 429 && data.nextRefresh) {
        setNextRefresh(new Date(data.nextRefresh));
      }
    } finally {
      setRefreshing(false);
    }
  }

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
              // Get my lastFetch time
              if (p.id === playerId && playerData.lastFetch) {
                setLastFetch(playerData.lastFetch);
              }
            }
          }
        }
      }
      setGains(gainsMap);
    }
  }, [event.id, team.id, tiles, teamPlayers, playerId]);

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

  async function handleDeleteSubmission(submissionId: number, reason: string) {
    const res = await fetch(`/api/events/${event.id}/submissions?submissionId=${submissionId}&reason=${encodeURIComponent(reason)}`, { method: 'DELETE' });
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

      {/* Event Countdown */}
      {eventCountdown && (
        <div className="mb-4 p-3 border border-gold/30 rounded-lg bg-gold/10 text-center">
          <p className="text-xs text-text-muted mb-1">Event starts in</p>
          <p className="text-lg font-bold text-gold">{eventCountdown}</p>
          {event.startDate && (
            <p className="text-xs text-text-muted mt-1">
              <LocalTime date={event.startDate} />
            </p>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-4 max-w-md">
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

      {/* Refresh Stats */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <button
          onClick={refreshMyStats}
          disabled={refreshing || !!countdown || !eventStarted}
          className="px-3 py-1.5 text-xs font-medium rounded bg-blue-500/20 border border-blue-500 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
        >
          {refreshing ? 'Refreshing...' : countdown ? `Wait ${countdown}` : !eventStarted ? 'Awaiting Event Start' : 'Refresh My Stats'}
        </button>
        {lastFetch && (
          <span className="text-xs text-text-muted">
            Last updated: <LocalTime date={lastFetch} />
          </span>
        )}
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
          canSubmit={selectedTile.tileType === 'drop' && eventStarted}
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

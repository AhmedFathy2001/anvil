'use client';

import type { Event, Tile, Team, Completion, Submission, Player, PlayerGain } from '@/lib/types';
import { useState, useEffect, useCallback, useMemo } from 'react';
import EventBoard from '@/components/EventBoard';
import TileDetailModal from '@/components/TileDetailModal';
import LocalTime from '@/components/LocalTime';
import { useCountdown, useRefreshCountdown } from '@/hooks/useCountdown';
import { useDropProgress } from '@/hooks/useDropProgress';
import { BoardSkeleton, ErrorBanner } from '@/components/BoardSkeleton';
import { tileWeight, isPointsMode } from '@/lib/utils';
import Input from '@/components/Input';

interface Props {
  event: Event;
  team: Team;
  tiles: Tile[];
  completions: Completion[];
  players: Player[];
}

export default function CaptainBoardClient({ event, team: initialTeam, tiles, completions: initialCompletions, players }: Props) {
  const [team, setTeam] = useState(initialTeam);
  const [completions, setCompletions] = useState(initialCompletions);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [gains, setGains] = useState<Record<number, PlayerGain[]>>({});
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(team.name);
  const [savingName, setSavingName] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [playerFetchStatus, setPlayerFetchStatus] = useState<Record<number, string | null>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tileSearch, setTileSearch] = useState('');

  const teamPlayers = useMemo(() => players.filter((p) => p.teamId === team.id), [players, team.id]);
  const eventStarted = !event.startDate || new Date(event.startDate) <= new Date();

  // Tile search — matched tiles stay, the rest are hidden (list board) / dimmed (grid). Null = no filter.
  const matchedTileIds = useMemo(() => {
    const q = tileSearch.trim().toLowerCase();
    if (!q) return null;
    return new Set(
      tiles
        .filter((t) => t.label.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q) ?? false))
        .map((t) => t.id),
    );
  }, [tileSearch, tiles]);

  const eventCountdown = useCountdown(!eventStarted ? event.startDate : null);
  const { countdown, nextRefresh, setNextRefresh } = useRefreshCountdown();

  async function refreshTeamStats() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/events/${event.id}/refresh-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id }),
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
      const fetchStatus: Record<number, string | null> = {};
      let latestFetch: string | null = null;

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
              fetchStatus[p.id] = playerData.lastFetch;
              if (playerData.lastFetch && (!latestFetch || playerData.lastFetch > latestFetch)) {
                latestFetch = playerData.lastFetch;
              }
            }
          }
        }
      }
      setGains(gainsMap);
      setPlayerFetchStatus(fetchStatus);
      if (latestFetch) setLastFetch(latestFetch);
    }
  }, [event.id, team.id, tiles, teamPlayers]);

  useEffect(() => {
    async function loadData() {
      setFetchError(null);
      try {
        await Promise.all([fetchSubmissions(), fetchGains()]);
        setLoading(false);
      } catch {
        setFetchError('Failed to load data. Please refresh.');
        setLoading(false);
      }
    }
    loadData();
  }, [fetchSubmissions, fetchGains]);

  function handleTileClick(tileId: number) {
    const tile = tiles.find((t) => t.id === tileId);
    if (!tile) return;
    // Always open the detail modal so the captain sees the tile overview — progress,
    // submissions, who submitted them and the screenshots — and toggles done/undone
    // deliberately from inside it (via "Mark Complete"). Previously only drop / stat-tracked
    // tiles opened the modal; every other tile (standard, kill, timed, pvp…) blind-toggled on
    // a single click with no context, which is what captains hit on Leagues / tile-race boards.
    setSelectedTileId(tileId);
  }

  async function handleSubmit(data: { tileId: number; teamId: number; amount: number; imageUrl: string; note: string; creditPlayerId: number | null; durationSeconds?: number }) {
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
    const res = await fetch(`/api/events/${event.id}/submissions?submissionId=${submissionId}&reason=${encodeURIComponent(reason)}`, {
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
  const { dropProgress, perItemProgressMap } = useDropProgress(tiles, submissions);

  // Build stat progress map for tiles
  const statProgress = new Map<number, { current: number; goal: number; statType?: string }>();
  for (const tile of tiles) {
    if (tile.trackedStat && tile.statGoal) {
      const tileGains = gains[tile.id] || [];
      const totalGained = tileGains.reduce((sum, p) => sum + p.gained, 0);
      statProgress.set(tile.id, {
        current: totalGained,
        goal: tile.statGoal,
        statType: tile.statType || undefined,
      });
    }
  }

  const pointsMode = isPointsMode(event.scoringMode);
  const weightById = useMemo(
    () => new Map(tiles.map((t) => [t.id, tileWeight(event.scoringMode, t.points)])),
    [tiles, event.scoringMode],
  );
  const completed = pointsMode
    ? completions.reduce((sum, c) => sum + (weightById.get(c.tileId) || 0), 0)
    : completions.length;
  const total = pointsMode
    ? tiles.reduce((sum, t) => sum + tileWeight(event.scoringMode, t.points), 0)
    : tiles.length;
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
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <div
          className="w-5 h-5 rounded-full ring-2 ring-offset-2 ring-offset-background"
          style={{ backgroundColor: team.color }}
        />
        {editingName ? (
          <div className="flex items-center gap-2">
            <Input
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
              className="text-sm text-accent-green-light hover:text-accent-green transition-colors px-3 py-2 rounded-md hover:bg-accent-green/10"
            >
              {savingName ? '...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditingName(false); setNewName(team.name); }}
              className="text-sm text-text-muted hover:text-foreground transition-colors px-3 py-2 rounded-md hover:bg-brown-light"
            >
              Cancel
            </button>
          </div>
        ) : (
          <h1
            className={`text-2xl sm:text-3xl font-bold ${!eventStarted ? 'cursor-pointer hover:text-gold' : ''} transition-colors`}
            onClick={() => !eventStarted && setEditingName(true)}
            title={eventStarted ? 'Team name locked after event start' : 'Click to edit team name'}
          >
            {team.name}
          </h1>
        )}
        <span className="text-xs bg-accent-green/20 text-accent-green-light px-2 py-0.5 rounded-full font-medium">Captain</span>
      </div>
      <p className="text-text-muted text-sm mb-2">{event.name} · Click tiles to toggle or submit</p>

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
          <span className="text-text-muted">{completed}/{total} {pointsMode ? 'pts' : 'completed'}</span>
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

      {/* Refresh Team Stats */}
      <div className="mb-6 p-3 border border-card-border rounded-lg bg-card-bg">
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <button
            onClick={refreshTeamStats}
            disabled={refreshing || !!countdown || !eventStarted}
            className="px-3 py-1.5 text-xs font-medium rounded bg-blue-500/20 border border-blue-500 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
          >
            {refreshing ? 'Refreshing Team...' : countdown ? `Wait ${countdown}` : !eventStarted ? 'Awaiting Event Start' : 'Refresh Team Stats'}
          </button>
          {lastFetch && (
            <span className="text-xs text-text-muted">
              Last updated: <LocalTime date={lastFetch} />
            </span>
          )}
        </div>
        {teamPlayers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {teamPlayers.map((p) => (
              <span
                key={p.id}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  playerFetchStatus[p.id]
                    ? 'bg-accent-green/20 text-accent-green-light'
                    : 'bg-red-400/20 text-red-400'
                }`}
                title={playerFetchStatus[p.id] ? `Fetched: ${new Date(playerFetchStatus[p.id]!).toLocaleString()}` : 'Not fetched'}
              >
                {p.name} {playerFetchStatus[p.id] ? '✓' : '✗'}
              </span>
            ))}
          </div>
        )}
      </div>

      {fetchError && <ErrorBanner message={fetchError} onRetry={() => { setFetchError(null); setLoading(true); fetchSubmissions().then(() => fetchGains()).then(() => setLoading(false)).catch(() => { setFetchError('Failed to load data. Please refresh.'); setLoading(false); }); }} />}
      {loading && submissions.length === 0 && <BoardSkeleton size={event.boardSize} />}

      {tiles.length > 9 && (
        <div className="mb-4 max-w-md">
          <input
            type="text"
            value={tileSearch}
            onChange={(e) => setTileSearch(e.target.value)}
            placeholder="Search tiles by name…"
            className="w-full bg-brown-dark border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold/50"
          />
        </div>
      )}

      <EventBoard
        format={event.format}
        tiles={tiles}
        boardSize={event.boardSize}
        completions={completions}
        teams={[team]}
        activeTeamId={team.id}
        interactive
        onTileClick={handleTileClick}
        dropProgress={dropProgress}
        statProgress={statProgress}
        pointsMode={pointsMode}
        matchedTileIds={matchedTileIds}
      />

      {/* Team Roster */}
      {teamPlayers.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full" style={{ backgroundColor: team.color }} />
            Team Roster ({teamPlayers.length} players)
          </h2>
          <div className="flex flex-wrap gap-2">
            {teamPlayers.map((player) => (
              <span
                key={player.id}
                className="text-sm px-3 py-1.5 rounded-lg border border-card-border bg-card-bg"
              >
                {player.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Player Activity */}
      {submissions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full" style={{ backgroundColor: team.color }} />
            Player Activity
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(() => {
              // Count discrete submissions (one screenshot = one contribution), NOT summed
              // `amount` — for kill-count/value tiles `amount` is a kill count or gp value and
              // summing it inflated the figure (e.g. one "35 Hill Giants" screenshot read as 35).
              const activityByPlayer = new Map<number, { name: string; submissions: number }>();
              for (const s of submissions) {
                if (s.creditPlayerId) {
                  const existing = activityByPlayer.get(s.creditPlayerId);
                  if (existing) {
                    existing.submissions++;
                  } else {
                    activityByPlayer.set(s.creditPlayerId, {
                      name: s.creditPlayerName || 'Unknown',
                      submissions: 1,
                    });
                  }
                }
              }

              const sorted = Array.from(activityByPlayer.entries()).sort((a, b) => b[1].submissions - a[1].submissions);

              return sorted.map(([playerId, data]) => (
                <div key={playerId} className="border border-card-border rounded-lg p-3 bg-card-bg">
                  <div className="font-medium text-foreground mb-1">{data.name}</div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-accent-green-light font-medium">
                      {data.submissions} drop{data.submissions !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Tile Detail Modal */}
      {selectedTile && (
        <TileDetailModal
          tile={selectedTile}
          submissions={selectedTileSubmissions}
          completedBy={selectedTileCompletedBy}
          canSubmit={eventStarted}
          canManage={eventStarted}
          canToggle={!selectedTile.trackedStat && eventStarted}
          onSubmit={handleSubmit}
          onDelete={handleDeleteSubmission}
          onToggle={handleToggle}
          onClose={() => setSelectedTileId(null)}
          eventId={event.id}
          teamId={team.id}
          dropProgress={dropProgress.get(selectedTile.id)}
          perItemProgress={perItemProgressMap.get(selectedTile.id)}
          teamPlayers={teamPlayers.map((p) => ({ id: p.id, name: p.name }))}
          statProgress={gains[selectedTile.id]}
          pointsMode={pointsMode}
        />
      )}
    </div>
  );
}

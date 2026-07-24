'use client';

import type { Event, Tile, Team, Completion, Submission, Player, PlayerGain } from '@/lib/types';
import type { PlayerRecap } from '@/lib/eventRecap';
import { useState, useEffect, useCallback, useMemo } from 'react';
import EventBoard from '@/components/EventBoard';
import TileDetailModal from '@/components/TileDetailModal';
import PlayerContributions from '@/components/PlayerContributions';
import LocalTime from '@/components/LocalTime';
import { useCountdown } from '@/hooks/useCountdown';
import { useDropProgress } from '@/hooks/useDropProgress';
import { BoardSkeleton, ErrorBanner } from '@/components/BoardSkeleton';
import { tileWeight, isPointsMode } from '@/lib/utils';

interface Props {
  event: Event;
  team: Team;
  tiles: Tile[];
  completions: Completion[];
  playerId: number;
  playerName: string;
  players: Player[];
  recap: PlayerRecap | null;
}

export default function PlayerDashboardClient({ event, team, tiles, completions: initialCompletions, playerId, playerName, players, recap }: Props) {
  const [completions, setCompletions] = useState(initialCompletions);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [gains, setGains] = useState<Record<number, PlayerGain[]>>({});
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const teamPlayers = useMemo(() => players.filter((p) => p.teamId === team.id), [players, team.id]);
  const eventStarted = !event.startDate || new Date(event.startDate) <= new Date();

  const eventCountdown = useCountdown(!eventStarted ? event.startDate : null);

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

  async function handleSubmit(data: { tileId: number; teamId: number; amount: number; imageUrl: string; note: string; creditPlayerId: number | null; durationSeconds?: number; itemId?: number }) {
    const res = await fetch(`/api/events/${event.id}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Submission failed');
    }
    await fetchSubmissions();
    await fetchCompletions();
  }

  async function handleDeleteSubmission(submissionId: number, reason: string) {
    const res = await fetch(`/api/events/${event.id}/submissions?submissionId=${submissionId}&reason=${encodeURIComponent(reason)}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchSubmissions();
      await fetchCompletions();
    }
  }

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
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <div
          className="w-5 h-5 rounded-full ring-2 ring-offset-2 ring-offset-background"
          style={{ backgroundColor: team.color }}
        />
        <h1 className="text-2xl sm:text-3xl font-bold">{team.name}</h1>
        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-medium">{playerName}</span>
      </div>
      <p className="text-text-muted text-sm mb-2">{event.name}</p>

      {recap?.ended && (recap.awardsWon.length > 0 || recap.stats.length > 0) && (
        <PlayerRecapCard recap={recap} />
      )}

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
      </div>

      {/* Stats auto-update on the periodic cron — members no longer refresh manually (a captain or
          admin can force a refresh if something looks stale). */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        {lastFetch && (
          <span className="text-xs text-text-muted">
            Stats last updated: <LocalTime date={lastFetch} />
          </span>
        )}
      </div>

      {fetchError && <ErrorBanner message={fetchError} onRetry={() => { setFetchError(null); setLoading(true); }} />}
      {loading && submissions.length === 0 && <BoardSkeleton size={event.boardSize} />}

      <EventBoard
        format={event.format}
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
        statProgress={statProgress}
        pointsMode={pointsMode}
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
          perItemProgress={perItemProgressMap.get(selectedTile.id)}
          teamPlayers={teamPlayers.map((p) => ({ id: p.id, name: p.name }))}
          currentPlayerId={playerId}
          statProgress={gains[selectedTile.id]}
          pointsMode={pointsMode}
        />
      )}
    </div>
  );
}

// Post-event "your event, by the numbers" card — the awards this player took home plus their headline
// counters. Rendered only once the event has ended and there's something to show.
function PlayerRecapCard({ recap }: { recap: PlayerRecap }) {
  return (
    <div className="mb-4 border border-gold/30 rounded-xl bg-gold/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="font-bold text-gold">Your event, by the numbers</h2>
      </div>

      {recap.awardsWon.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {recap.awardsWon.map((a) => (
            <span
              key={a.title}
              className="inline-flex items-center gap-1.5 text-sm font-semibold bg-gold/20 text-gold border border-gold/30 px-2.5 py-1 rounded-full"
              title={a.valueLabel}
            >
              <span aria-hidden>{a.emoji}</span> {a.title}
            </span>
          ))}
        </div>
      )}

      {recap.stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {recap.stats.map((s) => (
            <div key={s.key} className="border border-card-border rounded-lg bg-card-bg px-3 py-2 text-center">
              <p className="text-lg font-extrabold text-text tabular-nums">{s.value}</p>
              <p className="text-xs text-text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

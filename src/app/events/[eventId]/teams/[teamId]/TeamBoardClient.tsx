'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import BingoBoard from '@/components/BingoBoard';
import TileDetailModal from '@/components/TileDetailModal';
import Link from 'next/link';

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

export default function TeamBoardClient({ event, team, tiles, completions, players }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [gains, setGains] = useState<Record<number, PlayerGain[]>>({});
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);

  const teamPlayers = useMemo(() => players.filter((p) => p.teamId === team.id), [players, team.id]);

  const fetchSubmissions = useCallback(async () => {
    const res = await fetch(`/api/events/${event.id}/submissions?teamId=${team.id}`);
    if (res.ok) setSubmissions(await res.json());
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

  const completed = completions.length;
  const total = tiles.length;
  const tilesLeft = total - completed;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Build drop progress map
  const dropProgress = new Map<number, { current: number; required: number }>();
  for (const tile of tiles) {
    if (tile.tileType === 'drop' && tile.requiredAmount) {
      const tileSubs = submissions.filter((s) => s.tileId === tile.id);
      const current = tileSubs.reduce((sum, s) => sum + s.amount, 0);
      dropProgress.set(tile.id, { current, required: tile.requiredAmount });
    }
  }

  const selectedTile = tiles.find((t) => t.id === selectedTileId);
  const selectedTileSubmissions = submissions.filter((s) => s.tileId === selectedTileId);
  const selectedTileCompletedBy = selectedTileId
    ? completions
        .filter((c) => c.tileId === selectedTileId)
        .map(() => ({ teamId: team.id, teamName: team.name, color: team.color }))
    : [];

  return (
    <div>
      <Link href={`/events/${event.id}`} className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-4">
        &larr; Back to scoreboard
      </Link>

      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-5 h-5 rounded-full ring-2 ring-offset-2 ring-offset-background ring-current"
          style={{ backgroundColor: team.color, color: team.color }}
        />
        <h1 className="text-2xl sm:text-3xl font-bold">{team.name}</h1>
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
        <p className="text-xs text-text-muted mt-1">{tilesLeft} remaining</p>
      </div>

      <BingoBoard
        tiles={tiles}
        boardSize={event.boardSize}
        completions={completions}
        teams={[team]}
        activeTeamId={team.id}
        onTileClick={(tileId) => setSelectedTileId(tileId)}
        dropProgress={dropProgress}
      />

      {/* Team Roster */}
      {teamPlayers.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full" style={{ backgroundColor: team.color }} />
            Team Roster
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
              // Group submissions by creditPlayerId and count
              const activityByPlayer = new Map<number, { name: string; submissions: number; totalAmount: number }>();
              for (const s of submissions) {
                if (s.creditPlayerId) {
                  const existing = activityByPlayer.get(s.creditPlayerId);
                  if (existing) {
                    existing.submissions++;
                    existing.totalAmount += s.amount;
                  } else {
                    activityByPlayer.set(s.creditPlayerId, {
                      name: s.creditPlayerName || 'Unknown',
                      submissions: 1,
                      totalAmount: s.amount,
                    });
                  }
                }
              }

              // Sort by total amount descending
              const sorted = Array.from(activityByPlayer.entries()).sort((a, b) => b[1].totalAmount - a[1].totalAmount);

              return sorted.map(([playerId, data]) => (
                <div key={playerId} className="border border-card-border rounded-lg p-3 bg-card-bg">
                  <div className="font-medium text-foreground mb-1">{data.name}</div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-accent-green-light font-medium">
                      {data.totalAmount} drops
                    </span>
                    <span className="text-text-muted">
                      ({data.submissions} submission{data.submissions !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* View-only Tile Detail Modal */}
      {selectedTile && (
        <TileDetailModal
          tile={selectedTile}
          submissions={selectedTileSubmissions}
          completedBy={selectedTileCompletedBy}
          canSubmit={false}
          canManage={false}
          canToggle={false}
          onClose={() => setSelectedTileId(null)}
          eventId={event.id}
          teamId={team.id}
          dropProgress={dropProgress.get(selectedTile.id)}
          statProgress={gains[selectedTile.id]}
        />
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  womCompetitionId?: number | null;
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

export default function AdminTeamBoardClient({ event, team, tiles, completions: initialCompletions, players }: Props) {
  const router = useRouter();
  const [completions, setCompletions] = useState(initialCompletions);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);

  const teamPlayers = players.filter((p) => p.teamId === team.id);

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

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  function handleTileClick(tileId: number) {
    setSelectedTileId(tileId);
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

  const selectedTile = tiles.find((t) => t.id === selectedTileId);
  const selectedTileSubmissions = submissions.filter((s) => s.tileId === selectedTileId);
  const selectedTileCompletedBy = selectedTileId
    ? completions
        .filter((c) => c.tileId === selectedTileId)
        .map(() => ({ teamId: team.id, teamName: team.name, color: team.color }))
    : [];

  return (
    <div>
      <Link
        href={`/admin/events/${event.id}`}
        className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-4"
      >
        &larr; Back to event
      </Link>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: team.color }} />
        <h1 className="text-2xl sm:text-3xl font-bold">{team.name}</h1>
        <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded-full font-medium">Admin</span>
      </div>
      <p className="text-text-muted text-sm mb-6">
        Click tiles to view details and manage · {completed}/{total} completed
      </p>

      <BingoBoard
        tiles={tiles}
        boardSize={event.boardSize}
        completions={completions}
        teams={[team]}
        activeTeamId={team.id}
        onTileClick={handleTileClick}
        dropProgress={dropProgress}
      />

      {/* Tile Detail Modal */}
      {selectedTile && (
        <TileDetailModal
          tile={selectedTile}
          submissions={selectedTileSubmissions}
          completedBy={selectedTileCompletedBy}
          canSubmit={true}
          canManage={true}
          canToggle={true}
          onSubmit={handleSubmit}
          onDelete={handleDeleteSubmission}
          onToggle={handleToggle}
          onClose={() => setSelectedTileId(null)}
          eventId={event.id}
          teamId={team.id}
          dropProgress={dropProgress.get(selectedTile.id)}
          teamPlayers={teamPlayers.map((p) => ({ id: p.id, name: p.name }))}
        />
      )}
    </div>
  );
}

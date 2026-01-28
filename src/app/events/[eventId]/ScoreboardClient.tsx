'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BingoBoard from '@/components/BingoBoard';
import Scoreboard from '@/components/Scoreboard';

interface Tile {
  id: number;
  eventId: number;
  position: number;
  label: string;
  icon?: string | null;
  description?: string | null;
  tileType?: string;
  requiredAmount?: number | null;
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
  draftStatus: string;
  draftOrder: string | null;
}

interface Submission {
  id: number;
  tileId: number;
  teamId: number;
  amount: number;
}

interface Props {
  event: Event;
  tiles: Tile[];
  teams: Team[];
  completions: Completion[];
}

export default function ScoreboardClient({ event, tiles, teams, completions }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    fetch(`/api/events/${event.id}/submissions`)
      .then((r) => r.ok ? r.json() : [])
      .then(setSubmissions);
  }, [event.id]);

  const completionCounts = new Map<number, number>();
  for (const c of completions) {
    completionCounts.set(c.teamId, (completionCounts.get(c.teamId) || 0) + 1);
  }

  // Build drop progress by team
  const dropProgressByTeam = new Map<number, { inProgress: number; total: number }>();
  const dropTiles = tiles.filter((t) => t.tileType === 'drop' && t.requiredAmount);
  for (const team of teams) {
    let inProgress = 0;
    for (const tile of dropTiles) {
      const tileSubs = submissions.filter((s) => s.tileId === tile.id && s.teamId === team.id);
      const current = tileSubs.reduce((sum, s) => sum + s.amount, 0);
      const isComplete = completions.some((c) => c.tileId === tile.id && c.teamId === team.id);
      if (current > 0 && !isComplete) {
        inProgress++;
      }
    }
    if (inProgress > 0) {
      dropProgressByTeam.set(team.id, { inProgress, total: dropTiles.length });
    }
  }

  const totalCompleted = completions.length;
  const draftActive = event.draftStatus === 'active' || event.draftStatus === 'paused';

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gold mb-1">{event.name}</h1>
        <div className="flex items-center gap-3 text-sm text-text-muted">
          <span className="bg-gold/15 text-gold px-2 py-0.5 rounded-full text-xs font-medium">
            {event.boardSize}x{event.boardSize}
          </span>
          <span>{teams.length} team{teams.length !== 1 ? 's' : ''}</span>
          <span>{totalCompleted} tile{totalCompleted !== 1 ? 's' : ''} completed</span>
        </div>

        {draftActive && (
          <Link
            href={`/events/${event.id}/draft`}
            className="inline-flex items-center gap-2 mt-3 text-sm font-medium bg-accent-green/15 text-accent-green-light border border-accent-green/25 px-3 py-1.5 rounded-lg hover:bg-accent-green/25 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-accent-green-light animate-pulse" />
            Draft in Progress — Watch Live
          </Link>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] items-start">
        <div>
          <h2 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Standings
          </h2>
          <Scoreboard
            teams={teams}
            totalTiles={tiles.length}
            completionCounts={completionCounts}
            eventId={event.id}
            dropProgressByTeam={dropProgressByTeam}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Board Overview
          </h2>
          <BingoBoard
            tiles={tiles}
            boardSize={event.boardSize}
            completions={completions}
            teams={teams}
          />
        </div>
      </div>
    </div>
  );
}

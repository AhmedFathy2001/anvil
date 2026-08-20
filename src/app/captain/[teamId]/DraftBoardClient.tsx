'use client';

import { useState, useEffect, useCallback } from 'react';
import DraftPlayerPool from '@/components/DraftPlayerPool';
import DraftStatus from '@/components/DraftStatus';
import DraftRosters from '@/components/DraftRosters';
import PlayerStatsPanel from '@/components/PlayerStatsPanel';
import type { SignupProfile } from '@/lib/signup';
import { clanFetch } from '@/lib/clanFetch';

interface Team {
  id: number;
  eventId: number;
  name: string;
  color: string;
}

interface Event {
  id: number;
  name: string;
  boardSize: number;
  createdAt: string;
  draftStatus: string;
}

interface Player {
  id: number;
  eventId: number;
  name: string;
  teamId: number | null;
  pickNumber: number | null;
  pickedAt: string | null;
  timezone?: string | null;
  profile?: SignupProfile | null;
}

interface DraftState {
  status: string;
  teamOrder: number[];
  players: Player[];
  teams: Team[];
  currentPickNumber: number;
  currentTeamId: number | null;
  round: number;
  pickInRound: number;
  totalPicked: number;
  poolRemaining: number;
}

interface Props {
  event: Event;
  team: Team;
}

export default function DraftBoardClient({ event, team }: Props) {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const [statsRsn, setStatsRsn] = useState<string | null>(null);

  const fetchDraft = useCallback(async () => {
    const res = await clanFetch(`/api/events/${event.id}/draft`);
    if (res.ok) {
      const data = await res.json();
      setDraft(data);
    }
  }, [event.id]);

  useEffect(() => {
    fetchDraft();
    const interval = setInterval(fetchDraft, 2500);
    return () => clearInterval(interval);
  }, [fetchDraft]);

  async function pickPlayer(playerId: number) {
    setPicking(true);
    setError('');
    const res = await clanFetch(`/api/events/${event.id}/draft/pick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to pick');
    }
    await fetchDraft();
    setPicking(false);
  }

  if (!draft) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-text-muted">Loading draft...</div>
      </div>
    );
  }

  const isMyTurn = draft.status === 'active' && draft.currentTeamId === team.id;
  const currentTeam = draft.teams.find((t) => t.id === draft.currentTeamId);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <div
          className="w-5 h-5 rounded-full ring-2 ring-offset-2 ring-offset-background"
          style={{ backgroundColor: team.color }}
        />
        <h1 className="text-2xl sm:text-3xl font-bold">{team.name}</h1>
        <span className="text-xs bg-accent-green/20 text-accent-green-light px-2 py-0.5 rounded-full font-medium">
          Captain
        </span>
      </div>
      <p className="text-text-muted text-sm mb-6">{event.name} &middot; Player Draft</p>

      <div className="space-y-6">
        <DraftStatus
          status={draft.status}
          currentTeamId={draft.currentTeamId}
          round={draft.round}
          pickInRound={draft.pickInRound}
          currentPickNumber={draft.currentPickNumber}
          totalPicked={draft.totalPicked}
          poolRemaining={draft.poolRemaining}
          teams={draft.teams}
          teamOrder={draft.teamOrder}
        />

        {/* Turn indicator */}
        {draft.status === 'active' && (
          <div
            className={`border rounded-xl p-4 text-center ${
              isMyTurn
                ? 'border-accent-green bg-accent-green/10'
                : 'border-card-border bg-card-bg'
            }`}
          >
            {isMyTurn ? (
              <p className="text-accent-green-light font-bold text-lg">
                It&apos;s your turn! Pick a player below.
              </p>
            ) : (
              <p className="text-text-muted">
                Waiting for{' '}
                <span className="font-semibold text-foreground" style={{ color: currentTeam?.color }}>
                  {currentTeam?.name ?? 'unknown team'}
                </span>
                {' '}to pick...
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="border border-red-400/30 bg-red-400/10 rounded-xl p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Player Pool */}
        {draft.poolRemaining > 0 && (
          <div>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-gold rounded-full" />
              Player Pool
            </h2>
            <DraftPlayerPool
              players={draft.players}
              teams={draft.teams}
              interactive={isMyTurn}
              onPick={pickPlayer}
              onPlayerClick={setStatsRsn}
              picking={picking}
            />
          </div>
        )}

        {/* Team Rosters */}
        <div>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-gold rounded-full" />
            Team Rosters
          </h2>
          <DraftRosters
            players={draft.players}
            teams={draft.teams}
            teamOrder={draft.teamOrder}
            onPlayerClick={setStatsRsn}
          />
        </div>
      </div>

      {statsRsn && (
        <PlayerStatsPanel rsn={statsRsn} onClose={() => setStatsRsn(null)} />
      )}
    </div>
  );
}

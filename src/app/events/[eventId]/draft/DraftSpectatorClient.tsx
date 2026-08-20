'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DraftPlayerPool from '@/components/DraftPlayerPool';
import DraftStatus from '@/components/DraftStatus';
import DraftRosters from '@/components/DraftRosters';
import PlayerStatsPanel from '@/components/PlayerStatsPanel';
import { clanFetch } from '@/lib/clanFetch';

interface Event {
  id: number;
  name: string;
  boardSize: number;
  createdAt: string;
  draftStatus: string;
}

interface Team {
  id: number;
  eventId: number;
  name: string;
  color: string;
}

interface Player {
  id: number;
  eventId: number;
  name: string;
  teamId: number | null;
  pickNumber: number | null;
  pickedAt: string | null;
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
}

export default function DraftSpectatorClient({ event }: Props) {
  const [draft, setDraft] = useState<DraftState | null>(null);
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

  if (!draft) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-text-muted">Loading draft...</div>
      </div>
    );
  }

  const currentTeam = draft.teams.find((t) => t.id === draft.currentTeamId);

  return (
    <div>
      <Link
        href={`/events/${event.id}`}
        className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-4"
      >
        &larr; Back to event
      </Link>

      <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">{event.name}</h1>
      <p className="text-text-muted text-sm mb-6">Player Draft — Spectator View</p>

      {draft.status === 'none' && (
        <div className="text-center py-12 border border-dashed border-card-border rounded-xl">
          <p className="text-text-muted">Draft has not started yet.</p>
        </div>
      )}

      {(draft.status === 'active' || draft.status === 'paused' || draft.status === 'completed') && (
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

          {/* Pick log — last 5 picks */}
          {draft.totalPicked > 0 && (
            <div className="border border-card-border rounded-xl p-4 bg-card-bg">
              <h3 className="font-bold text-sm mb-2">Recent Picks</h3>
              <div className="space-y-1">
                {draft.players
                  .filter((p) => p.teamId !== null)
                  .sort((a, b) => (b.pickNumber ?? 0) - (a.pickNumber ?? 0))
                  .slice(0, 5)
                  .map((p) => {
                    const pTeam = draft.teams.find((t) => t.id === p.teamId);
                    return (
                      <div key={p.id} className="flex items-center gap-2 text-sm">
                        <span className="text-xs font-mono text-text-muted w-5 text-right">
                          #{(p.pickNumber ?? 0) + 1}
                        </span>
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: pTeam?.color }}
                        />
                        <span className="text-foreground">{p.name}</span>
                        <span className="text-text-muted text-xs">&rarr; {pTeam?.name}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Player Pool */}
          {draft.poolRemaining > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-gold rounded-full" />
                Player Pool ({draft.poolRemaining} remaining)
              </h2>
              <DraftPlayerPool
                players={draft.players}
                teams={draft.teams}
                interactive={false}
                onPlayerClick={setStatsRsn}
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
      )}
      {statsRsn && (
        <PlayerStatsPanel rsn={statsRsn} onClose={() => setStatsRsn(null)} />
      )}
    </div>
  );
}

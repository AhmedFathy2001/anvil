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
  trackedStat?: string | null;
  statType?: string | null;
  statGoal?: number | null;
  trackingMode?: string;
  womCompetitionId?: number | null;
}

interface TileWomTeamStanding {
  rank: number;
  womTeamName: string;
  localTeamId: number | null;
  localTeamName: string | null;
  color: string | null;
  totalGained: number;
  mvp: string;
}

interface TileWomPlayerStanding {
  rank: number;
  womPlayerName: string;
  localPlayerName: string | null;
  localTeamName: string | null;
  color: string | null;
  gained: number;
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
  womCompetitionId?: number | null;
}

interface WomTeamStanding {
  rank: number;
  womTeamName: string;
  localTeamId: number | null;
  localTeamName: string | null;
  color: string | null;
  playerCount: number;
  totalGained: number;
  averageGained: number;
  mvp: string;
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
  const [womStandings, setWomStandings] = useState<WomTeamStanding[]>([]);
  const [womLoading, setWomLoading] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hideStandings, setHideStandings] = useState(false);
  const [tileWomTeams, setTileWomTeams] = useState<TileWomTeamStanding[]>([]);
  const [tileWomPlayers, setTileWomPlayers] = useState<TileWomPlayerStanding[]>([]);
  const [tileWomLoading, setTileWomLoading] = useState(false);

  const selectedTile = selectedTileId ? tiles.find((t) => t.id === selectedTileId) : null;
  const selectedTileCompletions = selectedTileId
    ? completions.filter((c) => c.tileId === selectedTileId)
    : [];

  // Fetch tile-level WOM data when selecting a tile with WOM linked
  useEffect(() => {
    if (!selectedTile?.womCompetitionId) {
      setTileWomTeams([]);
      setTileWomPlayers([]);
      return;
    }

    setTileWomLoading(true);
    fetch(`/api/events/${event.id}/tiles/${selectedTile.id}/wom`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setTileWomTeams(data.teams || []);
          setTileWomPlayers(data.players || []);
        }
      })
      .finally(() => setTileWomLoading(false));
  }, [selectedTile?.id, selectedTile?.womCompetitionId, event.id]);

  useEffect(() => {
    fetch(`/api/events/${event.id}/submissions`)
      .then((r) => r.ok ? r.json() : [])
      .then(setSubmissions);
  }, [event.id]);

  useEffect(() => {
    if (!event.womCompetitionId) return;
    setWomLoading(true);
    fetch(`/api/events/${event.id}/wom`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.teams) setWomStandings(data.teams);
      })
      .finally(() => setWomLoading(false));
  }, [event.id, event.womCompetitionId]);

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

        {/* View controls */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              expanded
                ? 'bg-gold/20 border-gold text-gold'
                : 'border-card-border text-text-muted hover:border-gold/50 hover:text-gold'
            }`}
          >
            {expanded ? 'Collapse Board' : 'Expand Board'}
          </button>
          <button
            onClick={() => setHideStandings(!hideStandings)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              hideStandings
                ? 'bg-gold/20 border-gold text-gold'
                : 'border-card-border text-text-muted hover:border-gold/50 hover:text-gold'
            }`}
          >
            {hideStandings ? 'Show Standings' : 'Hide Standings'}
          </button>
        </div>
      </div>

      <div className={`grid gap-8 items-start ${hideStandings ? '' : 'lg:grid-cols-[1fr_1.2fr]'}`}>
        {!hideStandings && (
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

            {/* WOM Standings */}
            {event.womCompetitionId && (
              <div className="mt-6">
                <h3 className="text-md font-bold mb-3 text-foreground flex items-center gap-2">
                  <span className="w-1 h-4 bg-indigo-400 rounded-full" />
                  XP Gains (WOM)
                </h3>
                {womLoading ? (
                  <p className="text-sm text-text-muted">Loading WOM data...</p>
                ) : womStandings.length > 0 ? (
                  <div className="space-y-2">
                    {womStandings.map((ws) => (
                      <div
                        key={ws.rank}
                        className="flex items-center justify-between border border-card-border rounded-lg p-3 bg-card-bg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-gold w-6">#{ws.rank}</span>
                          {ws.color && (
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ws.color }} />
                          )}
                          <span className="font-medium">{ws.localTeamName || ws.womTeamName}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-indigo-400">
                            {ws.totalGained.toLocaleString()}
                          </span>
                          <span className="text-xs text-text-muted ml-1">XP</span>
                          <div className="text-xs text-text-muted">
                            MVP: {ws.mvp}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">No WOM data available</p>
                )}
                <a
                  href={`https://wiseoldman.net/competitions/${event.womCompetitionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs text-indigo-400 hover:text-indigo-300 underline"
                >
                  View on Wise Old Man →
                </a>
              </div>
            )}
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Board Overview
            <span className="text-xs font-normal text-text-muted ml-2">(click tiles for details)</span>
          </h2>
          <BingoBoard
            tiles={tiles}
            boardSize={event.boardSize}
            completions={completions}
            teams={teams}
            onTileClick={setSelectedTileId}
            expanded={expanded}
          />
        </div>
      </div>

      {/* Tile Detail Modal */}
      {selectedTile && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTileId(null)}
        >
          <div
            className="bg-brown-dark border border-card-border rounded-xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gold">{selectedTile.label}</h3>
                <span className="text-xs text-text-muted">Tile #{selectedTile.position + 1}</span>
              </div>
              <button
                onClick={() => setSelectedTileId(null)}
                className="text-text-muted hover:text-foreground transition-colors text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {selectedTile.description && (
              <p className="text-sm text-foreground mb-4">{selectedTile.description}</p>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-text-muted">Type:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  selectedTile.tileType === 'drop'
                    ? 'bg-accent-green/20 text-accent-green-light'
                    : 'bg-gold/15 text-gold'
                }`}>
                  {selectedTile.tileType === 'drop' ? 'Drop' : 'Standard'}
                </span>
              </div>

              {selectedTile.tileType === 'drop' && selectedTile.requiredAmount && (
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">Required:</span>
                  <span className="text-accent-green-light font-medium">{selectedTile.requiredAmount}</span>
                </div>
              )}

              {selectedTile.trackedStat && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">Tracked:</span>
                    <span className="text-gold font-medium capitalize">{selectedTile.trackedStat}</span>
                  </div>
                  {selectedTile.statGoal && (
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted">Goal:</span>
                      <span className="text-foreground">{selectedTile.statGoal.toLocaleString()} {selectedTile.statType === 'skill' ? 'XP' : 'KC'}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">Mode:</span>
                    <span className="text-foreground capitalize">{selectedTile.trackingMode || 'team'}</span>
                  </div>
                </>
              )}
            </div>

            {/* Completions */}
            <div className="mt-4 pt-4 border-t border-card-border">
              <h4 className="text-sm font-semibold text-foreground mb-2">
                Completed by ({selectedTileCompletions.length})
              </h4>
              {selectedTileCompletions.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedTileCompletions.map((c) => {
                    const team = teams.find((t) => t.id === c.teamId);
                    return (
                      <div key={c.id} className="flex items-center gap-2 text-sm">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: team?.color || '#888' }}
                        />
                        <span className="text-foreground">{team?.name || 'Unknown'}</span>
                        <span className="text-text-muted text-xs ml-auto">
                          {new Date(c.completedAt).toLocaleDateString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-muted">No completions yet</p>
              )}
            </div>

            {/* Tile WOM Standings */}
            {selectedTile.womCompetitionId && (
              <div className="mt-4 pt-4 border-t border-card-border">
                <h4 className="text-sm font-semibold text-indigo-400 mb-2 flex items-center gap-2">
                  <span className="w-1 h-3 bg-indigo-400 rounded-full" />
                  WOM Competition Progress
                </h4>
                {tileWomLoading ? (
                  <p className="text-xs text-text-muted">Loading WOM data...</p>
                ) : tileWomTeams.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {tileWomTeams.map((wt) => (
                      <div
                        key={wt.rank}
                        className="flex items-center justify-between text-sm bg-card-bg rounded p-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gold w-5">#{wt.rank}</span>
                          {wt.color && (
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: wt.color }} />
                          )}
                          <span className="text-foreground text-xs">{wt.localTeamName || wt.womTeamName}</span>
                        </div>
                        <span className="text-indigo-400 font-medium text-xs">
                          {wt.totalGained.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">No WOM data available</p>
                )}
                <a
                  href={`https://wiseoldman.net/competitions/${selectedTile.womCompetitionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-[10px] text-indigo-400 hover:text-indigo-300 underline"
                >
                  View on Wise Old Man →
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

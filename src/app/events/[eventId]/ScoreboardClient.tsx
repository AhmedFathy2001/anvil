'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import EventBoard from '@/components/EventBoard';
import Scoreboard from '@/components/Scoreboard';
import LocalTime from '@/components/LocalTime';
import { formatNumber, tileWeight, isPointsMode, eventShapeBadge } from '@/lib/utils';
import { TILE_TIERS, tileTier, tileCategories, type TileTierKey } from '@/lib/tileFilter';

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
  optional?: number | null;
  points?: number | null;
  category?: string | null;
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
  startDate?: string | null;
  endDate?: string | null;
  forceEndedAt?: string | null;
  scoringMode?: string;
  format?: string;
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

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'Now';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

interface TeamGains {
  teamId: number;
  totalGained: number;
  tileGains: Record<number, number>; // tileId -> gained
}

export default function ScoreboardClient({ event, tiles, teams, completions }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [timeDisplay, setTimeDisplay] = useState<string>('');
  const [teamGains, setTeamGains] = useState<TeamGains[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<'all' | TileTierKey>('all');

  const selectedTile = selectedTileId ? tiles.find((t) => t.id === selectedTileId) : null;
  const selectedTileCompletions = selectedTileId
    ? completions.filter((c) => c.tileId === selectedTileId)
    : [];

  // Countdown / time remaining timer
  useEffect(() => {
    const updateTime = () => {
      if (event.forceEndedAt) {
        setTimeDisplay('Event force-ended');
        return;
      }

      const now = Date.now();

      if (event.startDate) {
        const start = new Date(event.startDate).getTime();
        if (now < start) {
          setTimeDisplay(`Starts in ${formatTimeLeft(start - now)}`);
          return;
        }
      }

      if (event.endDate) {
        const end = new Date(event.endDate).getTime();
        if (now < end) {
          setTimeDisplay(`${formatTimeLeft(end - now)} remaining`);
          return;
        } else {
          setTimeDisplay('Event ended');
          return;
        }
      }

      setTimeDisplay('');
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [event.startDate, event.endDate, event.forceEndedAt]);

  useEffect(() => {
    fetch(`/api/events/${event.id}/submissions`)
      .then((r) => r.ok ? r.json() : [])
      .then(setSubmissions);
  }, [event.id]);

  // Fetch gains data for all teams (for stat tiles)
  useEffect(() => {
    const statTiles = tiles.filter((t) => t.trackedStat && t.statGoal);
    if (statTiles.length === 0) return;

    // Fetch gains for all teams in parallel
    Promise.all(
      teams.map(async (team) => {
        const res = await fetch(`/api/events/${event.id}/gains?teamId=${team.id}`);
        if (!res.ok) return null;
        const data = await res.json();

        // Aggregate gains by tile
        const tileGains: Record<number, number> = {};
        let totalGained = 0;

        for (const tile of statTiles) {
          let tileTotal = 0;
          for (const player of data) {
            const gained = player.gains?.[tile.trackedStat!] ?? 0;
            tileTotal += gained;
          }
          tileGains[tile.id] = tileTotal;
          totalGained += tileTotal;
        }

        return { teamId: team.id, totalGained, tileGains };
      })
    ).then((results) => {
      setTeamGains(results.filter((r): r is TeamGains => r !== null));
    });
  }, [event.id, teams, tiles]);

  // Exclude optional tiles from completion counts
  const pointsMode = isPointsMode(event.scoringMode);
  const requiredTiles = tiles.filter((t) => !t.optional);
  // Weight per tile: its point value in points mode, 1 in classic mode. A team's
  // score is the summed weight of the required tiles it has completed, and the
  // "total" the scoreboard divides against is the summed weight of all required tiles.
  const weightById = new Map(requiredTiles.map((t) => [t.id, tileWeight(event.scoringMode, t.points)]));
  const totalWeight = requiredTiles.reduce((sum, t) => sum + tileWeight(event.scoringMode, t.points), 0);

  const completionCounts = new Map<number, number>();
  for (const c of completions) {
    // Only count completions of required (non-optional) tiles
    const w = weightById.get(c.tileId);
    if (w !== undefined) {
      completionCounts.set(c.teamId, (completionCounts.get(c.teamId) || 0) + w);
    }
  }

  // Build drop progress by team (only for required tiles)
  const dropProgressByTeam = new Map<number, { inProgress: number; total: number }>();
  const dropTiles = tiles.filter((t) => t.tileType === 'drop' && t.requiredAmount && !t.optional);
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

  // Build stat progress map for tiles (aggregated across all teams for overview)
  const statProgressMap = new Map<number, { current: number; goal: number; statType?: string }>();
  const statTiles = tiles.filter((t) => t.trackedStat && t.statGoal);
  for (const tile of statTiles) {
    // Get max progress across all teams for overview
    let maxGained = 0;
    for (const tg of teamGains) {
      const gained = tg.tileGains[tile.id] || 0;
      if (gained > maxGained) maxGained = gained;
    }
    statProgressMap.set(tile.id, {
      current: maxGained,
      goal: tile.statGoal!,
      statType: tile.statType || undefined,
    });
  }

  const totalCompleted = completions.length;
  const draftActive = event.draftStatus === 'active' || event.draftStatus === 'paused';

  // Board filters — by content category and by difficulty tier (derived from points).
  const categories = tileCategories(tiles);
  const filterActive = categoryFilter !== 'all' || tierFilter !== 'all';
  const matchedTileIds = filterActive
    ? new Set(
        tiles
          .filter((t) => categoryFilter === 'all' || (t.category?.trim() || '') === categoryFilter)
          .filter((t) => tierFilter === 'all' || tileTier(t.points) === tierFilter)
          .map((t) => t.id),
      )
    : null;
  // Tier bands only make sense when tiles carry distinct point values.
  const showTierFilter = pointsMode;
  const showFilters = categories.length > 0 || showTierFilter;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gold mb-1">{event.name}</h1>
        <div className="flex items-center gap-3 text-sm text-text-muted">
          <span className="bg-gold/15 text-gold px-2 py-0.5 rounded-full text-xs font-medium">
            {eventShapeBadge(event.format, event.scoringMode, event.boardSize)}
          </span>
          {pointsMode && (
            <span className="bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded-full text-xs font-medium">
              {totalWeight} pts on the board
            </span>
          )}
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

        {/* Time display and view controls */}
        <div className="flex items-center gap-3 mt-4">
          {timeDisplay && (
            <span className={`text-sm font-medium px-3 py-1.5 rounded-lg ${
              timeDisplay.includes('Starts')
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                : timeDisplay.includes('remaining')
                ? 'bg-accent-green/15 text-accent-green-light border border-accent-green/25'
                : 'bg-red-500/15 text-red-400 border border-red-500/25'
            }`}>
              {timeDisplay}
            </span>
          )}
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              fullscreen
                ? 'bg-gold/20 border-gold text-gold'
                : 'border-card-border text-text-muted hover:border-gold/50 hover:text-gold'
            }`}
          >
            {fullscreen ? 'Show Standings' : 'Fullscreen Board'}
          </button>
        </div>
      </div>

      <div className={`grid gap-8 items-start ${fullscreen ? '' : 'lg:grid-cols-[1fr_1.2fr]'}`}>
        {!fullscreen && (
          <div>
            <h2 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2">
              <span className="w-1 h-5 bg-gold rounded-full" />
              Standings
            </h2>
            <Scoreboard
              teams={teams}
              totalTiles={pointsMode ? totalWeight : requiredTiles.length}
              completionCounts={completionCounts}
              eventId={event.id}
              dropProgressByTeam={dropProgressByTeam}
              pointsMode={pointsMode}
            />

            {/* XP/Stat Gains */}
            {statTiles.length > 0 && teamGains.length > 0 && (
              <div className="mt-6">
                <h3 className="text-md font-bold mb-3 text-foreground flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-400 rounded-full" />
                  XP/Stat Gains
                </h3>
                <div className="space-y-2">
                  {[...teamGains]
                    .sort((a, b) => b.totalGained - a.totalGained)
                    .map((tg, index) => {
                      const team = teams.find((t) => t.id === tg.teamId);
                      return (
                        <div
                          key={tg.teamId}
                          className="flex items-center justify-between border border-card-border rounded-lg p-3 bg-card-bg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-gold w-6">#{index + 1}</span>
                            {team?.color && (
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                            )}
                            <span className="font-medium">{team?.name || 'Unknown'}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-blue-400">
                              {formatNumber(tg.totalGained)}
                            </span>
                            <span className="text-xs text-text-muted ml-1">XP</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
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

          {showFilters && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
              {categories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="shrink-0 text-xs px-2.5 py-1.5 bg-brown-dark border border-card-border rounded-lg text-foreground focus:border-gold/50 focus:outline-none"
                  aria-label="Filter board by category"
                >
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
              {showTierFilter && (
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                  <button
                    onClick={() => setTierFilter('all')}
                    className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                      tierFilter === 'all'
                        ? 'bg-gold/20 border-gold text-gold'
                        : 'border-card-border text-text-muted hover:border-gold/40'
                    }`}
                  >
                    All tiers
                  </button>
                  {TILE_TIERS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTierFilter(t.key)}
                      className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                        tierFilter === t.key
                          ? 'bg-gold/20 border-gold text-gold'
                          : 'border-card-border text-text-muted hover:border-gold/40'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
              {filterActive && (
                <button
                  onClick={() => {
                    setCategoryFilter('all');
                    setTierFilter('all');
                  }}
                  className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg text-text-muted hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          <EventBoard
            format={event.format}
            tiles={tiles}
            boardSize={event.boardSize}
            completions={completions}
            teams={teams}
            onTileClick={setSelectedTileId}
            statProgress={statProgressMap}
            expanded={fullscreen}
            pointsMode={pointsMode}
            matchedTileIds={matchedTileIds}
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
            className="bg-brown-dark border border-card-border rounded-xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
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
              {pointsMode && !selectedTile.optional && (
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">Points:</span>
                  <span className="text-purple-300 font-medium">{selectedTile.points ?? 1}</span>
                </div>
              )}
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

            {/* Local Stat Progress by Team */}
            {selectedTile.trackedStat && selectedTile.statGoal && teamGains.length > 0 && (
              <div className="mt-4 pt-4 border-t border-card-border">
                <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                  <span className="w-1 h-3 bg-blue-400 rounded-full" />
                  Team Progress (Local)
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {[...teamGains]
                    .map((tg) => ({ ...tg, tileGain: tg.tileGains[selectedTile.id] || 0 }))
                    .sort((a, b) => b.tileGain - a.tileGain)
                    .map((tg) => {
                      const team = teams.find((t) => t.id === tg.teamId);
                      const percentage = Math.min(100, (tg.tileGain / selectedTile.statGoal!) * 100);
                      return (
                        <div
                          key={tg.teamId}
                          className="bg-card-bg rounded-lg p-2"
                        >
                          <div className="flex items-center justify-between text-sm mb-1">
                            <div className="flex items-center gap-2">
                              {team?.color && (
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.color }} />
                              )}
                              <span className="text-foreground text-xs">{team?.name || 'Unknown'}</span>
                            </div>
                            <span className="text-blue-400 font-medium text-xs">
                              {formatNumber(tg.tileGain)} / {formatNumber(selectedTile.statGoal!)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-brown-dark rounded-full overflow-hidden">
                            <div
                              className="h-full transition-all duration-500"
                              style={{
                                width: `${percentage}%`,
                                background: percentage >= 100
                                  ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                                  : 'linear-gradient(90deg, #3b82f6cc, #3b82f6)',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Completions */}
            <div className="mt-4 pt-4 border-t border-card-border">
              <h4 className="text-sm font-semibold text-foreground mb-2">
                Completed by ({selectedTileCompletions.length})
              </h4>
              {selectedTileCompletions.length > 0 ? (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
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
                          <LocalTime date={c.completedAt} format="date" />
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-muted">No completions yet</p>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

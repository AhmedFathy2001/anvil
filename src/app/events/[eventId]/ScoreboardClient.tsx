'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import EventBoard from '@/components/EventBoard';
import Scoreboard from '@/components/Scoreboard';
import Select from '@/components/Select';
import TileDetailModal from '@/components/TileDetailModal';
import { eventTimeState, formatCountdown, formatExactTime } from '@/lib/eventTime';
import { formatNumber, tileWeight, isPointsMode, eventShapeBadge } from '@/lib/utils';
import { tileTierKey, tileCategories, tileHasCategory, tierColor, DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';
import type { Tile as FullTile } from '@/lib/types';
import type { EventMvp } from '@/lib/memberBreakdown';

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
  // Tracking-target columns rendered by TileTargets (the page passes full DB rows).
  trackedItemIds?: string | null;
  itemRequirements?: string | null;
  sourceNpcs?: string | null;
  targetNpcs?: string | null;
  timedActivity?: string | null;
  timeThresholdSeconds?: number | null;
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
  tierBands?: TierBand[];
  mvp?: EventMvp | null;
}

type TimeTone = 'starts' | 'ends' | 'ended';
interface TimeInfo {
  tone: TimeTone;
  /** Primary status line (live countdown when imminent, else exact time). */
  text: string;
  /** Exact time kept visible while counting down; null when text is already exact. */
  exact: string | null;
}

interface TeamGains {
  teamId: number;
  totalGained: number;
  tileGains: Record<number, number>; // tileId -> gained
}

export default function ScoreboardClient({ event, tiles, teams, completions, tierBands = DEFAULT_TIER_BANDS, mvp = null }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [timeInfo, setTimeInfo] = useState<TimeInfo | null>(null);
  const [teamGains, setTeamGains] = useState<TeamGains[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const selectedTile = selectedTileId ? tiles.find((t) => t.id === selectedTileId) : null;
  const selectedTileCompletions = selectedTileId
    ? completions.filter((c) => c.tileId === selectedTileId)
    : [];

  // Shows the exact start/end time, switching to a live countdown within 24h.
  useEffect(() => {
    const updateTime = () => {
      const now = Date.now();
      const state = eventTimeState({
        startDate: event.startDate,
        endDate: event.endDate,
        forceEndedAt: event.forceEndedAt,
        now,
      });

      if (state.phase === 'force-ended') {
        setTimeInfo({ tone: 'ended', text: 'Event force-ended', exact: null });
        return;
      }
      if (state.phase === 'ended') {
        setTimeInfo({ tone: 'ended', text: 'Event ended', exact: null });
        return;
      }
      if (state.target === null) {
        setTimeInfo(null);
        return;
      }

      const exact = formatExactTime(state.target);
      if (state.phase === 'upcoming') {
        // Always count down to the start (days/hours/mins), with the exact time underneath — an
        // upcoming bingo should show how long until kickoff, not just a static date.
        setTimeInfo({ tone: 'starts', text: `Starts in ${formatCountdown(state.target - now)}`, exact });
        return;
      }
      // active
      setTimeInfo(
        state.imminent
          ? { tone: 'ends', text: `Ends in ${formatCountdown(state.target - now)}`, exact }
          : { tone: 'ends', text: `Ends ${exact}`, exact: null },
      );
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

  // Board filters — by text search, content category, and difficulty tier (derived from points).
  const categories = tileCategories(tiles);
  const search = searchQuery.trim().toLowerCase();
  const filterActive = categoryFilter !== 'all' || tierFilter !== 'all' || search !== '';
  const matchedTileIds = filterActive
    ? new Set(
        tiles
          .filter((t) => categoryFilter === 'all' || tileHasCategory(t.category, categoryFilter))
          .filter((t) => tierFilter === 'all' || tileTierKey(t.points, tierBands) === tierFilter)
          .filter(
            (t) =>
              search === '' ||
              t.label.toLowerCase().includes(search) ||
              (t.description?.toLowerCase().includes(search) ?? false),
          )
          .map((t) => t.id),
      )
    : null;
  // Tier bands only make sense when tiles carry distinct point values.
  const showTierFilter = pointsMode && tierBands.length > 0;
  const showFilters = categories.length > 0 || showTierFilter;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1 break-words">{event.name}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
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
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {timeInfo && (
            <span className={`text-sm font-medium px-3 py-1.5 rounded-lg ${
              timeInfo.tone === 'starts'
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                : timeInfo.tone === 'ends'
                ? 'bg-accent-green/15 text-accent-green-light border border-accent-green/25'
                : 'bg-red-500/15 text-red-400 border border-red-500/25'
            }`}>
              {timeInfo.text}
              {timeInfo.exact && <span className="opacity-60 font-normal"> · {timeInfo.exact}</span>}
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

      {mvp && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-gold/30 bg-gradient-to-r from-gold/10 to-transparent p-3 sm:p-4">
          <span className="text-2xl shrink-0" aria-hidden>🏆</span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gold/70">Event MVP</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base sm:text-lg font-bold text-foreground truncate">{mvp.name}</span>
              <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: mvp.teamColor }} aria-hidden />
                {mvp.teamName}
              </span>
            </div>
          </div>
          <div className="ml-auto text-right shrink-0">
            {pointsMode ? (
              <>
                <div className="text-lg sm:text-xl font-bold text-gold tabular-nums">{mvp.points.toLocaleString()} pts</div>
                <div className="text-xs text-text-muted tabular-nums">{mvp.tasks} task{mvp.tasks !== 1 ? 's' : ''}</div>
              </>
            ) : (
              <div className="text-lg sm:text-xl font-bold text-gold tabular-nums">{mvp.tasks} task{mvp.tasks !== 1 ? 's' : ''}</div>
            )}
          </div>
        </div>
      )}

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

          <div className="relative mb-3">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tiles…"
              className="w-full text-sm pl-9 pr-9 py-2 bg-brown-dark border border-card-border rounded-lg text-foreground placeholder:text-text-muted focus:border-gold/50 focus:outline-none"
              aria-label="Search tiles"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground text-lg leading-none w-9 h-9 flex items-center justify-center"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {showFilters && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
              {categories.length > 0 && (
                <Select
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={[{ value: 'all', label: 'All categories' }, ...categories.map((c) => ({ value: c, label: c }))]}
                  ariaLabel="Filter board by category"
                  className="shrink-0 sm:w-48"
                />
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
                  {tierBands.map((t, i) => (
                    <button
                      key={t.key}
                      onClick={() => setTierFilter(t.key)}
                      className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border transition-colors inline-flex items-center gap-1.5 ${
                        tierFilter === t.key
                          ? 'bg-gold/20 border-gold text-gold'
                          : 'border-card-border text-text-muted hover:border-gold/40'
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: tierColor(i, tierBands.length) }}
                        aria-hidden
                      />
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

      {/* Read-only tile detail — the same rich modal members and captains see, now shown to
          public/logged-out viewers. Cross-team submission proof is withheld (submissions=[]);
          per-team stat comparison is passed through so the scoreboard keeps its team race view. */}
      {selectedTile && (
        <TileDetailModal
          tile={selectedTile as unknown as FullTile}
          submissions={[]}
          completedBy={selectedTileCompletions.map((c) => {
            const team = teams.find((t) => t.id === c.teamId);
            return { teamId: c.teamId, teamName: team?.name || 'Unknown', color: team?.color || '#888' };
          })}
          canSubmit={false}
          canManage={false}
          canToggle={false}
          onClose={() => setSelectedTileId(null)}
          eventId={event.id}
          teamStatProgress={
            selectedTile.trackedStat && selectedTile.statGoal
              ? teamGains.map((tg) => {
                  const team = teams.find((t) => t.id === tg.teamId);
                  return {
                    teamId: tg.teamId,
                    teamName: team?.name || 'Unknown',
                    color: team?.color || '#888',
                    gained: tg.tileGains[selectedTile.id] || 0,
                  };
                })
              : undefined
          }
          pointsMode={pointsMode}
        />
      )}
    </div>
  );
}

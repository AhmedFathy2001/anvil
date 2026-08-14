'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import EventBoard from '@/components/EventBoard';
import Scoreboard from '@/components/Scoreboard';
import Select from '@/components/Select';
import TileDetailModal from '@/components/TileDetailModal';
import { formatNumber, tileWeight, isPointsMode, isLadderFormat } from '@/lib/utils';
import { tileTierKey, tileCategories, tileHasCategory, tierColor, DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';
import { boardTiles, missionTiles, parseEventRules } from '@/lib/eventRules';
import { eventAxes, taskNoun } from '@/lib/eventAxes';
import LiveDropBoard from '@/components/LiveDropBoard';
import type { Tile as FullTile, Submission as FullSubmission } from '@/lib/types';
import type { EventMvp, TeamMvp, IndividualStanding } from '@/lib/memberBreakdown';
import MvpHighlight from '@/components/MvpHighlight';
import LadderStandings from '@/components/LadderStandings';

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
  // Mission/reveal state — drives the split between the board and its missions.
  mission?: number | null;
  revealedAt?: string | null;
  closedAt?: string | null;
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
  // Frozen rule-modified award (first bonus / reveal decay) — wins over the live tile weight.
  awardedPoints?: number | null;
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
  /** Per-event rules JSON (lib/eventRules) — reveal policy + decay drive the live board. */
  rules?: string | null;
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
  mvpToday?: EventMvp | null;
  teamMvps?: Record<number, TeamMvp | null>;
  // Reveal-policy events (lib/eventRules): tiles the viewer can't see yet + when the next lands.
  hiddenTileCount?: number;
  nextRevealAt?: string | null;
  /**
   * Staff viewing a reveal-policy board see EVERY tile, including ones members can't. Without this
   * the page looked identical to a fully-revealed board while its own banner said tiles were hidden.
   */
  staffOnlyTileIds?: number[];
  // Ladder events: the event-wide individual leaderboard (primary standings). `ladderHasTeams` = the
  // event runs real multi-person teams, so rows carry a team label and the team board also shows.
  individualStandings?: IndividualStanding[];
  individualStandingsMonthly?: IndividualStanding[];
  ladderHasTeams?: boolean;
}

interface TeamGains {
  teamId: number;
  totalGained: number;
  tileGains: Record<number, number>; // tileId -> gained
}

export default function ScoreboardClient({ event, tiles, teams, completions, tierBands = DEFAULT_TIER_BANDS, mvp = null, mvpToday = null, teamMvps = {}, hiddenTileCount = 0, nextRevealAt = null, staffOnlyTileIds = [], individualStandings = [], individualStandingsMonthly = [], ladderHasTeams = false }: Props) {
  // Standings rank people, not teams — that's the individuals axis, not "is this a ladder".
  const ladder = eventAxes(event).competitors === 'individuals';
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [teamGains, setTeamGains] = useState<TeamGains[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Proof for the tile the viewer opened. The board itself only needs the light projection above,
  // and a busy event has thousands of submissions, so the full rows (screenshot, note, who credited
  // it) are fetched per tile on open. Without this the public board passed an empty list and the
  // modal had no proof to show — which had no workaround at all on a ladder, where "go look at the
  // team page" isn't a place that exists.
  // Stamped with the tile it belongs to rather than cleared on close: that way the modal can only
  // ever show proof for the tile actually open, with no flash of the previous one's while the next
  // is in flight — and the effect never has to setState just to reset.
  const [tileProof, setTileProof] = useState<{ tileId: number; rows: FullSubmission[] } | null>(null);
  useEffect(() => {
    if (!selectedTileId) return;
    let cancelled = false;
    const tileId = selectedTileId;
    // Capped: a kill tile on a busy board can hold thousands of auto-logs, and the panel only ever
    // shows totals per contributor plus their proof. The API's own ceiling is 500.
    fetch(`/api/events/${event.id}/submissions?tileId=${tileId}&limit=500`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: FullSubmission[]) => {
        if (!cancelled) setTileProof({ tileId, rows: Array.isArray(rows) ? rows : [] });
      })
      .catch(() => {
        if (!cancelled) setTileProof({ tileId, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTileId, event.id]);
  const proofForOpenTile = tileProof && tileProof.tileId === selectedTileId ? tileProof.rows : null;

  const staffOnlySet = useMemo(
    () => (staffOnlyTileIds.length > 0 ? new Set(staffOnlyTileIds) : null),
    [staffOnlyTileIds],
  );

  const selectedTile = selectedTileId ? tiles.find((t) => t.id === selectedTileId) : null;
  const selectedTileCompletions = selectedTileId
    ? completions.filter((c) => c.tileId === selectedTileId)
    : [];

  const router = useRouter();

  const refetchSubmissions = useCallback(() => {
    fetch(`/api/events/${event.id}/submissions`)
      .then((r) => r.ok ? r.json() : [])
      .then(setSubmissions)
      .catch(() => {});
  }, [event.id]);

  const refetchGains = useCallback(() => {
    const statTiles = tiles.filter((t) => t.trackedStat && t.statGoal);
    if (statTiles.length === 0) return;
    // Fetch gains for all teams in parallel, aggregate by tile.
    Promise.all(
      teams.map(async (team) => {
        const res = await fetch(`/api/events/${event.id}/gains?teamId=${team.id}`);
        if (!res.ok) return null;
        const data = await res.json();
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
    }).catch(() => {});
  }, [event.id, teams, tiles]);

  useEffect(() => { refetchSubmissions(); }, [refetchSubmissions]);
  useEffect(() => { refetchGains(); }, [refetchGains]);

  // Semi-realtime: on tab-focus (throttled) poll a tiny pulse endpoint; only when the board actually
  // changes do we pull fresh data — router.refresh() for the server-rendered standings/completions,
  // plus the client-side submissions/gains. An unchanged board is a 304 (no body), so it's cheap.
  const onBoardChange = useCallback(() => {
    router.refresh();
    refetchSubmissions();
    refetchGains();
  }, [router, refetchSubmissions, refetchGains]);
  useLiveRefresh({ url: `/api/events/${event.id}/pulse`, onChange: onBoardChange });

  // The board and the missions are two different things (see lib/eventRules.boardTiles): a mission
  // drops mid-event from its own pool, scores under its own rules and can expire unclaimed, so
  // folding one into the tile list moves the denominator under everyone the moment it's announced.
  const board = useMemo(() => boardTiles(tiles), [tiles]);
  const eventRules = useMemo(() => parseEventRules(event.rules), [event.rules]);
  const axes = useMemo(() => eventAxes({ ...event, rules: eventRules }), [event, eventRules]);
  // A board whose tasks open and close on a clock is a different surface from a bingo grid: two
  // things are open, one is losing value, the next drops in eleven minutes. Search and tier filters
  // are furniture at that size — the clock is the content. `live` covers every reveal policy, so a
  // lucky draw and a bounty rotation get it too, not just a ladder.
  const liveDropBoard = axes.live;
  // Only ANNOUNCED missions are worth a section — an unannounced one is either invisible (members)
  // or already flagged staff-only on the board (staff).
  const missions = useMemo(() => missionTiles(tiles).filter((t) => t.revealedAt), [tiles]);

  // Exclude optional tiles from completion counts
  const pointsMode = isPointsMode(event.scoringMode);
  const requiredTiles = board.filter((t) => !t.optional);
  // Weight per tile: its point value in points mode, 1 in classic mode. A team's
  // score is the summed weight of the required tiles it has completed, and the
  // "total" the scoreboard divides against is the summed weight of all required tiles.
  const weightById = new Map(requiredTiles.map((t) => [t.id, tileWeight(event.scoringMode, t.points)]));
  const totalWeight = requiredTiles.reduce((sum, t) => sum + tileWeight(event.scoringMode, t.points), 0);

  const completionCounts = new Map<number, number>();
  for (const c of completions) {
    // Only count completions of required (non-optional) tiles. A frozen awardedPoints
    // (first-team bonus / reveal decay) wins over the tile's live weight in points mode.
    const w = weightById.get(c.tileId);
    if (w !== undefined) {
      const earned = pointsMode && c.awardedPoints != null ? c.awardedPoints : w;
      completionCounts.set(c.teamId, (completionCounts.get(c.teamId) || 0) + earned);
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
      {/* Identity, prize and countdown now live in the EventHero above the board; this row keeps just
          the board-level controls. */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {draftActive && (
          <Link
            href={`/events/${event.id}/draft`}
            className="inline-flex items-center gap-2 text-sm font-medium bg-accent-green/15 text-accent-green-light border border-accent-green/25 px-3 py-1.5 rounded-lg hover:bg-accent-green/25 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-accent-green-light animate-pulse" />
            Draft in Progress — Watch Live
          </Link>
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

      {(mvpToday || mvp) && (
        <div className={`mb-6 grid gap-3 ${mvpToday && mvp ? 'sm:grid-cols-2' : ''}`}>
          {mvpToday && (
            <MvpHighlight label="MVP of the day" emoji="🔥" name={mvpToday.name} points={mvpToday.points} tasks={mvpToday.tasks} pointsMode={pointsMode} teamName={mvpToday.teamName} teamColor={mvpToday.teamColor} />
          )}
          {mvp && (
            <MvpHighlight label="Event MVP" emoji="🏆" name={mvp.name} points={mvp.points} tasks={mvp.tasks} pointsMode={pointsMode} teamName={mvp.teamName} teamColor={mvp.teamColor} />
          )}
        </div>
      )}

      <div className={`grid gap-8 items-start ${fullscreen ? '' : 'lg:grid-cols-[1fr_1.2fr]'}`}>
        {!fullscreen && (
          <div className="min-w-0">
            <h2 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2">
              <span className="w-1 h-5 bg-gold rounded-full" />
              {ladder ? 'Leaderboard' : 'Standings'}
            </h2>
            {ladder ? (
              <>
                <LadderStandings
                  standings={individualStandings}
                  monthly={individualStandingsMonthly}
                  showTeam={ladderHasTeams}
                  openEnded={!event.endDate}
                />
                {ladderHasTeams && (
                  <div className="mt-6">
                    <h3 className="text-md font-bold mb-3 text-foreground flex items-center gap-2">
                      <span className="w-1 h-4 bg-gold/60 rounded-full" />
                      Teams
                    </h3>
                    <Scoreboard
                      teams={teams}
                      totalTiles={totalWeight}
                      completionCounts={completionCounts}
                      eventId={event.id}
                      dropProgressByTeam={dropProgressByTeam}
                      pointsMode
                      teamMvps={teamMvps}
                    />
                  </div>
                )}
              </>
            ) : (
              <Scoreboard
                teams={teams}
                totalTiles={pointsMode ? totalWeight : requiredTiles.length}
                completionCounts={completionCounts}
                eventId={event.id}
                dropProgressByTeam={dropProgressByTeam}
                pointsMode={pointsMode}
                teamMvps={teamMvps}
              />
            )}

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
        <div className="min-w-0">
          <h2 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            {liveDropBoard ? 'Live board' : 'Board Overview'}
            <span className="text-xs font-normal text-text-muted ml-2">(click tiles for details)</span>
          </h2>

          {liveDropBoard ? (
            <LiveDropBoard
              tiles={board}
              rules={eventRules}
              nextRevealAt={nextRevealAt}
              hiddenCount={hiddenTileCount}
              pointsMode={pointsMode}
              completedTileIds={new Set(completions.map((c) => c.tileId))}
              onTileClick={setSelectedTileId}
              noun={taskNoun(axes)}
            />
          ) : (
          <>
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

          {/* Staff-only preview notice. The hidden COUNT is deliberately not shown to members on a
              mission board (it would leak how many surprises are left), but the host still needs to
              know their view isn't the public one. */}
          {staffOnlySet && hiddenTileCount === 0 && (
            <div className="mb-3 rounded-xl border border-gold/25 bg-gold/5 px-4 py-2.5 text-sm text-foreground/90">
              <span aria-hidden className="mr-1.5">👁</span>
              <span className="font-semibold">{staffOnlySet.size}</span> tile{staffOnlySet.size === 1 ? '' : 's'} below
              {' '}<span className="text-text-muted">are marked staff-only — members don&apos;t see them yet.</span>
            </div>
          )}
          {hiddenTileCount > 0 && (
            <div className="mb-3 rounded-xl border border-gold/25 bg-gold/5 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-foreground/90">
                <span aria-hidden className="mr-1.5">🙈</span>
                <span className="font-semibold">{hiddenTileCount}</span> tile{hiddenTileCount === 1 ? '' : 's'} still hidden
                {staffOnlySet && (
                  <span className="text-text-muted"> — marked below; you see them because you&apos;re staff</span>
                )}
              </span>
              <span className="text-xs text-text-muted">
                {nextRevealAt
                  ? `Next reveal ${new Date(nextRevealAt).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : 'Revealed as the event unfolds'}
              </span>
            </div>
          )}
          {/* Missions sit ABOVE the board and outside it: they're the thing that just dropped, they
              expire, and they don't count toward the board's totals. Interleaving them with the
              ordinary tiles buried the urgency and moved the denominator. */}
          {missions.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-gold rounded-full" />
                Missions
                <span className="text-xs font-normal text-text-muted">
                  bonus objectives — not part of the board total
                </span>
              </h3>
              <div className="rounded-xl border border-gold/25 bg-gold/5 divide-y divide-gold/15 overflow-hidden">
                {missions.map((m) => {
                  const done = completions.some((c) => c.tileId === m.id);
                  const closed = !!m.closedAt;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedTileId(m.id)}
                      className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-gold/10 transition-colors"
                    >
                      <span aria-hidden className="text-base">⚡</span>
                      <span className={`flex-1 min-w-0 text-sm font-medium truncate ${done ? 'text-accent-green-light' : closed ? 'text-text-muted line-through' : 'text-foreground'}`}>
                        {m.label}
                      </span>
                      {done && <span className="text-accent-green-light text-xs shrink-0">✓</span>}
                      {closed && !done && (
                        <span className="text-[10px] uppercase tracking-wide text-text-muted shrink-0">closed</span>
                      )}
                      {pointsMode && m.points != null && (
                        <span className="text-xs shrink-0 rounded px-1.5 py-0.5 bg-purple-500/20 text-purple-200 border border-purple-400/30">
                          {m.points} pts
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <EventBoard
            format={event.format}
            tiles={board}
            boardSize={event.boardSize}
            completions={completions}
            teams={teams}
            onTileClick={setSelectedTileId}
            statProgress={statProgressMap}
            expanded={fullscreen}
            pointsMode={pointsMode}
            matchedTileIds={matchedTileIds}
            staffOnlyTileIds={staffOnlySet}
          />
          </>
          )}
        </div>
      </div>

      {/* Read-only tile detail — the same rich modal members and captains see, now shown to
          public/logged-out viewers. Cross-team submission proof is withheld (submissions=[]);
          per-team stat comparison is passed through so the scoreboard keeps its team race view. */}
      {selectedTile && (
        <TileDetailModal
          tile={selectedTile as unknown as FullTile}
          submissions={proofForOpenTile ?? []}
          submissionsLoading={proofForOpenTile === null}
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

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import EventBoard from '@/components/EventBoard';
import Scoreboard from '@/components/Scoreboard';
import Select from '@/components/Select';
import TileDetailModal from '@/components/TileDetailModal';
import { formatNumber, isPointsMode } from '@/lib/utils';
import { tileTierKey, tileCategories, tileHasCategory, tierColor, DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';
import { boardTiles, missionTiles, parseEventRules } from '@/lib/eventRules';
import { scoreTeams } from '@/lib/boardScoring';
import { eventAxes, taskNoun } from '@/lib/eventAxes';
import LiveDropBoard from '@/components/LiveDropBoard';
import TeamLens from '@/components/board/TeamLens';
import LineWatch, { completedLinePositions, needyPositions } from '@/components/board/LineWatch';
import BoardMinimap from '@/components/board/BoardMinimap';
import RacePace, { type RaceTeam } from '@/components/board/RacePace';
import RevealSchedule from '@/components/board/RevealSchedule';
import { deriveTileIcon } from '@/lib/tileIcons';
import type { Tile as FullTile, Submission as FullSubmission } from '@/lib/types';
import type { EventMvp, TeamMvp } from '@/lib/memberBreakdown';
import MvpHighlight from '@/components/MvpHighlight';
import { clanFetch } from '@/lib/clanFetch';
import ClanLink from '@/components/ClanLink';

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
  /** 'milestone' = statGoal is a lifetime total crossed during the event, not an in-event gain. */
  statBasis?: string | null;
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
  /** Scheduled boards: the slots a member can't see yet — time and value only, never content. */
  hiddenSchedule?: { revealAt: string | null; points: number | null }[];
  /**
   * Every point on the board including tiles that haven't dropped yet. On a reveal-policy event the
   * visible tiles are a fraction of the pool, so scoring "350 / 900" against them alone would say a
   * team is 39% done when the board is only a third open.
   */
  boardPointsTotal?: number | null;
}

interface TeamGains {
  teamId: number;
  totalGained: number;
  tileGains: Record<number, number>; // tileId -> gained
}

export default function ScoreboardClient({ event, tiles, teams, completions, tierBands = DEFAULT_TIER_BANDS, mvp = null, mvpToday = null, teamMvps = {}, hiddenTileCount = 0, nextRevealAt = null, staffOnlyTileIds = [], hiddenSchedule = [], boardPointsTotal = null }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [teamGains, setTeamGains] = useState<TeamGains[]>([]);
  // Which team's board the viewer is looking at. Null = everyone's, the shared view.
  const [lensTeamId, setLensTeamId] = useState<number | null>(null);
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
  const [tileProof, setTileProof] = useState<{ tileId: number; teamId: number | null; rows: FullSubmission[] } | null>(null);
  useEffect(() => {
    if (!selectedTileId) return;
    let cancelled = false;
    const tileId = selectedTileId;
    // Capped: a kill tile on a busy board can hold thousands of auto-logs, and the panel only ever
    // shows totals per contributor plus their proof. The API's own ceiling is 500.
    // The lens scopes the PROOF too: looking at Frost's board and opening a tile has to show
    // Frost's proof, not every team's. Without this the modal quietly contradicted the board.
    const teamParam = lensTeamId != null ? `&teamId=${lensTeamId}` : '';
    clanFetch(`/api/events/${event.id}/submissions?tileId=${tileId}${teamParam}&limit=500`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: FullSubmission[]) => {
        if (!cancelled) setTileProof({ tileId, teamId: lensTeamId, rows: Array.isArray(rows) ? rows : [] });
      })
      .catch(() => {
        if (!cancelled) setTileProof({ tileId, teamId: lensTeamId, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTileId, event.id, lensTeamId]);
  const proofForOpenTile =
    tileProof && tileProof.tileId === selectedTileId && tileProof.teamId === lensTeamId ? tileProof.rows : null;

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
    clanFetch(`/api/events/${event.id}/submissions`)
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
        const res = await clanFetch(`/api/events/${event.id}/gains?teamId=${team.id}`);
        if (!res.ok) return null;
        const data = await res.json();
        const tileGains: Record<number, number> = {};
        let totalGained = 0;
        for (const tile of statTiles) {
          let tileTotal = 0;
          if (tile.statBasis === 'milestone') {
            // A milestone measures a LIFETIME total crossed during the event, per member — so the
            // team's progress is its best ELIGIBLE member, not a sum. Someone who was already at or
            // above the goal at the whistle contributes nothing: they can never complete this tile,
            // and counting their lifetime would show a full bar that never credits.
            for (const player of data) {
              const base = player.baseline?.[tile.trackedStat!] ?? 0;
              if (base >= (tile.statGoal ?? 0)) continue;
              const lifetime = player.current?.[tile.trackedStat!] ?? 0;
              if (lifetime > tileTotal) tileTotal = lifetime;
            }
          } else {
            for (const player of data) {
              const gained = player.gains?.[tile.trackedStat!] ?? 0;
              tileTotal += gained;
            }
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

  const pointsMode = isPointsMode(event.scoringMode);
  // Scores come from lib/boardScoring — the same function payouts, the admin surfaces, the team
  // pages and the Discord commands use. This screen used to compute its own, which is how it ended
  // up scoring missions at zero while the standings that pay out scored them at full value.
  const scores = useMemo(
    () =>
      new Map(
        scoreTeams({
          scoringMode: event.scoringMode,
          rules: eventRules,
          tiles,
          completions,
          teams,
          boardPointsTotal,
        }).map((s) => [s.teamId, s]),
      ),
    [event.scoringMode, eventRules, tiles, completions, teams, boardPointsTotal],
  );

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

  // Build stat progress map for tiles (aggregated across all teams for overview). Memoised because
  // the board's own derivations (the minimap's per-tile status) hang off it.
  const statTiles = useMemo(() => tiles.filter((t) => t.trackedStat && t.statGoal), [tiles]);
  const statProgressMap = useMemo(() => {
    const map = new Map<number, { current: number; goal: number; statType?: string }>();
    for (const tile of statTiles) {
      // Get max progress across all teams for overview
      let maxGained = 0;
      for (const tg of teamGains) {
        const gained = tg.tileGains[tile.id] || 0;
        if (gained > maxGained) maxGained = gained;
      }
      map.set(tile.id, {
        current: maxGained,
        goal: tile.statGoal!,
        statType: tile.statType || undefined,
      });
    }
    return map;
  }, [statTiles, teamGains]);

  // ---- Format surfaces -------------------------------------------------------------------------
  // Every format below is multi-claim: each team can complete every tile, so nothing here is "who
  // got there first". What differs is the question the board has to answer, and each one needs a
  // different derivation over the same completions.

  const positionOf = useMemo(() => new Map(board.map((t) => [t.id, t.position])), [board]);
  const existingPositions = useMemo(() => new Set(board.map((t) => t.position)), [board]);
  const labelByPosition = useMemo(() => new Map(board.map((t) => [t.position, t.label])), [board]);
  const ownedByTeam = useMemo(() => {
    const map = new Map<number, Set<number>>(teams.map((t) => [t.id, new Set<number>()]));
    for (const c of completions) {
      const pos = positionOf.get(c.tileId);
      if (pos !== undefined) map.get(c.teamId)?.add(pos);
    }
    return map;
  }, [completions, teams, positionOf]);

  // Classic grids are played for lines, and the lens decides whose lines are drawn.
  const isGrid = axes.shape === 'grid';
  const lensOwned = useMemo(
    () => (lensTeamId != null ? ownedByTeam.get(lensTeamId) ?? new Set<number>() : null),
    [lensTeamId, ownedByTeam],
  );
  const linePositions = useMemo(
    () => (isGrid && lensOwned ? completedLinePositions(event.boardSize, lensOwned, existingPositions) : null),
    [isGrid, lensOwned, event.boardSize, existingPositions],
  );
  const neededPositions = useMemo(
    () => (isGrid && lensOwned ? needyPositions(event.boardSize, lensOwned, existingPositions) : null),
    [isGrid, lensOwned, event.boardSize, existingPositions],
  );
  const lineTeams = useMemo(
    () => teams.map((t) => ({ id: t.id, name: t.name, color: t.color, owned: ownedByTeam.get(t.id) ?? new Set<number>() })),
    [teams, ownedByTeam],
  );

  // A long points board needs a map of itself. Status is per lens: what it is to the team you're
  // viewing as, or to the clan as a whole.
  const completedByLens = useMemo(() => {
    const done = new Set<number>();
    for (const c of completions) if (lensTeamId == null || c.teamId === lensTeamId) done.add(c.tileId);
    return done;
  }, [completions, lensTeamId]);
  const minimapTiles = useMemo(() => {
    const topPoints = Math.max(...board.map((t) => t.points ?? 0), 0);
    return board.map((t) => ({
      id: t.id,
      label: t.label,
      points: t.points,
      top: pointsMode && topPoints > 0 && (t.points ?? 0) >= topPoints,
      status: completedByLens.has(t.id)
        ? ('completed' as const)
        : (statProgressMap.get(t.id)?.current ?? 0) > 0 ||
            submissions.some((sub) => sub.tileId === t.id && (lensTeamId == null || sub.teamId === lensTeamId))
          ? ('in_progress' as const)
          : ('not_started' as const),
    }));
  }, [board, completedByLens, statProgressMap, submissions, lensTeamId, pointsMode]);

  // A tile race is about position AND pace, so each team carries the window its pace is measured over.
  const raceTeams: RaceTeam[] = useMemo(() => {
    if (axes.shape !== 'track') return [];
    const ordered = [...board].sort((a, b) => a.position - b.position);
    return teams.map((team) => {
      const done = new Set(completions.filter((c) => c.teamId === team.id).map((c) => c.tileId));
      let reached = 0;
      for (const tile of ordered) {
        if (!done.has(tile.id)) break;
        reached++;
      }
      const times = completions
        .filter((c) => c.teamId === team.id)
        .map((c) => c.completedAt)
        .sort();
      return { id: team.id, name: team.name, color: team.color, reached, firstAt: times[0] ?? null, lastAt: times[times.length - 1] ?? null };
    });
  }, [axes.shape, board, completions, teams]);
  const nextTileLabelFor = useCallback(
    (team: RaceTeam) => {
      const ordered = [...board].sort((a, b) => a.position - b.position);
      return ordered[team.reached]?.label ?? null;
    },
    [board],
  );

  // A showdown IS a schedule — its own surface, rather than the generic live board.
  const scheduled = eventRules.revealPolicy === 'scheduled';
  const scheduleTiles = useMemo(
    () =>
      scheduled
        ? board.map((t) => ({
            id: t.id,
            label: t.label,
            points: t.points,
            icon: deriveTileIcon(t),
            revealAt: (t as { revealAt?: string | null }).revealAt ?? null,
            revealedAt: t.revealedAt ?? null,
            closedAt: t.closedAt ?? null,
            claims: completions.filter((c) => c.tileId === t.id).length,
            claimed: completions.some((c) => c.tileId === t.id),
          })).concat(
            hiddenSchedule.map((h, i) => ({
              id: -1 - i, // placeholder: not a real tile, and never clickable
              label: '',
              points: h.points,
              icon: null,
              revealAt: h.revealAt ?? null,
              revealedAt: null,
              closedAt: null,
              claims: 0,
              claimed: false,
            })),
          )
        : [],
    [scheduled, board, completions, hiddenSchedule],
  );

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
          <ClanLink
            href={`/events/${event.id}/draft`}
            className="inline-flex items-center gap-2 text-sm font-medium bg-accent-green/15 text-accent-green-light border border-accent-green/25 px-3 py-1.5 rounded-lg hover:bg-accent-green/25 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-accent-green-light animate-pulse" />
            Draft in Progress — Watch Live
          </ClanLink>
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
              Standings
            </h2>
            <Scoreboard
              teams={teams}
              scores={scores}
              eventId={event.id}
              dropProgressByTeam={dropProgressByTeam}
              pointsMode={pointsMode}
              teamMvps={teamMvps}
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
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span className="w-1 h-5 bg-gold rounded-full" />
              {scheduled ? 'Tonight\u2019s schedule' : liveDropBoard ? 'Live board' : 'Board Overview'}
              <span className="text-xs font-normal text-text-muted ml-2">(click tiles for details)</span>
            </h2>
            {/* Multi-claim boards read very differently as "everyone" vs "us" — so let the viewer choose. */}
            {!liveDropBoard && (
              <TeamLens teams={teams} value={lensTeamId} onChange={setLensTeamId} className="ml-auto" />
            )}
          </div>

          {scheduled ? (
            <RevealSchedule tiles={scheduleTiles} pointsMode={pointsMode} onTileClick={setSelectedTileId} />
          ) : liveDropBoard ? (
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
          {/* Missions sit ABOVE the board and outside it: they're the thing that just dropped, and
              they expire. Their points are a BONUS — added to a team's score but never to the board
              total, so announcing one mid-event can't move the denominator under everyone at once
              (see lib/boardScoring). Interleaving them with the ordinary tiles buried the urgency. */}
          {missions.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-gold rounded-full" />
                Missions
                <span className="text-xs font-normal text-text-muted">
                  bonus points — earned on top of the board total
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

          {axes.shape === 'list' && (
            <BoardMinimap
              tiles={minimapTiles}
              lensName={lensTeamId == null ? 'the clan' : (teams.find((t) => t.id === lensTeamId)?.name ?? 'your team')}
              onTileClick={setSelectedTileId}
            />
          )}

          <EventBoard
            format={event.format}
            tiles={board}
            boardSize={event.boardSize}
            completions={completions}
            teams={teams}
            activeTeamId={lensTeamId ?? undefined}
            onTileClick={setSelectedTileId}
            statProgress={statProgressMap}
            expanded={fullscreen}
            pointsMode={pointsMode}
            matchedTileIds={matchedTileIds}
            staffOnlyTileIds={staffOnlySet}
            linePositions={linePositions}
            neededPositions={neededPositions}
            tierBands={tierBands}
          />

          {/* What a classic board is really played for, and what a race is really about. */}
          {isGrid && teams.length > 0 && (
            <LineWatch
              size={event.boardSize}
              teams={lineTeams}
              existingPositions={existingPositions}
              labelFor={(pos) => labelByPosition.get(pos) ?? `Tile ${pos + 1}`}
              ownerNamesFor={(pos) =>
                lineTeams
                  .filter((t) => t.owned.has(pos) && t.id !== lensTeamId)
                  .map((t) => t.name)
                  .slice(0, 2)
              }
              lensTeamId={lensTeamId}
            />
          )}
          {axes.shape === 'track' && raceTeams.length > 0 && (
            <RacePace teams={raceTeams} totalTiles={board.length} nextTileLabelFor={nextTileLabelFor} />
          )}
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
          completedBy={selectedTileCompletions
            .filter((c) => lensTeamId == null || c.teamId === lensTeamId)
            .map((c) => {
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

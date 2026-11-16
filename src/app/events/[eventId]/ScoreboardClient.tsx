'use client';

import { raceGraph, raceFieldSize, raceRouteOpts } from '@/lib/raceRoutes';
import { gapWatch, orderLinesBy, raceFeed, raceLines, raceStatCards } from '@/lib/raceSummary';
import { isRaceHidden } from '@/lib/raceHideAhead';
import { useRacePick } from '@/components/board/BranchingRaceBoard';
import { RaceFeedList, RaceGapWatch, RaceSectionTitle, RaceStandings, RaceStatCardsRow, RaceUpNext } from '@/components/board/RaceEventSections';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { dropProgressFor } from '@/hooks/useDropProgress';
import { useUrlTile } from '@/hooks/useUrlTile';
import { eventStage } from '@/lib/eventStage';
import EventBoard from '@/components/EventBoard';
import Scoreboard from '@/components/Scoreboard';
import SoloStandings from '@/components/SoloStandings';
import Select from '@/components/Select';
import TileDetailModal from '@/components/TileDetailModal';
import type { ShownHighlight } from '@/lib/highlights/rules';
import { exactTitle, formatNumber, isPointsMode } from '@/lib/utils';
import { tileTierKey, tileCategories, tileHasCategory, tierColor, DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';
import { boardTiles, missionTiles, parseEventRules, parseTileMissionRules } from '@/lib/eventRules';
import { missionTileState } from '@/lib/tileState';
import { TileStateChip } from '@/components/board/TileState';
import { scoreTeams } from '@/lib/boardScoring';
import { statKeys, tileKindFilterKey, tileKindOptions } from '@/lib/tileKinds';
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
import { prefetchTileDialog, tileProofUrl, useTileData } from '@/lib/tileData';
import type { TileNeedsLike } from '@/lib/tileRequirements';
import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';
import { tileMatchesSearch } from '@/lib/tileSearch';
import { comboView, comboProgressLine } from '@/lib/comboProgress';
import StandingsHiddenNotice from '@/components/StandingsHiddenNotice';
import type { StandingsCurtainInfo } from '@/lib/standingsVisibility';

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
  /** Item names behind trackedItemIds, for the search (lib/tileSearchText). */
  searchText?: string | null;
  // Mission/reveal state — drives the split between the board and its missions.
  mission?: number | null;
  revealedAt?: string | null;
  closedAt?: string | null;
  /** Per-mission scoring JSON (lib/eventRules MissionRules) — its expiry drives the state chip. */
  rules?: string | null;
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
  /** lib/tileCaps: null = the tile's own credit; 'cap:N' = a capped tile's cap counter. */
  goal?: string | null;
  id: number;
  tileId: number;
  teamId: number;
  amount: number;
}

interface Props {
  /** A creator space's event (lib/creatorSpaces): the whole board is "everyone", not "the clan". */
  creator?: boolean;
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
  /** Opens a visible tile directly (used by RuneLite's sidebar catalogue links). */
  initialTileId?: number | null;
  /**
   * Hidden standings (lib/standingsVisibility). When set, `completions` already holds only the
   * viewer's own teams' rows (the server cut them), and every cross-team surface here — the
   * standings, XP race, lens, line watch, race pace, per-team stat bars — narrows to those teams.
   */
  curtain?: StandingsCurtainInfo | null;
  /** Missions set to show as Locked before they drop: name and icon only (lib/eventRules lockedMissionPreviews). */
  lockedMissions?: { id: number; label: string; icon: string | null }[];
  /** A tile race's order, ranked once on the server (first to the finish, steps, who got there first). */
  raceStandings?: { teamId: number; rank: number; stepsDone: number; finished: boolean }[] | null;
  /** Each race team's count on the step it's on (lib/raceSummary stepProgress), from the server. */
  raceStepProgress?: Record<number, { current: number; goal: number } | null>;
  /**
   * A players board (lib/standingsWindow isSoloLike): the standings read as a ranked list of players
   * — top five, the viewer's own line(s) with neighbours, the rest paged — not a card per team.
   */
  solo?: boolean;
  /** The viewer's own teams on this board (one per account of theirs entered). */
  myTeamIds?: number[];
  /** The viewer's own team in this event (any board shape), for the tile dialog's "Submit proof" hand-off. */
  proofTeamId?: number | null;
  signedIn?: boolean;
  /**
   * A board of many teams of any size (lib/standingsWindow isManyTeams): the same cut list as `solo`,
   * worded as teams. `teamMembers` carries each team's member names for the row count and the search.
   */
  manyTeams?: boolean;
  teamMembers?: Record<number, string[]>;
  /** A streamed board's tile clips by tile id (lib/highlights), already cut to what this viewer may see. */
  tileHighlights?: Record<number, ShownHighlight[]>;
  /**
   * The viewer's OWN teams' plans (lib/tileClaims), by team id: who is going for which tile. From the
   * server page, so the board's hover card never fetches. Never holds another team's.
   */
}

/**
 * The team's XP gained, for the "XP gained" panel. Summing every stat tile counted the same XP once
 * per tile that tracks it (a 5M and a 2M Herblore tile = Herblore twice, plus the total-XP tile on
 * top) and added boss kill counts to it as "XP". A total-XP tile already IS the answer; without one,
 * each tracked skill counts once and kill counts stay out.
 */
const SOLO_XP_SHOWN = 10;

function teamXpGained(
  statTiles: Array<{ id: number; trackedStat?: string | null; statType?: string | null; statBasis?: string | null }>,
  tileGains: Record<number, number>,
): number {
  const xpTiles = statTiles.filter((t) => t.statType === 'skill' && t.statBasis !== 'milestone');
  const overall = xpTiles.find((t) => statKeys(t.trackedStat).includes('overall'));
  if (overall) return tileGains[overall.id] ?? 0;
  const byStat = new Map<string, number>();
  for (const t of xpTiles) byStat.set(t.trackedStat!, tileGains[t.id] ?? 0);
  let total = 0;
  for (const v of byStat.values()) total += v;
  return total;
}

interface TeamGains {
  teamId: number;
  totalGained: number;
  tileGains: Record<number, number>; // tileId -> gained
  /** tileId -> each member's share, biggest first — the tile pop-up expands a team into these. */
  tileMembers: Record<number, { name: string; gained: number }[]>;
}

export default function ScoreboardClient({ event, tiles, teams: allTeams, completions, tierBands = DEFAULT_TIER_BANDS, mvp = null, mvpToday = null, teamMvps = {}, hiddenTileCount = 0, nextRevealAt = null, staffOnlyTileIds = [], hiddenSchedule = [], boardPointsTotal = null, curtain = null, lockedMissions = [], raceStandings = null, raceStepProgress = {}, creator = false, tileHighlights, solo = false, myTeamIds = [], proofTeamId = null, signedIn = false, manyTeams = false, teamMembers }: Props) {
  // Solo-like and many-teams boards both draw the cut list and the compact lens.
  const windowed = solo || manyTeams;
  // Behind the curtain the teams whose progress this page deals in are the viewer's own; the rest
  // are names on a roster. Everything below that scores, ranks, fetches or draws per team uses this.
  const teams = useMemo(
    () => (curtain ? allTeams.filter((t) => curtain.ownTeamIds.includes(t.id)) : allTeams),
    [allTeams, curtain],
  );
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  // The open tile lives in the URL (?tile=ID): it deep-links, and Back closes the dialog instead of
  // leaving the event. The URL is the single source of truth, so Back/Forward just work.
  const searchParams = useSearchParams();
  const [selectedTileId, setSelectedTileId] = useUrlTile((id) => tiles.some((tile) => tile.id === id));
  const [fullscreen, setFullscreen] = useState(false);
  // Phones only: search + filters start folded (see the toggle above the board).
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [teamGains, setTeamGains] = useState<TeamGains[]>([]);
  // Which team's board the viewer is looking at. Null = everyone's, the shared view.
  // Behind the curtain a one-team viewer looks through their own team's lens from the start.
  const [lensTeamId, setLensTeamId] = useState<number | null>(() =>
    curtain && curtain.ownTeamIds.length === 1 ? curtain.ownTeamIds[0] : null,
  );
  // Board filters survive a reload: they start from the URL (?cat ?tier ?type ?q) and write back to it.
  const [categoryFilter, setCategoryFilter] = useState<string>(() => searchParams.get('cat') || 'all');
  const [tierFilter, setTierFilter] = useState<string>(() => searchParams.get('tier') || 'all');
  const [typeFilter, setTypeFilter] = useState<string>(() => searchParams.get('type') || 'all');
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('q') || '');
  useEffect(() => {
    const url = new URL(window.location.href);
    const want: Record<string, string> = { cat: categoryFilter, tier: tierFilter, type: typeFilter, q: searchQuery };
    let changed = false;
    for (const [key, value] of Object.entries(want)) {
      const next = value && value !== 'all' ? value : null;
      if ((url.searchParams.get(key) ?? null) === next) continue;
      changed = true;
      if (next === null) url.searchParams.delete(key);
      else url.searchParams.set(key, next);
    }
    if (changed) window.history.replaceState(window.history.state, '', url);
  }, [categoryFilter, tierFilter, typeFilter, searchQuery]);

  // Proof for the tile the viewer opened. The board itself only needs the light projection above,
  // and a busy event has thousands of submissions, so the full rows (screenshot, note, who credited
  // it) are fetched per tile on open. Without this the public board passed an empty list and the
  // modal had no proof to show — which had no workaround at all on a ladder, where "go look at the
  // team page" isn't a place that exists.
  // Stamped with the tile it belongs to rather than cleared on close: that way the modal can only
  // ever show proof for the tile actually open, with no flash of the previous one's while the next
  // is in flight — and the effect never has to setState just to reset.
  // Read through the tile-data cache: a hover/focus on the tile warmed it already, a reopened tile
  // paints its last proof at once, and the fresh read replaces it when it lands.
  const proofRows = useTileData<FullSubmission[]>(selectedTileId ? tileProofUrl(event.id, selectedTileId, lensTeamId) : null, []);
  // Any answer is an answer: an empty list reads as empty, and an odd shape is no proof, never "loading".
  const proofForOpenTile = selectedTileId ? (proofRows === undefined ? null : Array.isArray(proofRows) ? proofRows : []) : null;
  const intentTile = useCallback(
    (tileId: number) => {
      const t = tiles.find((x) => x.id === tileId);
      if (t) prefetchTileDialog({ eventId: event.id, tile: t as unknown as TileNeedsLike & { id: number }, teamId: lensTeamId, race: event.format === 'tilerace' });
    },
    [tiles, event.id, event.format, lensTeamId],
  );

  const staffOnlySet = useMemo(
    () => (staffOnlyTileIds.length > 0 ? new Set(staffOnlyTileIds) : null),
    [staffOnlyTileIds],
  );

  const selectedTile = selectedTileId ? tiles.find((t) => t.id === selectedTileId) : null;
  // A COMBO (lib/combo): which teams did each part, and — through a team lens — its progress.
  const selectedParts = (selectedTile as { parts?: FullTile[] } | null | undefined)?.parts;
  const partCompletedBy = selectedParts
    ? Object.fromEntries(
        selectedParts.map((p) => [
          p.id,
          completions
            .filter((c) => c.tileId === p.id && (lensTeamId == null || c.teamId === lensTeamId))
            .map((c) => {
              const team = teams.find((t) => t.id === c.teamId);
              return { teamName: team?.name || 'Unknown', color: team?.color || '#888' };
            }),
        ]),
      )
    : undefined;
  const lensCombo = selectedParts && lensTeamId != null && selectedTile
    ? comboView(selectedTile as unknown as FullTile, selectedParts, (id) => {
        const c = completions.find((x) => x.tileId === id && x.teamId === lensTeamId);
        return {
          done: !!c,
          doneBy: (c as { creditPlayerId?: number | null } | undefined)?.creditPlayerId ?? null,
          subs: submissions.filter((x) => x.tileId === id && x.teamId === lensTeamId),
        };
      })
    : null;
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
    // One event-wide read (the route without `teamId`: same auth, same hidden-standings cut), split by
    // team here — a solo board of 170 used to make 170 requests on every refresh.
    type GainRow = { teamId: number | null; playerName: string; baseline?: Record<string, number>; current?: Record<string, number>; gains?: Record<string, number>; tileGains?: Record<number, number> };
    clanFetch(`/api/events/${event.id}/gains`)
      .then((res) => (res.ok ? (res.json() as Promise<GainRow[]>) : null))
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        const byTeam = new Map<number, GainRow[]>();
        for (const r of rows) {
          if (r.teamId == null) continue;
          const list = byTeam.get(r.teamId);
          if (list) list.push(r);
          else byTeam.set(r.teamId, [r]);
        }
        setTeamGains(teams.flatMap((team) => {
        const data = byTeam.get(team.id) ?? [];
        const tileGains: Record<number, number> = {};
        const tileMembers: Record<number, { name: string; gained: number }[]> = {};
        for (const tile of statTiles) {
          let tileTotal = 0;
          const members: { name: string; gained: number }[] = [];
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
              if (lifetime > 0) members.push({ name: player.playerName, gained: lifetime });
            }
          } else {
            for (const player of data) {
              const gained = player.tileGains?.[tile.id] ?? player.gains?.[tile.trackedStat!] ?? 0;
              tileTotal += gained;
              if (gained > 0) members.push({ name: player.playerName, gained });
            }
          }
          tileGains[tile.id] = tileTotal;
          tileMembers[tile.id] = members.sort((a, b) => b.gained - a.gained);
        }
        return [{ teamId: team.id, totalGained: teamXpGained(statTiles, tileGains), tileGains, tileMembers }];
        }));
      })
      .catch(() => {});
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
  // A finished event can't change: no polling at all. The stats pulse is a second token for stat tiles
  // only, so a board without any doesn't ask for it.
  const finished = eventStage({ startDate: event.startDate ?? null, endDate: event.endDate ?? null, forceEndedAt: event.forceEndedAt ?? null }) === 'wrap';
  const hasStatTiles = tiles.some((t) => t.trackedStat && t.statGoal);
  useLiveRefresh({ url: `/api/events/${event.id}/pulse`, onChange: onBoardChange, enabled: !finished });
  // KC/XP moves without the board changing (a plugin push, a hiscores fetch): a second, equally cheap
  // pulse that only refetches the progress numbers — not the page — when a stat reading lands.
  useLiveRefresh({ url: `/api/events/${event.id}/pulse?part=stats`, onChange: refetchGains, enabled: !finished && hasStatTiles });

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
      // The tile's own credits — a cap counter's rows aren't progress (lib/tileCaps).
      const tileSubs = submissions.filter((s) => s.tileId === tile.id && s.teamId === team.id && s.goal == null);
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

  // Count progress ("12 of 50") for the board and its hover card, from the submissions this page
  // already holds: the team the board is drawn for, or with nobody picked the furthest team's, as
  // statProgressMap does.
  const boardTeamId = event.format === 'tilerace' ? (lensTeamId ?? myTeamIds[0] ?? null) : lensTeamId;
  const dropProgressMap = useMemo(() => {
    const byTeam = new Map<number, FullSubmission[]>();
    for (const s of submissions as unknown as FullSubmission[]) {
      const list = byTeam.get(s.teamId);
      if (list) list.push(s);
      else byTeam.set(s.teamId, [s]);
    }
    const all = tiles as unknown as FullTile[];
    if (boardTeamId != null) return dropProgressFor(all, byTeam.get(boardTeamId) ?? [], completions, boardTeamId).dropProgress;
    // Nobody picked: only what is still open for everyone and counts past one. A tile some team has
    // finished shows that team's marker, not a count.
    const doneByAnyone = new Set(completions.map((c) => c.tileId));
    const best = new Map<number, { current: number; required: number; text?: string; note?: string }>();
    for (const [teamId, subs] of byTeam) {
      for (const [tileId, p] of dropProgressFor(all, subs, completions, teamId).dropProgress) {
        if (doneByAnyone.has(tileId) || (p.required <= 1 && !p.text)) continue;
        if (p.current > 0 && p.current > (best.get(tileId)?.current ?? 0)) best.set(tileId, p);
      }
    }
    return best;
  }, [tiles, submissions, completions, boardTeamId]);

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
      const boardIds = new Set(board.map((t) => t.id));
      const times = completions
        // Board cells only — a combo part's completion (lib/combo) isn't a step on the track.
        .filter((c) => c.teamId === team.id && boardIds.has(c.tileId))
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

  // Board filters — by text search, content category, tile type, and difficulty tier (from points).
  const categories = tileCategories(tiles);
  const typeOptions = tileKindOptions(tiles);
  const showTypeFilter = typeOptions.length > 2;
  const search = searchQuery.trim().toLowerCase();
  const filterActive = categoryFilter !== 'all' || tierFilter !== 'all' || typeFilter !== 'all' || search !== '';
  const matchedTileIds = filterActive
    ? new Set(
        tiles
          .filter((t) => categoryFilter === 'all' || tileHasCategory(t.category, categoryFilter))
          .filter((t) => tierFilter === 'all' || tileTierKey(t.points, tierBands) === tierFilter)
          .filter((t) => typeFilter === 'all' || tileKindFilterKey(t) === typeFilter)
          .filter((t) => tileMatchesSearch(t, search))
          .map((t) => t.id),
      )
    : null;
  // Tier bands only make sense when tiles carry distinct point values.
  // A tier filter only means something when the tiles actually span more than one tier.
  const showTierFilter = pointsMode && tierBands.length > 0 && new Set(board.map((t) => tileTierKey(t.points, tierBands))).size > 1;
  const showFilters = categories.length > 0 || showTierFilter || showTypeFilter;

  // ---- Tile race: its own page layout (components/board/RaceEventSections) ----------------------
  // Stat cards, the Race track (strip + road map), the MVP, standings next to "Up next" and the gap
  // watch, then the race feed — the same route everywhere, the viewer's team from the lens or the
  // viewer's own seat.
  const isRace = event.format === 'tilerace';
  const raceViewer = isRace ? (lensTeamId ?? myTeamIds[0] ?? null) : null;
  const raceG = useMemo(() => (isRace ? raceGraph(board) : null), [isRace, board]);
  const racePick = useRacePick(isRace ? event.id : undefined, raceViewer, raceG ?? raceGraph([]));
  const raceLineList = useMemo(
    () => {
      if (!raceG) return [];
      const local = raceLines(raceG, teams, completions, (id) => (id === raceViewer && racePick.pickInfo?.mode === 'choose' ? racePick.pickInfo.picks : null), raceRouteOpts(racePick.pickInfo?.mode));
      // The server's order and ranks — the same the plugin shows — never a local re-sort.
      return raceStandings ? orderLinesBy(local, raceStandings) : local;
    },
    [raceG, teams, completions, raceViewer, racePick.pickInfo, raceStandings],
  );
  const [raceNow, setRaceNow] = useState<number | null>(null);
  // The race's fullscreen is an overlay: Esc closes it, and the page behind doesn't scroll.
  useEffect(() => {
    if (!isRace || !fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isRace, fullscreen]);
  useEffect(() => {
    if (!isRace) return;
    setRaceNow(Date.now());
    const t = setInterval(() => setRaceNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [isRace]);

  // Proof is filed on the team page (the one copy of the form); from here we point at it. Nothing to
  // offer once the event is over, and a plain reason when the viewer has no team to file for.
  const submitProof = (tileId: number): { href: string } | { reason: string } | null => {
    if (finished) return null;
    if (proofTeamId != null) return { href: `/team/${proofTeamId}?tile=${tileId}` };
    return { reason: signedIn ? 'You can submit proof once you are on a team in this event.' : 'Sign in to submit proof for your team.' };
  };

  const tileModal = selectedTile ? (
        <TileDetailModal
          tile={selectedTile as unknown as FullTile}
          race={event.format === 'tilerace' ? { tiles: board, completions: completions, teams: teams, viewerTeamId: raceViewer ?? lensTeamId, proofTeamId, onOpenTile: (id: number) => setSelectedTileId(id) } : null}
          partCompletedBy={partCompletedBy}
          dropProgress={lensCombo ? { current: lensCombo.done, required: lensCombo.needed, note: comboProgressLine(lensCombo), combo: lensCombo } : undefined}
          submissions={proofForOpenTile ?? []}
          submissionsLoading={proofForOpenTile === null}
          ended={finished}
          completedBy={selectedTileCompletions
            .filter((c) => lensTeamId == null || c.teamId === lensTeamId)
            .map((c) => {
            const team = teams.find((t) => t.id === c.teamId);
            return { teamId: c.teamId, teamName: team?.name || 'Unknown', color: team?.color || '#888', completedAt: c.completedAt };
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
                    members: tg.tileMembers[selectedTile.id] ?? [],
                  };
                })
              : undefined
          }
          pointsMode={pointsMode}
          highlights={tileHighlights?.[selectedTile.id]}
          submitProof={submitProof(selectedTile.id)}
        />
  ) : null;

  if (isRace && raceG) {
    // (Esc closes the race's fullscreen overlay — see the effect below.)
    const steps = raceG.lastStep + 1;
    const tileById = new Map(board.map((t) => [t.id, { ...t, icon: t.icon ?? deriveTileIcon(t) }]));
    const labelOf = (id: number) => tileById.get(id)?.label ?? `Tile ${id}`;
    const me = raceViewer != null ? raceLineList.find((l) => l.team.id === raceViewer) : undefined;
    const progressFor = (tileId: number) => {
      const tile = tileById.get(tileId);
      if (!tile || raceViewer == null) return null;
      if (tile.trackedStat && tile.statGoal) {
        const g = teamGains.find((tg) => tg.teamId === raceViewer)?.tileGains[tileId] ?? 0;
        return { current: Math.min(g, tile.statGoal), goal: tile.statGoal };
      }
      if (tile.requiredAmount && tile.requiredAmount > 1) {
        const cur = submissions.filter((x) => x.tileId === tileId && x.teamId === raceViewer && x.goal == null).reduce((n, x) => n + x.amount, 0);
        return { current: Math.min(cur, tile.requiredAmount), goal: tile.requiredAmount };
      }
      return null;
    };
    const racersFor = (tileId: number) =>
      raceLineList.filter((l) => l.team.id !== raceViewer && l.route.open.includes(tileId)).map((l) => ({ name: l.team.name, color: l.team.color }));
    const variant = raceFieldSize(teams.length);
    return (
      <div>
        {draftActive && (
          <div className="mb-6">
            <ClanLink
              href={`/events/${event.id}/draft`}
              className="inline-flex items-center gap-2 text-sm font-medium bg-accent-green/15 text-accent-green-light border border-accent-green/25 px-3 py-1.5 rounded-lg hover:bg-accent-green/25 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-accent-green-light animate-pulse" />
              Draft in Progress — Watch Live
            </ClanLink>
          </div>
        )}

        {!curtain && <RaceStatCardsRow cards={raceStatCards(raceG, raceLineList, raceViewer)} />}

        {/* Fullscreen on a race is a full-viewport overlay (Esc or Close), and the map scales up to
            use the room — on the page the board already fills its card. */}
        <section
          className={fullscreen ? 'fixed inset-0 z-50 overflow-auto bg-background p-4 sm:p-6' : 'mb-8 min-w-0'}
          role={fullscreen ? 'dialog' : undefined}
          aria-modal={fullscreen ? true : undefined}
          aria-label={fullscreen ? 'Race track, fullscreen' : undefined}
        >
          <RaceSectionTitle
            aside={
              <>
                <span className="text-xs font-normal text-text-muted">click a tile for details</span>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <TeamLens teams={teams} value={lensTeamId} onChange={setLensTeamId} compact={windowed} mine={myTeamIds} noun={solo ? 'player' : 'team'} />
                </div>
              </>
            }
          >
            Race track
          </RaceSectionTitle>
          <EventBoard
            format={event.format}
            tiles={board}
            boardSize={event.boardSize}
            completions={completions}
            teams={teams}
            activeTeamId={raceViewer ?? undefined}
            onTileClick={setSelectedTileId}
            onTileIntent={intentTile}
            statProgress={statProgressMap}
            dropProgress={dropProgressMap}
            expanded
            pointsMode={pointsMode}
            matchedTileIds={null}
            staffOnlyTileIds={staffOnlySet}
            showStatusFilter={false}
            raceLayout="track"
            raceLens={lensTeamId}
          />
        </section>

        {(mvpToday || mvp) && (
          <div className={`mb-8 grid gap-3 ${mvpToday && mvp ? 'sm:grid-cols-2' : ''}`}>
            {mvpToday && <MvpHighlight label="MVP of the day" emoji="🔥" name={mvpToday.name} points={mvpToday.points} tasks={mvpToday.tasks} pointsMode={pointsMode} teamName={mvpToday.teamName} teamColor={mvpToday.teamColor} />}
            {mvp && <MvpHighlight label="Event MVP" emoji="🏆" name={mvp.name} points={mvp.points} tasks={mvp.tasks} pointsMode={pointsMode} teamName={mvp.teamName} teamColor={mvp.teamColor} />}
          </div>
        )}

        {(
          <div className="grid gap-8 items-start lg:grid-cols-2">
            <div className="min-w-0">
              <RaceSectionTitle>{curtain ? (teams.length > 0 ? 'Your team' : 'Standings') : 'Standings'}</RaceSectionTitle>
              {curtain && <StandingsHiddenNotice curtain={curtain} ownTeamNames={teams.map((t) => t.name)} className="mb-4" />}
              {variant === 'huge' && !curtain ? (
                <SoloStandings
                  teams={teams}
                  scores={new Map(raceLineList.map((l) => [l.team.id, { teamId: l.team.id, boardScore: l.stepsDone, bonusScore: 0, score: l.stepsDone, total: steps, unit: 'tiles' as const, pct: steps ? Math.round((l.stepsDone / steps) * 100) : 0 }]))}
                  eventId={event.id}
                  myTeamIds={myTeamIds}
                  noun={solo ? 'players' : 'teams'}
                  members={teamMembers}
                  ranked={raceLineList.map((l) => ({ id: l.team.id, rank: l.rank }))}
                />
              ) : (
                <RaceStandings lines={raceLineList} steps={steps} labelOf={labelOf} hiddenTile={(id) => isRaceHidden(tileById.get(id) ?? {})} stepProgress={raceStepProgress} teamMvps={teamMvps} eventId={event.id} viewerTeamId={raceViewer} compact={variant === 'medium'} />
              )}
            </div>
            <div className="min-w-0 space-y-6">
              {me && (
                <RaceUpNext
                  graph={raceG}
                  route={me.route}
                  teamName={me.team.name}
                  tileById={tileById}
                  progressFor={progressFor}
                  racersFor={racersFor}
                  onTileClick={setSelectedTileId}
                  canPick={!!racePick.pickInfo?.canPick}
                  picking={racePick.picking}
                  onPick={racePick.pick}
                  pickError={racePick.pickError}
                />
              )}
              {!curtain && <RaceGapWatch sentences={gapWatch(raceLineList, raceG)} />}
            </div>
          </div>
        )}

        {!curtain && <RaceFeedList items={raceFeed(raceG, teams, completions, labelOf)} now={raceNow} onTileClick={setSelectedTileId} />}

        {tileModal}
      </div>
    );
  }

  return (
    // Phones: the board comes straight after its controls; the MVP cards follow it.
    <div className="max-sm:flex max-sm:flex-col">
      {/* Identity, prize and countdown now live in the EventHero above the board; this row keeps just
          the board-level controls. */}
      {/* Phones: this row only shows for a live draft link. Its standings toggle moves into the board's
          own heading there, so the board is not pushed down by a row holding one button. */}
      <div className={`mb-6 flex flex-wrap items-center gap-3 max-sm:order-1 ${draftActive ? '' : 'max-sm:hidden'}`}>
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
          className={`text-xs px-3 py-1.5 max-sm:hidden rounded-lg border transition-colors ${
            fullscreen
              ? 'bg-gold/20 border-gold text-gold'
              : 'border-card-border text-text-muted hover:border-gold/50 hover:text-gold'
          }`}
        >
          {fullscreen ? 'Show Standings' : 'Fullscreen Board'}
        </button>
      </div>

      {(mvpToday || mvp) && (
        <div className={`mb-6 grid gap-3 max-sm:order-3 ${mvpToday && mvp ? 'sm:grid-cols-2' : ''}`}>
          {mvpToday && (
            <MvpHighlight label="MVP of the day" emoji="🔥" name={mvpToday.name} points={mvpToday.points} tasks={mvpToday.tasks} pointsMode={pointsMode} teamName={mvpToday.teamName} teamColor={mvpToday.teamColor} />
          )}
          {mvp && (
            <MvpHighlight label="Event MVP" emoji="🏆" name={mvp.name} points={mvp.points} tasks={mvp.tasks} pointsMode={pointsMode} teamName={mvp.teamName} teamColor={mvp.teamColor} />
          )}
        </div>
      )}

      <div className={`grid gap-8 items-start max-sm:order-2 ${fullscreen ? '' : 'lg:grid-cols-[1fr_1.2fr]'}`}>
        {!fullscreen && (
          <div className="min-w-0 max-lg:order-2">
            <h2 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2">
              <span className="w-1 h-5 bg-gold rounded-full" />
              {curtain ? (teams.length > 0 ? 'Your team' : 'Standings') : 'Standings'}
            </h2>
            {curtain && <StandingsHiddenNotice curtain={curtain} ownTeamNames={teams.map((t) => t.name)} className="mb-4" />}
            {windowed && !curtain ? (
              <SoloStandings teams={teams} scores={scores} eventId={event.id} pointsMode={pointsMode} myTeamIds={myTeamIds} noun={solo ? 'players' : 'teams'} members={teamMembers} />
            ) : (!curtain || teams.length > 0) && <Scoreboard
              teams={teams}
              scores={scores}
              eventId={event.id}
              dropProgressByTeam={dropProgressByTeam}
              pointsMode={pointsMode}
              teamMvps={teamMvps}
              unranked={!!curtain}
            />}

            {/* XP/Stat Gains */}
            {statTiles.some((t) => t.statType === 'skill' && t.statBasis !== 'milestone') && teamGains.length > 0 && (
              <div className="mt-6">
                <h3 className="text-md font-bold mb-3 text-foreground flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-400 rounded-full" />
                  XP gained
                  {windowed && teamGains.length > SOLO_XP_SHOWN && (
                    <span className="text-xs font-normal text-text-muted">top {SOLO_XP_SHOWN} of {teamGains.length.toLocaleString()} {solo ? 'players' : 'teams'}</span>
                  )}
                </h3>
                <div className="space-y-2">
                  {[...teamGains]
                    .sort((a, b) => b.totalGained - a.totalGained)
                    // A players board: the leaders, not one row per player.
                    .slice(0, windowed ? SOLO_XP_SHOWN : undefined)
                    .map((tg, index) => {
                      const team = teams.find((t) => t.id === tg.teamId);
                      return (
                        <div
                          key={tg.teamId}
                          className="flex items-center justify-between border border-card-border rounded-lg p-3 bg-card-bg"
                        >
                          <div className="flex items-center gap-3">
                            {!curtain && <span className="text-lg font-bold text-gold w-6">#{index + 1}</span>}
                            {team?.color && (
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                            )}
                            <span className="font-medium">{team?.name || 'Unknown'}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-blue-400" title={exactTitle(tg.totalGained)}>
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
        <div className="min-w-0 max-lg:order-1">
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span className="w-1 h-5 bg-gold rounded-full" />
              {scheduled ? 'Tonight\u2019s schedule' : liveDropBoard ? 'Live board' : 'Board Overview'}
              <span className="text-xs font-normal text-text-muted ml-2 max-sm:hidden">(click tiles for details)</span>
            </h2>
            {/* Phones: the standings toggle lives here (see the controls row above). */}
            <button
              type="button"
              onClick={() => setFullscreen(!fullscreen)}
              className={`ml-auto min-h-11 rounded-lg border px-3 text-xs transition-colors sm:hidden ${
                fullscreen ? 'border-gold bg-gold/20 text-gold' : 'border-card-border text-text-muted'
              }`}
            >
              {fullscreen ? 'Show standings' : 'Hide standings'}
            </button>
            {/* Multi-claim boards read very differently as "everyone" vs "us" — so let the viewer choose. */}
            {!liveDropBoard && (
              <TeamLens teams={teams} value={lensTeamId} onChange={setLensTeamId} className="ml-auto" compact={windowed} mine={myTeamIds} noun={solo ? 'player' : 'team'} />
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
          {/* Phones: search and filters fold into one bar so the board is the first thing under the title. */}
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            className="mb-3 flex min-h-11 w-full items-center justify-between rounded-lg border border-card-border bg-card-bg px-3 text-sm text-text-muted sm:hidden"
          >
            <span>Search &amp; filter{filterActive ? <span className="ml-1.5 text-gold">· on</span> : null}</span>
            <span aria-hidden>{filtersOpen ? '−' : '+'}</span>
          </button>
          <div className={filtersOpen ? undefined : 'max-sm:hidden'}>
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
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tiles…"
              className="pl-9 pr-9 rounded-lg placeholder:text-text-muted focus:border-gold/50"
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
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 mb-4">
              {categories.length > 0 && (
                <Select
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={[{ value: 'all', label: 'All categories' }, ...categories.map((c) => ({ value: c, label: c }))]}
                  ariaLabel="Filter board by category"
                  className="shrink-0 sm:w-48"
                />
              )}
              {showTypeFilter && (
                <Select
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={typeOptions}
                  ariaLabel="Filter board by tile type"
                  className="shrink-0 sm:w-44"
                />
              )}
              {showTierFilter && (
                <Select
                  value={tierFilter}
                  onChange={setTierFilter}
                  options={[
                    { value: 'all', label: 'All tiers' },
                    ...tierBands.map((t, i) => ({ value: t.key, label: t.label, dot: tierColor(i, tierBands.length) })),
                  ]}
                  ariaLabel="Filter board by tier"
                  className="shrink-0 sm:w-48"
                />
              )}
              {filterActive && (
                <button
                  onClick={() => {
                    setCategoryFilter('all');
                    setTierFilter('all');
                    setTypeFilter('all');
                  }}
                  className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg text-text-muted hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}
          </div>

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
          {(missions.length > 0 || lockedMissions.length > 0) && (
            <div className="mb-4">
              <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-gold rounded-full" />
                Missions
                <span className="text-xs font-normal text-text-muted">
                  bonus points — earned on top of the board total
                </span>
              </h3>
              <div className="rounded-xl border border-gold/25 bg-gold/5 divide-y divide-gold/15 overflow-hidden">
                {lockedMissions.map((m) => (
                  <div key={`locked-${m.id}`} className="w-full px-3 py-2.5 flex items-center gap-3 opacity-70">
                    <span aria-hidden className="text-base">⚡</span>
                    <span className="flex-1 min-w-0 text-sm font-medium truncate text-text-muted">{m.label}</span>
                    <TileStateChip view={{ kind: 'locked', label: 'Locked', detail: 'Not announced yet' }} withDetail className="shrink-0" />
                  </div>
                ))}
                {missions.map((m) => {
                  // The shared tile-state look (lib/tileState): Live (time left) / Done / Closed / Expired. Behind the
                  // curtain `teams` is the viewer's own, so another team's claim reads "Closed" with no name.
                  const doneRow = completions.find((c) => c.tileId === m.id && (lensTeamId == null || c.teamId === lensTeamId));
                  const anyRow = completions.find((c) => c.tileId === m.id);
                  const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? null;
                  const view = missionTileState(
                    { revealedAt: m.revealedAt, closedAt: m.closedAt, expiryHours: parseTileMissionRules(m.rules ?? null).expiryHours },
                    { done: !!doneRow, doneBy: doneRow ? teamName(doneRow.teamId) : null, claimedBy: !doneRow && anyRow ? teamName(anyRow.teamId) : null, claimed: !doneRow && !!anyRow },
                  );
                  const faded = view.kind === 'expired' || view.kind === 'closed';
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedTileId(m.id)}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-gold/10 transition-colors ${faded ? 'opacity-60 grayscale' : ''}`}
                    >
                      <span aria-hidden className="text-base">⚡</span>
                      <span className={`flex-1 min-w-0 text-sm font-medium truncate ${view.kind === 'done' ? 'text-gold' : faded ? 'text-text-muted' : 'text-foreground'}`}>
                        {m.label}
                      </span>
                      <TileStateChip view={view} withDetail className="shrink-0" />
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
              lensName={lensTeamId == null ? (creator ? 'everyone' : 'the clan') : (teams.find((t) => t.id === lensTeamId)?.name ?? 'your team')}
              onTileClick={setSelectedTileId}
            />
          )}

          {/* Phones: fullscreen lets the board bleed to the screen edges so tiles use every pixel. */}
          <div className={fullscreen ? 'max-sm:-mx-4' : undefined}>
          <EventBoard
            format={event.format}
            tiles={board}
            boardSize={event.boardSize}
            completions={completions}
            teams={teams}
            activeTeamId={lensTeamId ?? undefined}
            onTileClick={setSelectedTileId}
            onTileIntent={intentTile}
            statProgress={statProgressMap}
            dropProgress={dropProgressMap}
            expanded={fullscreen}
            pointsMode={pointsMode}
            matchedTileIds={matchedTileIds}
            staffOnlyTileIds={staffOnlySet}
            linePositions={linePositions}
            neededPositions={neededPositions}
            tierBands={tierBands}
          />
          </div>

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
      {tileModal}
    </div>
  );
}

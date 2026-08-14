'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import LiveDropBoard from '@/components/LiveDropBoard';
import TileDetailModal from '@/components/TileDetailModal';
import LadderHero from '@/components/ladder/LadderHero';
import YouStrip from '@/components/ladder/YouStrip';
import YourSeason from '@/components/ladder/YourSeason';
import { ScopeBar, Podium, Chase } from '@/components/ladder/LadderBoard';
import { HallOfLadder, ActivityFeed } from '@/components/ladder/LadderExtras';
import { parseEventRules } from '@/lib/eventRules';
import { isPointsMode } from '@/lib/utils';
import type { LadderScope, LadderView } from '@/lib/ladderView';
import type { Tile as FullTile, Submission as FullSubmission } from '@/lib/types';

/**
 * The ladder event page.
 *
 * A ladder is scored per person and usually never ends, so it gets its own surface rather than the
 * team scoreboard with the team parts switched off: the hero counts down to the RESET, the viewer's
 * own position is pinned to the top, the top three get a podium, and the board itself is the small
 * set of tasks that are open right now rather than a grid of everything that exists.
 *
 * All the derivation lives on the server (lib/ladderView) — this composes and ticks.
 */

interface LadderTile {
  id: number;
  label: string;
  points?: number | null;
  icon?: string | null;
  revealedAt?: string | null;
  closedAt?: string | null;
}

interface Props {
  event: {
    id: number;
    name: string;
    scoringMode?: string | null;
    rules?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    forceEndedAt?: string | null;
  };
  tiles: LadderTile[];
  view: LadderView;
  shapeBadge: string;
  hiddenTileCount: number;
  nextRevealAt: string | null;
  prizePool: number;
  prizeBreakdown: string | null;
  placementPrizes: number[];
  /** Rotation expiry per open tile, computed server-side from the reveal rules. */
  expiryByTile: Record<number, string>;
  showTeam: boolean;
  /** Every task in the pool, revealed or not — the hero's "N open of M". */
  poolSize: number;
}

export default function LadderClient({
  event,
  tiles,
  view,
  shapeBadge,
  hiddenTileCount,
  nextRevealAt,
  prizePool,
  prizeBreakdown,
  placementPrizes,
  expiryByTile,
  showTeam,
  poolSize,
}: Props) {
  const router = useRouter();
  const rules = useMemo(() => parseEventRules(event.rules), [event.rules]);
  const pointsMode = isPointsMode(event.scoringMode);
  const [scopeKey, setScopeKey] = useState<LadderScope['key']>(view.defaultScope);
  const scope = view.scopes.find((s) => s.key === scopeKey) ?? view.scopes[0];
  const openNow = tiles.filter((t) => t.revealedAt && !t.closedAt).length;

  // Relative timestamps in the feed need a client clock, and rendering them on the server would
  // hydrate to a different string a second later.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Same live-refresh contract as the team scoreboard: poll a cheap ETag'd pulse on tab focus and
  // only re-fetch when the board actually moved.
  const onBoardChange = useCallback(() => router.refresh(), [router]);
  useLiveRefresh({ url: `/api/events/${event.id}/pulse`, onChange: onBoardChange });

  // Proof for the tile the viewer opened, fetched on demand (a busy ladder has thousands of rows).
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [tileProof, setTileProof] = useState<{ tileId: number; rows: FullSubmission[] } | null>(null);
  useEffect(() => {
    if (!selectedTileId) return;
    let cancelled = false;
    const tileId = selectedTileId;
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
  const selectedTile = selectedTileId ? tiles.find((t) => t.id === selectedTileId) : null;

  const word = view.lifecycle === 'bounded' ? 'run' : view.lifecycle === 'endless' ? 'month' : 'season';

  return (
    <div>
      <LadderHero
        name={event.name}
        lifecycle={view.lifecycle}
        season={view.season}
        startDate={event.startDate}
        endDate={event.endDate}
        forceEndedAt={event.forceEndedAt}
        shapeBadge={shapeBadge}
        openNow={openNow}
        poolSize={poolSize}
        totalPlayers={view.totalPlayers}
        prizePool={prizePool}
        prizeBreakdown={prizeBreakdown}
        placementPrizes={placementPrizes}
        champion={view.champion}
        chaser={view.chaser}
      />

      {view.me && <YouStrip me={view.me} openNow={openNow} />}

      <ScopeBar scopes={view.scopes} value={scopeKey} onChange={setScopeKey} note={scope.note} />
      <div className="mb-8">
        <Podium
          scope={scope}
          streaks={view.streaks}
          sparks={view.sparks}
          mePlayerId={view.me?.playerId ?? null}
          showTeam={showTeam}
        />
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0">
          <h2 className="mb-4 flex flex-wrap items-center gap-2 text-lg font-bold text-foreground">
            <span className="h-5 w-1 rounded-full bg-gold" />
            Open now
            <span className="text-xs font-normal text-text-muted">
              {rules.revealPolicy === 'rotating'
                ? 'the board rotates — the oldest task expires as the next drops'
                : 'click a task for details'}
            </span>
          </h2>
          <LiveDropBoard
            tiles={tiles}
            rules={rules}
            nextRevealAt={nextRevealAt}
            hiddenCount={hiddenTileCount}
            pointsMode={pointsMode}
            completedTileIds={new Set(view.myClaimedTileIds)}
            onTileClick={setSelectedTileId}
            noun="task"
            expiryByTile={expiryByTile}
            claimsByTile={view.claimsByTile}
          />
          {view.me && <YourSeason me={view.me} word={word} />}
        </div>

        <div className="min-w-0">
          <Chase scope={scope} streaks={view.streaks} mePlayerId={view.me?.playerId ?? null} showTeam={showTeam} />
          {nowMs !== null && <ActivityFeed feed={view.feed} nowMs={nowMs} />}
        </div>
      </div>

      {view.hall && <HallOfLadder hall={view.hall} />}

      {selectedTile && (
        <TileDetailModal
          tile={selectedTile as unknown as FullTile}
          submissions={proofForOpenTile ?? []}
          submissionsLoading={proofForOpenTile === null}
          completedBy={[]}
          canSubmit={false}
          canManage={false}
          canToggle={false}
          onClose={() => setSelectedTileId(null)}
          eventId={event.id}
          pointsMode={pointsMode}
        />
      )}
    </div>
  );
}

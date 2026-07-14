'use client';

import type { Event, Tile, Team, Completion, Submission, Player, PlayerGain } from '@/lib/types';
import { useState, useEffect, useCallback, useMemo } from 'react';
import EventBoard from '@/components/EventBoard';
import TileDetailModal from '@/components/TileDetailModal';
import Link from 'next/link';
import { useDropProgress } from '@/hooks/useDropProgress';
import { ErrorBanner } from '@/components/BoardSkeleton';
import { tileWeight, isPointsMode } from '@/lib/utils';
import { computeMemberBreakdown } from '@/lib/memberBreakdown';
import MemberBreakdown from '@/components/MemberBreakdown';
import PlayerContributions from '@/components/PlayerContributions';
import BoardFilters from '@/components/BoardFilters';
import { DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';

interface Props {
  event: Event;
  team: Team;
  tiles: Tile[];
  completions: Completion[];
  players: Player[];
  tierBands?: TierBand[];
}

export default function TeamBoardClient({ event, team, tiles, completions, players, tierBands = DEFAULT_TIER_BANDS }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [matchedTileIds, setMatchedTileIds] = useState<Set<number> | null>(null);
  const [gains, setGains] = useState<Record<number, PlayerGain[]>>({});
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  // Which member's contributions the full-width detail panel shows (none until you pick one).
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  const teamPlayers = useMemo(() => players.filter((p) => p.teamId === team.id), [players, team.id]);

  const fetchSubmissions = useCallback(async () => {
    const res = await fetch(`/api/events/${event.id}/submissions?teamId=${team.id}`);
    if (res.ok) setSubmissions(await res.json());
  }, [event.id, team.id]);

  const fetchGains = useCallback(async () => {
    const res = await fetch(`/api/events/${event.id}/gains?teamId=${team.id}`);
    if (res.ok) {
      const data = await res.json();
      const gainsMap: Record<number, PlayerGain[]> = {};
      for (const tile of tiles) {
        if (tile.trackedStat) {
          gainsMap[tile.id] = [];
          for (const p of teamPlayers) {
            const playerData = data.find((d: { playerId: number }) => d.playerId === p.id);
            if (playerData) {
              const gained = playerData.gains?.[tile.trackedStat] ?? 0;
              const current = playerData.current?.[tile.trackedStat] ?? 0;
              gainsMap[tile.id].push({
                playerId: p.id,
                playerName: p.name,
                gained,
                current,
              });
            }
          }
        }
      }
      setGains(gainsMap);
    }
  }, [event.id, team.id, tiles, teamPlayers]);

  useEffect(() => {
    setFetchError(null);
    Promise.all([fetchSubmissions(), fetchGains()])
      .then(() => setLoading(false))
      .catch((err) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load board data');
        setLoading(false);
      });
  }, [fetchSubmissions, fetchGains]);

  const pointsMode = isPointsMode(event.scoringMode);
  const weightById = useMemo(
    () => new Map(tiles.map((t) => [t.id, tileWeight(event.scoringMode, t.points)])),
    [tiles, event.scoringMode],
  );
  const completed = pointsMode
    ? completions.reduce((sum, c) => sum + (weightById.get(c.tileId) || 0), 0)
    : completions.length;
  const total = pointsMode
    ? tiles.reduce((sum, t) => sum + tileWeight(event.scoringMode, t.points), 0)
    : tiles.length;
  const tilesLeft = total - completed;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const { dropProgress, perItemProgressMap } = useDropProgress(tiles, submissions);

  const memberBreakdown = useMemo(
    () =>
      computeMemberBreakdown({
        teamId: team.id,
        scoringMode: event.scoringMode,
        players: teamPlayers,
        tiles,
        completions,
        submissions,
        statGains: gains,
      }),
    [team.id, event.scoringMode, teamPlayers, tiles, completions, submissions, gains],
  );

  const selectedMember = selectedMemberId != null ? teamPlayers.find((p) => p.id === selectedMemberId) ?? null : null;
  const selectedMemberSubmissions =
    selectedMemberId != null ? submissions.filter((s) => s.creditPlayerId === selectedMemberId) : [];
  // Skill/boss (hiscores-tracked) contributions for the panel — pulled from the breakdown.
  const selectedMemberStatContributions =
    selectedMemberId != null
      ? (memberBreakdown.find((m) => m.playerId === selectedMemberId)?.contributions ?? []).filter(
          (c) => c.statType != null,
        )
      : [];

  const selectedTile = tiles.find((t) => t.id === selectedTileId);
  const selectedTileSubmissions = submissions.filter((s) => s.tileId === selectedTileId);
  const selectedTileCompletedBy = selectedTileId
    ? completions
        .filter((c) => c.tileId === selectedTileId)
        .map(() => ({ teamId: team.id, teamName: team.name, color: team.color }))
    : [];

  return (
    <div>
      <Link href={`/events/${event.id}`} className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-4">
        &larr; Back to scoreboard
      </Link>

      <div className="flex flex-wrap items-center gap-3 mb-1">
        <div
          className="w-5 h-5 rounded-full ring-2 ring-offset-2 ring-offset-background ring-current"
          style={{ backgroundColor: team.color, color: team.color }}
        />
        <h1 className="text-2xl sm:text-3xl font-bold">{team.name}</h1>
      </div>
      <p className="text-text-muted text-sm mb-2">{event.name}</p>

      {fetchError && (
        <ErrorBanner
          message={fetchError}
          onRetry={() => {
            setLoading(true);
            setFetchError(null);
            Promise.all([fetchSubmissions(), fetchGains()])
              .then(() => setLoading(false))
              .catch((err) => {
                setFetchError(err instanceof Error ? err.message : 'Failed to load board data');
                setLoading(false);
              });
          }}
        />
      )}


      {/* Desktop: team summary beside the board (mirrors the event page); stacks on mobile so the
          board leads. items-start keeps the shorter summary column pinned to the top. */}
      <div className="grid gap-6 lg:gap-8 items-start lg:grid-cols-[minmax(0,20rem)_1fr]">
        {/* Summary column */}
        <div className="space-y-5 lg:sticky lg:top-20">
          {/* Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-text-muted">{completed}/{total} {pointsMode ? 'pts' : 'completed'}</span>
              <span className="font-medium" style={{ color: team.color }}>{percentage}%</span>
            </div>
            <div className="w-full bg-brown-dark rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${percentage}%`,
                  background: `linear-gradient(90deg, ${team.color}cc, ${team.color})`,
                }}
              />
            </div>
            <p className="text-xs text-text-muted mt-1">{tilesLeft} {pointsMode ? 'pts ' : ''}remaining</p>
          </div>

          {/* Member breakdown — collapsible: points (points mode) / tasks each member contributed */}
          {teamPlayers.length > 0 && (
            <div className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
              <button
                type="button"
                onClick={() => setBreakdownOpen((v) => !v)}
                aria-expanded={breakdownOpen}
                className="w-full flex items-center gap-2 px-4 py-3 text-left"
              >
                <span className={`text-text-muted text-xs transition-transform ${breakdownOpen ? 'rotate-90' : ''}`} aria-hidden>
                  &#9656;
                </span>
                <span className="text-sm font-semibold">Member breakdown</span>
                <span className="text-xs text-text-muted ml-auto">{pointsMode ? 'points · tasks' : 'tasks'}</span>
              </button>
              {breakdownOpen && (
                <div className="px-4 pb-3 border-t border-card-border">
                  <MemberBreakdown
                    members={memberBreakdown}
                    pointsMode={pointsMode}
                    selectedPlayerId={selectedMemberId}
                    onSelect={setSelectedMemberId}
                  />
                </div>
              )}
            </div>
          )}

          {/* Team Roster */}
          {teamPlayers.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full" style={{ backgroundColor: team.color }} />
                Team Roster
              </h2>
              <div className="flex flex-wrap gap-2">
                {teamPlayers.map((player) => (
                  <span
                    key={player.id}
                    className="text-sm px-3 py-1.5 rounded-lg border border-card-border bg-card-bg"
                  >
                    {player.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Board column — the picked member's detail slides in beside the board on wide (xl)
            screens and stacks beneath it on narrower ones, so it never pushes the board down. */}
        <div className={`min-w-0${selectedMember ? ' grid gap-6 items-start xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]' : ''}`}>
          <div className="min-w-0">
            <BoardFilters tiles={tiles} tierBands={tierBands} pointsMode={pointsMode} onMatched={setMatchedTileIds} />
            <EventBoard
              format={event.format}
              tiles={tiles}
              boardSize={event.boardSize}
              completions={completions}
              teams={[team]}
              activeTeamId={team.id}
              onTileClick={(tileId) => setSelectedTileId(tileId)}
              dropProgress={dropProgress}
              pointsMode={pointsMode}
              matchedTileIds={matchedTileIds}
            />
          </div>
          {selectedMember && (
            <aside className="min-w-0 xl:sticky xl:top-20">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Member detail</span>
                <button
                  type="button"
                  onClick={() => setSelectedMemberId(null)}
                  className="text-text-muted hover:text-foreground text-xl leading-none w-7 h-7 flex items-center justify-center -mr-1"
                  aria-label="Close member detail"
                >
                  ×
                </button>
              </div>
              <PlayerContributions
                submissions={selectedMemberSubmissions}
                tiles={tiles}
                playerName={selectedMember.name}
                statContributions={selectedMemberStatContributions}
              />
            </aside>
          )}
        </div>
      </div>

      {/* View-only Tile Detail Modal */}
      {selectedTile && (
        <TileDetailModal
          tile={selectedTile}
          submissions={selectedTileSubmissions}
          completedBy={selectedTileCompletedBy}
          canSubmit={false}
          canManage={false}
          canToggle={false}
          onClose={() => setSelectedTileId(null)}
          eventId={event.id}
          teamId={team.id}
          dropProgress={dropProgress.get(selectedTile.id)}
          perItemProgress={perItemProgressMap.get(selectedTile.id)}
          statProgress={gains[selectedTile.id]}
          pointsMode={pointsMode}
        />
      )}
    </div>
  );
}

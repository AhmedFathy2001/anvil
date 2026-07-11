'use client';

import type { Event, Tile, Team, Completion, Submission, Player, PlayerGain } from '@/lib/types';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import EventBoard from '@/components/EventBoard';
import TileDetailModal from '@/components/TileDetailModal';
import PlayerContributions from '@/components/PlayerContributions';
import LocalTime from '@/components/LocalTime';
import { useCountdown, useRefreshCountdown } from '@/hooks/useCountdown';
import { useDropProgress } from '@/hooks/useDropProgress';
import { ErrorBanner } from '@/components/BoardSkeleton';
import { tileWeight, isPointsMode } from '@/lib/utils';
import Input from '@/components/Input';
import { computeMemberBreakdown } from '@/lib/memberBreakdown';
import MemberBreakdown from '@/components/MemberBreakdown';
import BoardFilters from '@/components/BoardFilters';
import { DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';

interface Props {
  event: Event;
  team: Team;
  tiles: Tile[];
  completions: Completion[];
  players: Player[];
  // Resolved from the Discord session: is this user the captain, and do they have a
  // player row on the team (a captain is usually also a player).
  isCaptain: boolean;
  myPlayerId: number | null;
  myPlayerName: string | null;
  tierBands?: TierBand[];
}

export default function MyTeamClient({
  event,
  team: initialTeam,
  tiles,
  completions: initialCompletions,
  players,
  isCaptain,
  myPlayerId,
  myPlayerName,
  tierBands = DEFAULT_TIER_BANDS,
}: Props) {
  const [team, setTeam] = useState(initialTeam);
  const [completions, setCompletions] = useState(initialCompletions);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [gains, setGains] = useState<Record<number, PlayerGain[]>>({});
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(initialTeam.name);
  const [newColor, setNewColor] = useState(initialTeam.color);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Board filters (search + category + tier) report their matched set here; null = no filter.
  const [matchedTileIds, setMatchedTileIds] = useState<Set<number> | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  // Which member's contributions the full-width detail panel shows. Defaults to you.
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(myPlayerId);

  const teamPlayers = useMemo(() => players.filter((p) => p.teamId === team.id), [players, team.id]);
  const eventStarted = !event.startDate || new Date(event.startDate) <= new Date();
  // Captains may rebrand (name + color) only between draft finalization and event start —
  // the API enforces the same window.
  const canEditName = isCaptain && !eventStarted && event.draftStatus === 'completed';

  const eventCountdown = useCountdown(!eventStarted ? event.startDate : null);
  const { countdown, setNextRefresh } = useRefreshCountdown();

  async function refreshStats() {
    setRefreshing(true);
    try {
      // Captains-only: refresh the whole team (the button is gated to captains).
      const body = { teamId: team.id };
      const res = await fetch(`/api/events/${event.id}/refresh-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setLastFetch(data.lastFetch);
        await fetchGains();
      } else if (res.status === 429 && data.nextRefresh) {
        setNextRefresh(new Date(data.nextRefresh));
      }
    } finally {
      setRefreshing(false);
    }
  }

  const fetchSubmissions = useCallback(async () => {
    const res = await fetch(`/api/events/${event.id}/submissions?teamId=${team.id}`);
    if (res.ok) setSubmissions(await res.json());
  }, [event.id, team.id]);

  const fetchCompletions = useCallback(async () => {
    const res = await fetch(`/api/events/${event.id}/completions`);
    if (res.ok) {
      const data = await res.json();
      setCompletions(data.filter((c: Completion) => c.teamId === team.id));
    }
  }, [event.id, team.id]);

  const fetchGains = useCallback(async () => {
    const res = await fetch(`/api/events/${event.id}/gains?teamId=${team.id}`);
    if (res.ok) {
      const data = await res.json();
      const gainsMap: Record<number, PlayerGain[]> = {};
      let latestFetch: string | null = null;
      for (const tile of tiles) {
        if (tile.trackedStat) {
          gainsMap[tile.id] = [];
          for (const p of teamPlayers) {
            const playerData = data.find((d: { playerId: number }) => d.playerId === p.id);
            if (playerData) {
              gainsMap[tile.id].push({
                playerId: p.id,
                playerName: p.name,
                gained: playerData.gains?.[tile.trackedStat] ?? 0,
                current: playerData.current?.[tile.trackedStat] ?? 0,
              });
              if (playerData.lastFetch && (!latestFetch || playerData.lastFetch > latestFetch)) {
                latestFetch = playerData.lastFetch;
              }
            }
          }
        }
      }
      setGains(gainsMap);
      if (latestFetch) setLastFetch(latestFetch);
    }
  }, [event.id, team.id, tiles, teamPlayers]);

  useEffect(() => {
    async function loadData() {
      setFetchError(null);
      try {
        await Promise.all([fetchSubmissions(), fetchGains()]);
        setLoading(false);
      } catch {
        setFetchError('Failed to load data. Please refresh.');
        setLoading(false);
      }
    }
    loadData();
  }, [fetchSubmissions, fetchGains]);

  function handleTileClick(tileId: number) {
    const tile = tiles.find((t) => t.id === tileId);
    if (!tile) return;
    // Always open the detail modal: captains toggle / manage from inside it (with the tile
    // overview, submissions and screenshots visible), members view read-only. Non-drop tiles
    // used to blind-toggle for captains and do nothing for members — both hid the overview.
    setSelectedTileId(tileId);
  }

  async function handleSubmit(data: { tileId: number; teamId: number; amount: number; imageUrl: string; note: string; creditPlayerId: number | null; durationSeconds?: number }) {
    const res = await fetch(`/api/events/${event.id}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      await fetchSubmissions();
      await fetchCompletions();
    }
  }

  async function handleDeleteSubmission(submissionId: number, reason: string) {
    const res = await fetch(
      `/api/events/${event.id}/submissions?submissionId=${submissionId}&reason=${encodeURIComponent(reason)}`,
      { method: 'DELETE' },
    );
    if (res.ok) {
      await fetchSubmissions();
      await fetchCompletions();
    }
  }

  async function handleToggle(tileId: number) {
    const res = await fetch(`/api/events/${event.id}/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: team.id, tileId }),
    });
    if (res.ok) await fetchCompletions();
  }

  const colorSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function saveTeamColorDirect(color: string) {
    setTeam((t) => ({ ...t, color }));
    // Native pickers fire change continuously while dragging — debounce to one save.
    if (colorSaveTimer.current) clearTimeout(colorSaveTimer.current);
    colorSaveTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/events/${event.id}/teams`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id, color }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTeam((t) => ({ ...t, color: updated.color }));
      }
    }, 700);
  }

  async function saveTeamName() {
    if (!newName.trim() || (newName === team.name && newColor === team.color)) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    setNameError(null);
    const res = await fetch(`/api/events/${event.id}/teams`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: team.id, name: newName.trim(), color: newColor }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTeam({ ...team, name: updated.name, color: updated.color });
      setEditingName(false);
    } else {
      const data = await res.json().catch(() => ({}));
      setNameError(data.error || 'Could not save.');
    }
    setSavingName(false);
  }

  const { dropProgress, perItemProgressMap } = useDropProgress(tiles, submissions);

  const statProgress = new Map<number, { current: number; goal: number; statType?: string }>();
  for (const tile of tiles) {
    if (tile.trackedStat && tile.statGoal) {
      const tileGains = gains[tile.id] || [];
      const totalGained = tileGains.reduce((sum, p) => sum + p.gained, 0);
      statProgress.set(tile.id, { current: totalGained, goal: tile.statGoal, statType: tile.statType || undefined });
    }
  }

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
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const selectedTile = tiles.find((t) => t.id === selectedTileId);
  const selectedTileSubmissions = submissions.filter((s) => s.tileId === selectedTileId);
  const selectedTileCompletedBy = selectedTileId
    ? completions.filter((c) => c.tileId === selectedTileId).map(() => ({ teamId: team.id, teamName: team.name, color: team.color }))
    : [];
  const selectedMember = teamPlayers.find((p) => p.id === selectedMemberId) ?? null;
  const selectedMemberSubmissions = selectedMemberId
    ? submissions.filter((s) => s.creditPlayerId === selectedMemberId)
    : [];

  const memberBreakdown = useMemo(
    () =>
      computeMemberBreakdown({
        teamId: team.id,
        scoringMode: event.scoringMode,
        players: teamPlayers,
        tiles,
        completions,
        submissions,
      }),
    [team.id, event.scoringMode, teamPlayers, tiles, completions, submissions],
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        {editingName ? (
          <label className="relative w-5 h-5 rounded-full ring-2 ring-offset-2 ring-offset-background cursor-pointer" style={{ backgroundColor: newColor }} title="Pick team color">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
        ) : canEditName ? (
          <label
            className="relative w-5 h-5 rounded-full ring-2 ring-offset-2 ring-offset-background cursor-pointer hover:ring-gold/70 transition-shadow"
            style={{ backgroundColor: team.color }}
            title="Click to change team color"
          >
            <input
              type="color"
              defaultValue={team.color}
              onChange={(e) => saveTeamColorDirect(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
        ) : (
          <div className="w-5 h-5 rounded-full ring-2 ring-offset-2 ring-offset-background" style={{ backgroundColor: team.color }} />
        )}
        {editingName ? (
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-xl font-bold bg-brown-dark border border-card-border rounded px-2 py-0.5"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTeamName();
                if (e.key === 'Escape') { setEditingName(false); setNewName(team.name); setNewColor(team.color); setNameError(null); }
              }}
            />
            <button onClick={saveTeamName} disabled={savingName} className="text-sm text-accent-green-light hover:text-accent-green transition-colors px-3 py-2 rounded-md hover:bg-accent-green/10">
              {savingName ? '...' : 'Save'}
            </button>
            <button onClick={() => { setEditingName(false); setNewName(team.name); setNewColor(team.color); setNameError(null); }} className="text-sm text-text-muted hover:text-foreground transition-colors px-3 py-2 rounded-md hover:bg-brown-light">
              Cancel
            </button>
            {nameError && <span className="text-xs text-red-400">{nameError}</span>}
          </div>
        ) : (
          <h1
            className={`text-2xl sm:text-3xl font-bold ${canEditName ? 'cursor-pointer hover:text-gold' : ''} transition-colors`}
            onClick={() => canEditName && setEditingName(true)}
            title={canEditName ? 'Click to edit team name & color' : undefined}
          >
            {team.name}
          </h1>
        )}
        {isCaptain && <span className="text-xs bg-accent-green/20 text-accent-green-light px-2 py-0.5 rounded-full font-medium">Captain</span>}
        {myPlayerName && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-medium">{myPlayerName}</span>}
      </div>
      <p className="text-text-muted text-sm mb-2">
        {event.name}
        {isCaptain && ' · Click tiles to toggle or submit'}
      </p>

      {eventCountdown && (
        <div className="mb-4 p-3 border border-gold/30 rounded-lg bg-gold/10 text-center">
          <p className="text-xs text-text-muted mb-1">Event starts in</p>
          <p className="text-lg font-bold text-gold">{eventCountdown}</p>
          {event.startDate && <p className="text-xs text-text-muted mt-1"><LocalTime date={event.startDate} /></p>}
        </div>
      )}

      {/* Manual refresh is captains-only now — a team override on top of the periodic stats cron.
          Regular members no longer refresh their own stats (rate-limit hygiene). */}
      {isCaptain && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={refreshStats}
            disabled={refreshing || !!countdown || !eventStarted}
            className="px-3 py-1.5 text-xs font-medium rounded bg-blue-500/20 border border-blue-500 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
          >
            {refreshing ? 'Refreshing...' : countdown ? `Wait ${countdown}` : !eventStarted ? 'Awaiting Event Start' : 'Refresh Team Stats'}
          </button>
          {lastFetch && <span className="text-xs text-text-muted">Last updated: <LocalTime date={lastFetch} /></span>}
        </div>
      )}

      {fetchError && <ErrorBanner message={fetchError} onRetry={() => { setFetchError(null); setLoading(true); fetchSubmissions().then(() => fetchGains()).then(() => setLoading(false)).catch(() => { setFetchError('Failed to load data. Please refresh.'); setLoading(false); }); }} />}

      {/* Desktop: team summary beside the board (mirrors the event + team-progress pages); stacks on
          mobile. Same shape as the view-only team board so the two never feel like different apps. */}
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
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${percentage}%`, background: `linear-gradient(90deg, ${team.color}cc, ${team.color})` }} />
            </div>
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
                <span className={`text-text-muted text-xs transition-transform ${breakdownOpen ? 'rotate-90' : ''}`} aria-hidden>&#9656;</span>
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

          {/* Team roster — collapsed by default so the board stays the focus. */}
          {teamPlayers.length > 0 && (
            <details className="border border-card-border rounded-xl bg-card-bg group">
              <summary className="cursor-pointer select-none list-none px-4 py-2.5 flex items-center gap-2 text-sm font-medium">
                <span className="transition-transform group-open:rotate-90 text-text-muted">▸</span>
                <span className="w-1 h-4 rounded-full" style={{ backgroundColor: team.color }} />
                Team Roster ({teamPlayers.length})
              </summary>
              <div className="px-4 pb-3 flex flex-wrap gap-2">
                {teamPlayers.map((player) => (
                  <span key={player.id} className="text-sm px-3 py-1.5 rounded-lg border border-card-border bg-brown-dark">
                    {player.name}
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Board column */}
        <div className="min-w-0">
          <BoardFilters tiles={tiles} tierBands={tierBands} pointsMode={pointsMode} onMatched={setMatchedTileIds} />
          <EventBoard
            format={event.format}
            tiles={tiles}
            boardSize={event.boardSize}
            completions={completions}
            teams={[team]}
            activeTeamId={team.id}
            interactive={isCaptain}
            onTileClick={handleTileClick}
            dropProgress={dropProgress}
            statProgress={statProgress}
            pointsMode={pointsMode}
            matchedTileIds={matchedTileIds}
          />
        </div>
      </div>

      {/* Full-width detail for whoever's selected in the member breakdown (defaults to you) — the
          same list, just given room. Pick a different member above to see theirs. */}
      {selectedMember && (
        <div className="mt-8">
          <PlayerContributions
            submissions={selectedMemberSubmissions}
            tiles={tiles}
            playerName={selectedMemberId === myPlayerId ? (myPlayerName || 'You') : selectedMember.name}
          />
        </div>
      )}

      {selectedTile && (
        <TileDetailModal
          tile={selectedTile}
          submissions={selectedTileSubmissions}
          completedBy={selectedTileCompletedBy}
          canSubmit={eventStarted}
          canManage={isCaptain && eventStarted}
          canToggle={isCaptain && !selectedTile.trackedStat && eventStarted}
          onSubmit={handleSubmit}
          onDelete={handleDeleteSubmission}
          onToggle={handleToggle}
          onClose={() => setSelectedTileId(null)}
          eventId={event.id}
          teamId={team.id}
          dropProgress={dropProgress.get(selectedTile.id)}
          perItemProgress={perItemProgressMap.get(selectedTile.id)}
          teamPlayers={teamPlayers.map((p) => ({ id: p.id, name: p.name }))}
          currentPlayerId={myPlayerId ?? undefined}
          statProgress={gains[selectedTile.id]}
          pointsMode={pointsMode}
        />
      )}
    </div>
  );
}

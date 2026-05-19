'use client';

import type { Event, Tile, Team, Completion, Player } from '@/lib/types';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BingoBoard from '@/components/BingoBoard';
import TeamForm from '@/components/TeamForm';
import DraftOrderSetup from '@/components/DraftOrderSetup';
import DraftPlayerPool from '@/components/DraftPlayerPool';
import DraftStatus from '@/components/DraftStatus';
import DraftRosters from '@/components/DraftRosters';
import PlayerStatsPanel from '@/components/PlayerStatsPanel';
import TileTrackingConfig from '@/components/TileTrackingConfig';
import PlayerBaselineEditor from '@/components/PlayerBaselineEditor';
import PlayerEditor from '@/components/PlayerEditor';
import { useEventStream, EventStreamData } from '@/hooks/useEventStream';
import DateRangeField from '@/components/DateRangeField';
import ClanMemberPicker from '@/components/ClanMemberPicker';
import SignupAdminPanel from './SignupAdminPanel';

// Convert UTC ISO string to local datetime-local input format
function utcToLocal(utcString: string | null): string {
  if (!utcString) return '';
  const date = new Date(utcString);
  if (isNaN(date.getTime())) return '';
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Convert local datetime-local input to UTC ISO string
function localToUtc(localString: string): string | null {
  if (!localString) return null;
  const date = new Date(localString);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
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
  tiles: Tile[];
  teams: Team[];
  completions: Completion[];
  players: Player[];
}

export default function AdminEventClient({ event, tiles, teams, completions, players: initialPlayers }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [selectedClanMemberIds, setSelectedClanMemberIds] = useState<number[]>([]);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [statsRsn, setStatsRsn] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draftAction, setDraftAction] = useState('');
  const [picking, setPicking] = useState(false);

  // ISO strings (or '' when unset) — DateRangeField handles the local↔UTC plumbing
  // internally, so we no longer need utcToLocal/localToUtc at this layer.
  const [startDate, setStartDate] = useState(() => event.startDate ?? '');
  const [endDate, setEndDate] = useState(() => event.endDate ?? '');
  const [savingDates, setSavingDates] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [forceResetting, setForceResetting] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<{ snapshotted: number; refreshed?: number; failed: string[]; error?: string } | null>(null);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [lastStatsRefresh, setLastStatsRefresh] = useState<Date | null>(null);
  const [editingTileId, setEditingTileId] = useState<number | null>(null);
  const [localTiles, setLocalTiles] = useState<Tile[]>(tiles);
  const [resettingSnapshot, setResettingSnapshot] = useState<number | null>(null);
  const [resendingRoster, setResendingRoster] = useState(false);
  const [rosterMessage, setRosterMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [lastUndone, setLastUndone] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<{
    id: number;
    tileId: number;
    teamId: number;
    playerId: number | null;
    creditPlayerId: number | null;
    amount: number;
    uploaderName?: string | null;
    creditPlayerName?: string | null;
    createdAt: string;
  }[]>([]);
  const [liveCompletions, setLiveCompletions] = useState<Completion[]>(completions);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showStatTracking, setShowStatTracking] = useState(false);
  const [showSignups, setShowSignups] = useState(false);
  const [editingBaselinePlayer, setEditingBaselinePlayer] = useState<{ id: number; name: string } | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<{ id: number; name: string; discord: string | null; timezone: string | null } | null>(null);
  const [forceEnding, setForceEnding] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(event);

  const eventStarted = currentEvent.startDate ? new Date(currentEvent.startDate) <= new Date() : false;
  const eventEnded = currentEvent.endDate ? new Date(currentEvent.endDate) <= new Date() : false;
  const isForceEnded = !!currentEvent.forceEndedAt;
  // Draft = no start date set yet and not force-ended. Public listings hide drafts;
  // here on the admin view we surface them with their own badge so the state isn't ambiguous.
  const isDraft = !isForceEnded && !currentEvent.startDate;
  const isActive = eventStarted && !eventEnded;

  // Real-time updates via smart polling
  const { connected: streamConnected } = useEventStream(event.id, {
    onUpdate: useCallback((data: EventStreamData) => {
      setLiveCompletions(data.completions);
      setSubmissions(data.submissions.map((s) => ({
        ...s,
        uploaderName: null,
      })));
      setLocalTiles(data.tiles);
    }, []),
  });

  const [draft, setDraft] = useState<DraftState>({
    status: event.draftStatus,
    teamOrder: event.draftOrder ? JSON.parse(event.draftOrder) : [],
    players: initialPlayers,
    teams,
    currentPickNumber: initialPlayers.filter((p) => p.teamId !== null).length,
    currentTeamId: null,
    round: 0,
    pickInRound: 0,
    totalPicked: initialPlayers.filter((p) => p.teamId !== null).length,
    poolRemaining: initialPlayers.filter((p) => p.teamId === null).length,
  });

  // Team creation and pool management only appear once signups have opened. If
  // signupOpensAt is null we treat signups as "always open" — admin can do
  // everything immediately. Re-evaluated on render so the gate auto-opens when
  // the user keeps the page up across the opens-at boundary.
  const signupsOpen = !currentEvent.signupOpensAt || new Date(currentEvent.signupOpensAt) <= new Date();

  const fetchDraft = useCallback(async () => {
    const res = await fetch(`/api/events/${event.id}/draft`);
    if (res.ok) {
      const data = await res.json();
      setDraft(data);
    }
  }, [event.id]);

  useEffect(() => {
    if (draft.status !== 'active' && draft.status !== 'paused') return;
    fetchDraft();
    const interval = setInterval(fetchDraft, 2500);
    return () => clearInterval(interval);
  }, [draft.status, fetchDraft]);


  async function deleteTeam(teamId: number) {
    setDeleting(teamId);
    await fetch(`/api/events/${event.id}/teams?teamId=${teamId}`, { method: 'DELETE' });
    setDeleting(null);
    router.refresh();
  }

  async function addSelectedFromRoster() {
    if (selectedClanMemberIds.length === 0) return;
    setAddingPlayer(true);
    const res = await fetch(`/api/events/${event.id}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedClanMemberIds.map((clanMemberId) => ({ clanMemberId }))),
    });
    if (res.ok) {
      setSelectedClanMemberIds([]);
      await fetchDraft();
      router.refresh();
    }
    setAddingPlayer(false);
  }

  async function deletePlayer(playerId: number) {
    await fetch(`/api/events/${event.id}/players?playerId=${playerId}`, { method: 'DELETE' });
    await fetchDraft();
    router.refresh();
  }

  async function saveDraftOrder(order: number[]) {
    setSavingOrder(true);
    await fetch(`/api/events/${event.id}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set-order', teamOrder: order }),
    });
    await fetchDraft();
    setSavingOrder(false);
    router.refresh();
  }

  async function doDraftAction(action: string) {
    setDraftAction(action);
    await fetch(`/api/events/${event.id}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    await fetchDraft();
    setDraftAction('');
    router.refresh();
  }

  async function adminPick(playerId: number) {
    setPicking(true);
    await fetch(`/api/events/${event.id}/draft/pick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    });
    await fetchDraft();
    setPicking(false);
  }

  async function saveDates() {
    setSavingDates(true);
    try {
      // startDate/endDate are already ISO (or '' when unset). Send null for unset so the
      // API knows to clear the field rather than store an empty string.
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDate || null,
          endDate: endDate || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        // Sync our client state with the persisted values so reopening the editor shows
        // the saved dates (instead of stale or empty state). router.refresh() rebuilds
        // server components but doesn't reset our client state — we have to do it manually.
        setCurrentEvent(updated);
        setStartDate(updated.startDate ?? '');
        setEndDate(updated.endDate ?? '');
        setEditMode(false);
        router.refresh();
      }
    } finally {
      setSavingDates(false);
    }
  }

  async function takeSnapshot() {
    setSnapshotting(true);
    setSnapshotResult(null);
    try {
      const res = await fetch(`/api/events/${event.id}/snapshot`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSnapshotResult(data);
      }
    } finally {
      setSnapshotting(false);
    }
  }

  async function forceResetBaselines() {
    if (!confirm('This will overwrite ALL player baselines with current stats. Are you sure?')) {
      return;
    }
    setForceResetting(true);
    setSnapshotResult(null);
    try {
      const res = await fetch(`/api/events/${event.id}/snapshot?forceReset=true`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSnapshotResult(data);
      }
    } finally {
      setForceResetting(false);
    }
  }

  async function refreshStats() {
    setRefreshingStats(true);
    try {
      // This fetches fresh stats from Jagex hiscores for all players
      const res = await fetch(`/api/events/${event.id}/gains`);
      if (res.ok) {
        setLastStatsRefresh(new Date());
      }
    } finally {
      setRefreshingStats(false);
    }
  }

  async function resetPlayerSnapshot(playerId: number) {
    setResettingSnapshot(playerId);
    try {
      await fetch(`/api/events/${event.id}/players/${playerId}/snapshot`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetAll: true }),
      });
      router.refresh();
    } finally {
      setResettingSnapshot(null);
    }
  }

  async function resendRosterToDiscord() {
    setResendingRoster(true);
    setRosterMessage(null);
    try {
      const res = await fetch(`/api/events/${event.id}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend-roster' }),
      });
      const data = await res.json();
      if (res.ok) {
        setRosterMessage({ type: 'success', text: data.message || 'Roster sent to Discord!' });
      } else {
        setRosterMessage({ type: 'error', text: data.error || 'Failed to send roster' });
      }
    } catch {
      setRosterMessage({ type: 'error', text: 'Failed to send roster' });
    } finally {
      setResendingRoster(false);
    }
  }

  async function undoLastPick() {
    setUndoing(true);
    setLastUndone(null);
    try {
      const res = await fetch(`/api/events/${event.id}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'undo-pick' }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastUndone(data.undone?.playerName || 'Player');
        await fetchDraft();
      }
    } finally {
      setUndoing(false);
    }
  }

  async function forceEndEvent() {
    if (!confirm('Are you sure you want to force-end this event? This will end the event immediately and notify Discord.')) {
      return;
    }
    setForceEnding(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force-end' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentEvent(updated);
        setEndDate(updated.endDate ?? '');
        router.refresh();
      }
    } finally {
      setForceEnding(false);
    }
  }

  async function resumeEvent() {
    const originalEnd = currentEvent.originalEndDate;
    const originalPassed = originalEnd && new Date(originalEnd) < new Date();
    const msg = originalPassed
      ? 'The original end date has already passed. The event will resume with that expired end date. Continue?'
      : 'Are you sure you want to resume this event?';
    if (!confirm(msg)) return;

    setResuming(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentEvent(updated);
        setEndDate(updated.endDate ?? '');
        router.refresh();
      }
    } finally {
      setResuming(false);
    }
  }

  function handleTileConfigSaved(tileId: number, updated: {
    label: string;
    description: string | null;
    tileType: string;
    requiredAmount: number | null;
    trackedStat: string | null;
    statType: string | null;
    statGoal: number | null;
    trackingMode: string;
    optional?: boolean;
    trackedItemIds?: number[] | null;
    itemRequirements?: { itemId: number; name: string; requiredAmount: number }[] | null;
  }) {
    // localTiles mirrors the DB row shape, where trackedItemIds/itemRequirements are
    // stringified JSON. TileTrackingConfig hands us the parsed forms, so re-serialize
    // before merging — otherwise the next Configure-open will JSON.parse an array.
    const { trackedItemIds, itemRequirements, optional: updatedOptional, ...rest } = updated;
    setLocalTiles((prev) =>
      prev.map((t) =>
        t.id === tileId
          ? {
              ...t,
              ...rest,
              optional: updatedOptional ? 1 : 0,
              trackedItemIds:
                trackedItemIds === undefined
                  ? t.trackedItemIds
                  : trackedItemIds === null
                    ? null
                    : JSON.stringify(trackedItemIds),
              itemRequirements:
                itemRequirements === undefined
                  ? t.itemRequirements
                  : itemRequirements === null
                    ? null
                    : JSON.stringify(itemRequirements),
            }
          : t,
      ),
    );
  }

const isDraftInProgress = draft.status === 'active' || draft.status === 'paused';

  return (
    <div>
      <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-4">
        &larr; Back to dashboard
      </Link>
      <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">{event.name}</h1>
      <div className="flex items-center gap-3 text-sm text-text-muted mb-8">
        <span className="bg-gold/15 text-gold px-2 py-0.5 rounded-full text-xs font-medium">
          {event.boardSize}x{event.boardSize}
        </span>
        <span>{tiles.length} tiles</span>
        <span>{teams.length} team{teams.length !== 1 ? 's' : ''}</span>
        <span
          className={`flex items-center gap-1.5 ${streamConnected ? 'text-accent-green-light' : 'text-text-muted'}`}
          title={streamConnected ? 'Real-time updates connected' : 'Connecting to live updates…'}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${streamConnected ? 'bg-accent-green animate-pulse' : 'bg-text-muted'}`} />
          {streamConnected ? 'Connected' : 'Connecting…'}
        </span>
      </div>

      {/* Event Details Card */}
      <div className="border border-card-border rounded-xl p-5 bg-card-bg mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Event Details
          </h2>
          <div className="flex items-center gap-2">
            {/* Status Badge */}
            {isForceEnded ? (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
                Force-Ended
              </span>
            ) : eventEnded ? (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-text-muted/15 text-text-muted border border-text-muted/25">
                Ended
              </span>
            ) : isDraft ? (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/25">
                Draft
              </span>
            ) : isActive ? (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-accent-green/15 text-accent-green-light border border-accent-green/25">
                Active
              </span>
            ) : (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                Upcoming
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">Name</label>
            <p className="text-sm font-medium">{currentEvent.name}</p>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Board Size</label>
            <p className="text-sm font-medium">{currentEvent.boardSize}×{currentEvent.boardSize}</p>
          </div>
        </div>

        {editMode ? (
          <div className="mb-3">
            <DateRangeField
              startIso={startDate}
              endIso={endDate}
              onChange={({ startIso, endIso }) => {
                setStartDate(startIso);
                setEndDate(endIso);
              }}
            />
            <p className="text-xs text-text-muted mt-2">
              Times are in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Start Date</label>
              <p className="text-sm font-medium">
                <span suppressHydrationWarning>
                  {currentEvent.startDate ? new Date(currentEvent.startDate).toLocaleString() : 'Not set'}
                </span>
              </p>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">End Date</label>
              <p className="text-sm font-medium">
                <span suppressHydrationWarning>
                  {currentEvent.endDate ? new Date(currentEvent.endDate).toLocaleString() : 'Not set'}
                </span>
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              if (editMode) {
                // saveDates closes the editor itself once persisted; don't toggle
                // synchronously here or we'd close before the save resolves.
                saveDates();
              } else {
                // Re-seed the inputs from the latest known event state when entering
                // edit mode, in case currentEvent changed since last edit.
                setStartDate(currentEvent.startDate ?? '');
                setEndDate(currentEvent.endDate ?? '');
                setEditMode(true);
              }
            }}
            disabled={savingDates}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gold/20 text-gold bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-50"
          >
            {editMode ? (savingDates ? 'Saving...' : 'Save Dates') : 'Edit Dates'}
          </button>

          {editMode && (
            <button
              onClick={() => {
                setStartDate(currentEvent.startDate ?? '');
                setEndDate(currentEvent.endDate ?? '');
                setEditMode(false);
              }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          )}

          {isActive && !isForceEnded && (
            <button
              onClick={forceEndEvent}
              disabled={forceEnding}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {forceEnding ? 'Ending...' : 'Force End Event'}
            </button>
          )}

          {isForceEnded && (
            <button
              onClick={resumeEvent}
              disabled={resuming}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-accent-green/30 text-accent-green-light bg-accent-green/10 hover:bg-accent-green/20 transition-colors disabled:opacity-50"
            >
              {resuming ? 'Resuming...' : 'Resume Event'}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] items-start">
        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Teams
          </h2>
          {teams.length > 0 ? (
            <div className="space-y-2 mb-8">
              {teams.map((team) => {
                const requiredTiles = localTiles.filter((t) => !t.optional);
                const requiredTileIds = new Set(requiredTiles.map((t) => t.id));
                const completed = liveCompletions.filter((c) => c.teamId === team.id && requiredTileIds.has(c.tileId)).length;
                const pct = requiredTiles.length > 0 ? Math.round((completed / requiredTiles.length) * 100) : 0;
                return (
                  <div
                    key={team.id}
                    className="flex items-center justify-between border border-card-border rounded-xl p-3 bg-card-bg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: team.color }} />
                      <div>
                        <span className="font-semibold">{team.name}</span>
                        <span className="text-text-muted text-xs ml-2">{completed}/{requiredTiles.length} ({pct}%)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/events/${event.id}/teams/${team.id}`}
                        className="text-xs font-medium bg-gold/10 text-gold border border-gold/20 px-2.5 py-1 rounded-lg hover:bg-gold/20 transition-colors"
                      >
                        Manage Tiles
                      </Link>
                      <button
                        onClick={() => deleteTeam(team.id)}
                        disabled={deleting === team.id}
                        className="text-xs text-red-400 border border-red-400/20 px-2.5 py-1 rounded-lg hover:bg-red-400/10 transition-colors disabled:opacity-50"
                      >
                        {deleting === team.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed border-card-border rounded-xl mb-8">
              <p className="text-text-muted">No teams yet. Add one below.</p>
            </div>
          )}

          {signupsOpen ? (
            <>
              <button
                onClick={() => setShowAddTeam(!showAddTeam)}
                className="w-full text-lg font-bold mb-4 flex items-center gap-2 hover:text-gold transition-colors text-left"
              >
                <span className="w-1 h-5 bg-gold rounded-full" />
                Add Team
                <span className="ml-auto text-sm text-text-muted">{showAddTeam ? '▼' : '▶'}</span>
              </button>
              {showAddTeam && <TeamForm eventId={event.id} />}
            </>
          ) : (
            <div className="text-sm text-text-muted border border-dashed border-card-border rounded-xl p-4">
              Teams can be added once sign-ups open ({new Date(currentEvent.signupOpensAt!).toLocaleString()}).
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Board Preview
          </h2>
          <BingoBoard
            tiles={localTiles}
            boardSize={event.boardSize}
            completions={liveCompletions}
            teams={teams}
          />
        </div>
      </div>

      {/* Sign-ups Section */}
      <div className="mt-12 pt-8 border-t border-card-border">
        <button
          onClick={() => setShowSignups(!showSignups)}
          className="w-full text-xl font-bold text-gold mb-6 flex items-center gap-2 hover:text-gold-light transition-colors text-left"
        >
          <span className="w-1 h-6 bg-gold rounded-full" />
          Sign-ups
          <span className="ml-auto text-sm text-text-muted">{showSignups ? '▼' : '▶'}</span>
        </button>
        {showSignups && <SignupAdminPanel event={currentEvent} onEventUpdated={setCurrentEvent} />}
      </div>

      {/* Event Dates & Stat Tracking Section */}
      <div className="mt-12 pt-8 border-t border-card-border">
        <button
          onClick={() => setShowStatTracking(!showStatTracking)}
          className="w-full text-xl font-bold text-gold mb-6 flex items-center gap-2 hover:text-gold-light transition-colors text-left"
        >
          <span className="w-1 h-6 bg-gold rounded-full" />
          Stat Tracking
          <span className="ml-auto text-sm text-text-muted">{showStatTracking ? '▼' : '▶'}</span>
        </button>

        {showStatTracking && (
        <>
        <div className="grid gap-6 lg:grid-cols-1 mb-8">
          {/* Hiscores Management */}
          <div className="border border-card-border rounded-xl p-4 bg-card-bg space-y-3">
            <h3 className="text-sm font-bold text-gold">Hiscores Management</h3>
            <p className="text-xs text-text-muted">
              {eventStarted
                ? 'Event has started. Use "Refresh Stats" to update current stats.'
                : 'Take a baseline snapshot before the event starts, then refresh stats to track gains.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={takeSnapshot}
                disabled={snapshotting || forceResetting}
                className="flex-1 py-2 text-sm font-semibold rounded bg-accent-green/20 border border-accent-green text-accent-green-light hover:bg-accent-green/30 disabled:opacity-50 transition-colors"
              >
                {snapshotting ? 'Snapshotting...' : eventStarted ? 'Snapshot (New Players)' : 'Take Snapshot'}
              </button>
              <button
                onClick={refreshStats}
                disabled={refreshingStats || snapshotting || forceResetting}
                className="flex-1 py-2 text-sm font-semibold rounded bg-blue-500/20 border border-blue-500 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
              >
                {refreshingStats ? 'Refreshing...' : 'Refresh Stats'}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={forceResetBaselines}
                disabled={forceResetting || snapshotting}
                className="flex-1 py-2 text-sm font-semibold rounded bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
              >
                {forceResetting ? 'Resetting...' : 'Force Reset All'}
              </button>
            </div>
            {snapshotResult && (
              <div className="text-xs space-y-1 p-2 bg-brown-dark rounded">
                {snapshotResult.snapshotted > 0 && (
                  <p className="text-accent-green-light">
                    Snapshotted: {snapshotResult.snapshotted} player{snapshotResult.snapshotted !== 1 ? 's' : ''}
                  </p>
                )}
                {snapshotResult.refreshed !== undefined && snapshotResult.refreshed > 0 && (
                  <p className="text-blue-400">
                    Refreshed: {snapshotResult.refreshed} player{snapshotResult.refreshed !== 1 ? 's' : ''}
                  </p>
                )}
                {snapshotResult.failed && snapshotResult.failed.length > 0 && (
                  <p className="text-red-400">
                    Failed: {snapshotResult.failed.join(', ')}
                  </p>
                )}
                {snapshotResult.error && (
                  <p className="text-red-400">Error: {snapshotResult.error}</p>
                )}
              </div>
            )}
            {lastStatsRefresh && (
              <p className="text-xs text-text-muted">
                Last refreshed: {lastStatsRefresh.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {/* Tile Configuration */}
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-gold rounded-full" />
          Tile Configuration
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {localTiles
            .sort((a, b) => a.position - b.position)
            .map((tile) => (
              <div
                key={tile.id}
                className="border border-card-border rounded-xl p-3 bg-card-bg"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold truncate">{tile.label}</span>
                  <div className="flex items-center gap-1.5">
                    {tile.optional ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-500/20 text-yellow-400">
                        Optional
                      </span>
                    ) : null}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      tile.tileType === 'drop'
                        ? 'bg-accent-green/20 text-accent-green-light'
                        : 'bg-gold/15 text-gold'
                    }`}>
                      {tile.tileType === 'drop' ? 'Drop' : 'Std'}
                    </span>
                    <span className="text-xs text-text-muted">#{tile.position + 1}</span>
                  </div>
                </div>
                {tile.description && (
                  <p className="text-xs text-text-muted mb-1 line-clamp-2">{tile.description}</p>
                )}
                {tile.tileType === 'drop' && tile.requiredAmount && (
                  <p className="text-xs text-accent-green-light mb-1">Required: {tile.requiredAmount}</p>
                )}
                {tile.trackedStat ? (
                  <div className="text-xs text-text-muted mb-2">
                    <span className="text-gold">{tile.trackedStat}</span>
                    {tile.statGoal && <span className="ml-1">(goal: {tile.statGoal.toLocaleString()})</span>}
                    <span className="ml-1">[{tile.trackingMode}]</span>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted mb-2">No stat tracked</p>
                )}
                <button
                  onClick={() => setEditingTileId(editingTileId === tile.id ? null : tile.id)}
                  className="text-xs text-gold hover:text-gold-light transition-colors underline decoration-gold/30 underline-offset-2"
                >
                  {editingTileId === tile.id ? 'Close' : 'Configure'}
                </button>
                {editingTileId === tile.id && (
                  <div className="mt-3 pt-3 border-t border-card-border">
                    <TileTrackingConfig
                      tileId={tile.id}
                      eventId={event.id}
                      initial={{
                        label: tile.label,
                        description: tile.description ?? null,
                        tileType: tile.tileType || 'standard',
                        requiredAmount: tile.requiredAmount ?? null,
                        trackedStat: tile.trackedStat ?? null,
                        statType: tile.statType ?? null,
                        statGoal: tile.statGoal ?? null,
                        trackingMode: tile.trackingMode || 'team',
                        optional: !!tile.optional,
                        trackedItemIds: tile.trackedItemIds ? JSON.parse(tile.trackedItemIds) : null,
                        itemRequirements: tile.itemRequirements ? JSON.parse(tile.itemRequirements) : null,
                      }}
                      onSaved={(updated) => handleTileConfigSaved(tile.id, updated)}
                      eventStarted={eventStarted}
                    />
                  </div>
                )}
              </div>
            ))}
        </div>
        </>
        )}
      </div>

      {/* Draft Section */}
      <div className="mt-12 pt-8 border-t border-card-border">
        <h2 className="text-xl font-bold text-gold mb-6 flex items-center gap-2">
          <span className="w-1 h-6 bg-gold rounded-full" />
          Player Draft
        </h2>

        {(draft.status !== 'none' || draft.teamOrder.length > 0) && (
          <div className="mb-6">
            <DraftStatus
              status={draft.status}
              currentTeamId={draft.currentTeamId}
              round={draft.round}
              pickInRound={draft.pickInRound}
              currentPickNumber={draft.currentPickNumber}
              totalPicked={draft.totalPicked}
              poolRemaining={draft.poolRemaining}
              teams={draft.teams.length > 0 ? draft.teams : teams}
              teamOrder={draft.teamOrder}
            />
          </div>
        )}

        {(draft.status === 'none') && !signupsOpen && (
          <div className="text-sm text-text-muted border border-dashed border-card-border rounded-xl p-4">
            Player pool fills once sign-ups open ({new Date(currentEvent.signupOpensAt!).toLocaleString()}). Players who fill the sign-up form are added automatically; admins can also add clan members manually here once the window opens.
          </div>
        )}

        {(draft.status === 'none') && signupsOpen && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Player Pool Management */}
            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-gold rounded-full" />
                Player Pool
              </h3>

              <div className="mb-4 border border-card-border rounded-xl p-3 bg-card-bg space-y-3">
                <p className="text-xs text-text-muted">
                  Pick clan members to add to this event&apos;s player pool. Names come from the synced
                  roster — no manual RSN typing or Discord-format imports needed.
                </p>
                <ClanMemberPicker
                  mode="multi"
                  eventId={event.id}
                  value={selectedClanMemberIds}
                  onChange={(ids) => setSelectedClanMemberIds(ids)}
                  preferLinked
                  disableEnrolled
                />
                <button
                  onClick={addSelectedFromRoster}
                  disabled={addingPlayer || selectedClanMemberIds.length === 0}
                  className="w-full text-sm font-medium bg-accent-green/15 text-accent-green-light border border-accent-green/30 px-4 py-2 rounded-lg hover:bg-accent-green/25 transition-colors disabled:opacity-50"
                >
                  {addingPlayer
                    ? 'Adding…'
                    : selectedClanMemberIds.length === 0
                      ? 'Select members above'
                      : `Add ${selectedClanMemberIds.length} to pool`}
                </button>
              </div>

              {draft.players.length > 0 ? (
                <div className="space-y-1.5">
                  {draft.players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between border border-card-border rounded-lg p-2 bg-card-bg"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => setStatsRsn(player.name)}
                          className="text-sm font-medium truncate text-gold hover:text-gold-light transition-colors underline decoration-gold/30 underline-offset-2"
                          title="View OSRS Hiscores"
                        >
                          {player.name}
                        </button>
                        {player.discord && player.discord !== player.name && (
                          <span className="text-xs text-text-muted truncate">({player.discord})</span>
                        )}
                        {player.timezone && (
                          <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded flex-shrink-0">
                            {player.timezone}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
<button
                          onClick={() => setEditingPlayer({ id: player.id, name: player.name, discord: player.discord, timezone: player.timezone })}
                          className="text-[10px] text-gold hover:text-gold-light transition-colors border border-gold/20 px-1.5 py-0.5 rounded"
                          title="Edit player details"
                        >
                          Edit
                        </button>
                        {player.teamId && (
                          <button
                            onClick={() => resetPlayerSnapshot(player.id)}
                            disabled={resettingSnapshot === player.id}
                            className="text-[10px] text-yellow-400 hover:text-yellow-300 transition-colors border border-yellow-400/20 px-1.5 py-0.5 rounded disabled:opacity-50"
                            title="Reset player snapshot"
                          >
                            {resettingSnapshot === player.id ? '...' : 'Reset Snap'}
                          </button>
                        )}
                        <button
                          onClick={() => deletePlayer(player.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-card-border rounded-xl">
                  <p className="text-text-muted text-sm">No players in pool yet</p>
                </div>
              )}
            </div>

            {/* Draft Order Setup */}
            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-gold rounded-full" />
                Draft Order
              </h3>
              {teams.length >= 2 ? (
                <>
                  <DraftOrderSetup
                    teams={teams}
                    currentOrder={draft.teamOrder}
                    onSave={saveDraftOrder}
                    saving={savingOrder}
                  />
                  {draft.teamOrder.length > 0 && draft.players.filter((p) => p.teamId === null).length > 0 && (
                    <button
                      onClick={() => doDraftAction('start')}
                      disabled={!!draftAction}
                      className="mt-4 w-full text-sm font-bold bg-accent-green/20 text-accent-green-light border border-accent-green/30 px-4 py-2.5 rounded-lg hover:bg-accent-green/30 transition-colors disabled:opacity-50"
                    >
                      {draftAction === 'start' ? 'Starting...' : 'Start Draft'}
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-6 border border-dashed border-card-border rounded-xl">
                  <p className="text-text-muted text-sm">Need at least 2 teams to set draft order</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active / Paused Draft */}
        {isDraftInProgress && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {draft.status === 'active' && (
                <button
                  onClick={() => doDraftAction('pause')}
                  disabled={!!draftAction}
                  className="text-sm font-medium bg-gold/10 text-gold border border-gold/20 px-4 py-2 rounded-lg hover:bg-gold/20 transition-colors disabled:opacity-50"
                >
                  {draftAction === 'pause' ? '...' : 'Pause Draft'}
                </button>
              )}
              {draft.status === 'paused' && (
                <>
                  <button
                    onClick={() => doDraftAction('resume')}
                    disabled={!!draftAction}
                    className="text-sm font-medium bg-accent-green/10 text-accent-green-light border border-accent-green/20 px-4 py-2 rounded-lg hover:bg-accent-green/20 transition-colors disabled:opacity-50"
                  >
                    {draftAction === 'resume' ? '...' : 'Resume Draft'}
                  </button>
                  {draft.totalPicked > 0 && (
                    <button
                      onClick={undoLastPick}
                      disabled={undoing}
                      className="text-sm font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-4 py-2 rounded-lg hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
                    >
                      {undoing ? 'Undoing...' : 'Undo Last Pick'}
                    </button>
                  )}
                  {lastUndone && (
                    <span className="text-sm text-yellow-400">
                      Returned {lastUndone} to pool
                    </span>
                  )}
                </>
              )}
              <button
                onClick={() => doDraftAction('end')}
                disabled={!!draftAction}
                className="text-sm font-medium bg-red-400/10 text-red-400 border border-red-400/20 px-4 py-2 rounded-lg hover:bg-red-400/20 transition-colors disabled:opacity-50"
              >
                {draftAction === 'end' ? '...' : 'End Draft'}
              </button>
            </div>

            {draft.status === 'active' && draft.poolRemaining > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-2 text-text-muted">
                  Pick on behalf of{' '}
                  <span className="text-foreground">
                    {(draft.teams.length > 0 ? draft.teams : teams).find((t) => t.id === draft.currentTeamId)?.name ?? 'team'}
                  </span>
                </h3>
                <DraftPlayerPool
                  players={draft.players}
                  teams={draft.teams.length > 0 ? draft.teams : teams}
                  interactive
                  onPick={adminPick}
                  onPlayerClick={setStatsRsn}
                  picking={picking}
                />
              </div>
            )}

            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-gold rounded-full" />
                Team Rosters
              </h3>
              <DraftRosters
                players={draft.players}
                teams={draft.teams.length > 0 ? draft.teams : teams}
                teamOrder={draft.teamOrder}
                onPlayerClick={setStatsRsn}
              />
            </div>
          </div>
        )}

        {/* Completed Draft */}
        {draft.status === 'completed' && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => doDraftAction('reset')}
                disabled={!!draftAction}
                className="text-sm font-medium bg-red-400/10 text-red-400 border border-red-400/20 px-4 py-2 rounded-lg hover:bg-red-400/20 transition-colors disabled:opacity-50"
              >
                {draftAction === 'reset' ? '...' : 'Reset Draft'}
              </button>
              <button
                onClick={resendRosterToDiscord}
                disabled={resendingRoster}
                className="text-sm font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-lg hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
              >
                {resendingRoster ? 'Sending...' : 'Send Roster to Discord'}
              </button>
              {rosterMessage && (
                <span className={`text-sm ${rosterMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {rosterMessage.text}
                </span>
              )}
            </div>

            {/* Player tokens for drafted players */}
            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-400 rounded-full" />
                Player Tokens
              </h3>
              <p className="text-xs text-text-muted mb-3">Share these links with players so they can log in and submit evidence.</p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {draft.players
                  .filter((p) => p.teamId !== null && p.playerToken)
                  .map((player) => (
                    <div key={player.id} className="flex items-center justify-between border border-card-border rounded-lg p-2 bg-card-bg">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{player.name}</span>
                        {player.discord && player.discord !== player.name && (
                          <span className="text-[10px] text-text-muted truncate">({player.discord})</span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: teams.find((t) => t.id === player.teamId)?.color + '20', color: teams.find((t) => t.id === player.teamId)?.color }}>
                          {teams.find((t) => t.id === player.teamId)?.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingPlayer({ id: player.id, name: player.name, discord: player.discord, timezone: player.timezone })}
                          className="text-xs text-gold hover:text-gold-light transition-colors border border-gold/20 px-2 py-0.5 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setEditingBaselinePlayer({ id: player.id, name: player.name })}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors border border-indigo-400/20 px-2 py-0.5 rounded"
                        >
                          Stats
                        </button>
                        <button
                          onClick={() => resetPlayerSnapshot(player.id)}
                          disabled={resettingSnapshot === player.id}
                          className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors border border-yellow-400/20 px-2 py-0.5 rounded disabled:opacity-50"
                        >
                          {resettingSnapshot === player.id ? '...' : 'Reset'}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-gold rounded-full" />
                Final Rosters
              </h3>
              <DraftRosters
                players={draft.players}
                teams={draft.teams.length > 0 ? draft.teams : teams}
                teamOrder={draft.teamOrder}
                onPlayerClick={setStatsRsn}
              />
            </div>
          </div>
        )}
      </div>

      {/* Player Activity Section */}
      {submissions.length > 0 && (
        <div className="mt-12 pt-8 border-t border-card-border">
          <h2 className="text-xl font-bold text-gold mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-gold rounded-full" />
            Player Activity
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(() => {
              // Group submissions by creditPlayerId and count
              const activityByPlayer = new Map<number, { name: string; teamId: number; submissions: number; totalAmount: number }>();
              for (const s of submissions) {
                if (s.creditPlayerId) {
                  const existing = activityByPlayer.get(s.creditPlayerId);
                  if (existing) {
                    existing.submissions++;
                    existing.totalAmount += s.amount;
                  } else {
                    activityByPlayer.set(s.creditPlayerId, {
                      name: s.creditPlayerName || 'Unknown',
                      teamId: s.teamId,
                      submissions: 1,
                      totalAmount: s.amount,
                    });
                  }
                }
              }

              // Sort by total amount descending
              const sorted = Array.from(activityByPlayer.entries()).sort((a, b) => b[1].totalAmount - a[1].totalAmount);

              return sorted.map(([playerId, data]) => {
                const team = teams.find((t) => t.id === data.teamId);
                return (
                  <div key={playerId} className="border border-card-border rounded-lg p-3 bg-card-bg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground">{data.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: team?.color + '20', color: team?.color }}>
                        {team?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-accent-green-light font-medium">
                        {data.totalAmount} drops
                      </span>
                      <span className="text-text-muted">
                        ({data.submissions} submission{data.submissions !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          {submissions.length === 0 && (
            <p className="text-text-muted text-center py-4">No submissions yet.</p>
          )}
        </div>
      )}

      {/* Hiscores Stats Modal */}
      {statsRsn && (
        <PlayerStatsPanel rsn={statsRsn} onClose={() => setStatsRsn(null)} />
      )}

      {/* Player Baseline Editor Modal */}
      {editingBaselinePlayer && (
        <PlayerBaselineEditor
          eventId={event.id}
          playerId={editingBaselinePlayer.id}
          playerName={editingBaselinePlayer.name}
          onClose={() => setEditingBaselinePlayer(null)}
          onSaved={() => router.refresh()}
        />
      )}

      {/* Player Editor Modal */}
      {editingPlayer && (
        <PlayerEditor
          eventId={event.id}
          player={editingPlayer}
          onClose={() => setEditingPlayer(null)}
          onSaved={() => {
            fetchDraft();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

'use client';

import type { Event, Tile, Team, Completion, Player } from '@/lib/types';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TeamForm from '@/components/TeamForm';
import DraftOrderSetup from '@/components/DraftOrderSetup';
import DraftPlayerPool from '@/components/DraftPlayerPool';
import DraftStatus from '@/components/DraftStatus';
import DraftRosters from '@/components/DraftRosters';
import PlayerStatsPanel from '@/components/PlayerStatsPanel';
import PlayerBaselineEditor from '@/components/PlayerBaselineEditor';
import PlayerEditor from '@/components/PlayerEditor';
import ClanMemberPicker from '@/components/ClanMemberPicker';
import DiscordTeamProvisioning from '@/components/DiscordTeamProvisioning';
import { useEventStream, EventStreamData } from '@/hooks/useEventStream';
import { tileWeight, isPointsMode } from '@/lib/utils';

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
  players: Player[];
  completions: Completion[];
}

export default function TeamsDraftClient({ event, tiles, teams, players: initialPlayers, completions }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [selectedClanMemberIds, setSelectedClanMemberIds] = useState<number[]>([]);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [statsRsn, setStatsRsn] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draftAction, setDraftAction] = useState('');
  const [picking, setPicking] = useState(false);
  const [resettingSnapshot, setResettingSnapshot] = useState<number | null>(null);
  const [resendingRoster, setResendingRoster] = useState(false);
  const [rosterMessage, setRosterMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [lastUndone, setLastUndone] = useState<string | null>(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [editingBaselinePlayer, setEditingBaselinePlayer] = useState<{ id: number; name: string } | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<{ id: number; name: string; discord: string | null; timezone: string | null } | null>(null);
  const [localTiles, setLocalTiles] = useState<Tile[]>(tiles);
  const [liveCompletions, setLiveCompletions] = useState<Completion[]>(completions);

  const pointsMode = isPointsMode(event.scoringMode);
  const signupsOpen = !event.signupOpensAt || new Date(event.signupOpensAt) <= new Date();

  useEventStream(event.id, {
    onUpdate: useCallback((data: EventStreamData) => {
      setLiveCompletions(data.completions);
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

  const fetchDraft = useCallback(async () => {
    const res = await fetch(`/api/events/${event.id}/draft`);
    if (res.ok) setDraft(await res.json());
  }, [event.id]);

  useEffect(() => {
    if (draft.status !== 'active' && draft.status !== 'paused') return;
    fetchDraft();
    const interval = setInterval(fetchDraft, 2500);
    return () => clearInterval(interval);
  }, [draft.status, fetchDraft]);

  const isDraftInProgress = draft.status === 'active' || draft.status === 'paused';

  async function deleteTeam(teamId: number) {
    setDeleting(teamId);
    try {
      const res = await fetch(`/api/events/${event.id}/teams?teamId=${teamId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Could not delete team');
        return;
      }
      router.refresh();
    } finally {
      setDeleting(null);
    }
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
      setRosterMessage(
        res.ok
          ? { type: 'success', text: data.message || 'Roster sent to Discord!' }
          : { type: 'error', text: data.error || 'Failed to send roster' },
      );
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

  const draftTeams = draft.teams.length > 0 ? draft.teams : teams;
  // Once the draft leaves 'none', the team set + order are frozen server-side. Mirror
  // that in the UI so the controls match what the API will accept.
  const draftLocked = draft.status !== 'none';

  // Guided phase tracker across the whole Teams & Draft flow. Purely a clarity layer over the
  // existing state — nothing here changes draft behaviour.
  const teamsDone = teams.length >= 2;
  const poolDone = draft.players.length >= 1;
  const orderDone = draft.teamOrder.length > 0;
  const draftDone = draft.status === 'completed';
  const phases = [
    { label: 'Set up teams', done: teamsDone },
    { label: 'Fill player pool', done: poolDone },
    { label: 'Set draft order', done: orderDone },
    { label: 'Run draft', done: draftDone },
  ];
  // Which phase is "current": completed → past the end; running → the draft step; otherwise the
  // first unfinished setup step.
  const currentPhase = draftDone
    ? phases.length
    : isDraftInProgress
      ? 3
      : Math.max(0, phases.findIndex((p) => !p.done));
  const nextHint = draftDone
    ? 'Draft complete — team rosters are locked. Reset the draft to make changes.'
    : isDraftInProgress
      ? 'Draft in progress — make your picks below. You can pause, undo, or reset anytime.'
      : !teamsDone
        ? 'Start by adding at least 2 teams below.'
        : !poolDone
          ? 'Fill the player pool — sign-ups add players automatically, or add clan members manually.'
          : !orderDone
            ? 'Set the draft order, then start the draft.'
            : 'Everything’s ready — start the draft below.';

  return (
    <div className="space-y-12">
      {/* Guided phase bar — visible in every state so staff always know where they are. */}
      <div className="rounded-xl border border-card-border bg-card-bg p-4 !mt-0">
        <ol className="flex flex-wrap items-center gap-2">
          {phases.map((p, i) => {
            const isCurrent = i === currentPhase;
            return (
              <li
                key={p.label}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                  p.done
                    ? 'border-accent-green/30 bg-accent-green/10 text-accent-green-light'
                    : isCurrent
                      ? 'border-gold/40 bg-gold/10 text-gold'
                      : 'border-card-border text-text-muted'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    p.done ? 'bg-accent-green text-brown-dark' : isCurrent ? 'bg-gold text-brown-dark' : 'bg-card-border'
                  }`}
                >
                  {p.done ? '✓' : i + 1}
                </span>
                {p.label}
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-text-muted mt-3">
          <span className="text-foreground/80 font-medium">Next:</span> {nextHint}
        </p>
      </div>
      {/* Teams */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Teams
        </h2>
        {teams.length > 0 ? (
          <div className="space-y-2 mb-6">
            {teams.map((team) => {
              const requiredTiles = localTiles.filter((t) => !t.optional);
              const weightById = new Map(requiredTiles.map((t) => [t.id, tileWeight(event.scoringMode, t.points)]));
              const totalWeight = requiredTiles.reduce((sum, t) => sum + tileWeight(event.scoringMode, t.points), 0);
              const completed = liveCompletions
                .filter((c) => c.teamId === team.id && weightById.has(c.tileId))
                .reduce((sum, c) => sum + (weightById.get(c.tileId) || 0), 0);
              const pct = totalWeight > 0 ? Math.round((completed / totalWeight) * 100) : 0;
              return (
                <div key={team.id} className="flex items-center justify-between border border-card-border rounded-xl p-3 bg-card-bg">
                  <div className="flex items-center gap-3">
                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: team.color }} />
                    <div>
                      <span className="font-semibold">{team.name}</span>
                      <span className="text-text-muted text-xs ml-2">
                        {completed}/{totalWeight}{pointsMode ? ' pts' : ''} ({pct}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/events/${event.id}/teams/${team.id}`}
                      className="text-xs font-medium bg-gold/10 text-gold border border-gold/20 px-2.5 py-1 rounded-lg hover:bg-gold/20 transition-colors"
                    >
                      Manage Tiles
                    </Link>
                    {!draftLocked && (
                      <button
                        onClick={() => deleteTeam(team.id)}
                        disabled={deleting === team.id}
                        className="text-xs text-red-400 border border-red-400/20 px-2.5 py-1 rounded-lg hover:bg-red-400/10 transition-colors disabled:opacity-50"
                      >
                        {deleting === team.id ? '...' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 border border-dashed border-card-border rounded-xl mb-6">
            <p className="text-text-muted">No teams yet. Add one below.</p>
          </div>
        )}

        {draftLocked ? (
          <div className="text-sm text-text-muted border border-dashed border-card-border rounded-xl p-4">
            🔒 Teams are locked while the draft is {draft.status}. Reset the draft to change the team set.
          </div>
        ) : signupsOpen ? (
          <>
            <button
              onClick={() => setShowAddTeam(!showAddTeam)}
              className="w-full text-base font-bold mb-4 flex items-center gap-2 hover:text-gold transition-colors text-left"
            >
              <span className="w-1 h-5 bg-gold rounded-full" />
              Add Team
              <span className="ml-auto text-sm text-text-muted">{showAddTeam ? '▼' : '▶'}</span>
            </button>
            {showAddTeam && <TeamForm eventId={event.id} />}
          </>
        ) : (
          <div className="text-sm text-text-muted border border-dashed border-card-border rounded-xl p-4">
            Teams can be added once sign-ups open ({new Date(event.signupOpensAt!).toLocaleString()}).
          </div>
        )}
      </div>

      {/* Discord team channels & roles (only renders when the feature is enabled) */}
      <DiscordTeamProvisioning eventId={event.id} />

      {/* Draft */}
      <div className="pt-8 border-t border-card-border">
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
              teams={draftTeams}
              teamOrder={draft.teamOrder}
            />
          </div>
        )}

        {draft.status === 'none' && !signupsOpen && (
          <div className="text-sm text-text-muted border border-dashed border-card-border rounded-xl p-4">
            Player pool fills once sign-ups open ({new Date(event.signupOpensAt!).toLocaleString()}). Players who fill the
            sign-up form are added automatically; admins can also add clan members manually here once the window opens.
          </div>
        )}

        {draft.status === 'none' && signupsOpen && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Player Pool */}
            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-gold rounded-full" />
                Player Pool
              </h3>
              <div className="mb-4 border border-card-border rounded-xl p-3 bg-card-bg space-y-3">
                <p className="text-xs text-text-muted">
                  Pick clan members to add to this event&apos;s player pool. Names come from the synced roster — no manual
                  RSN typing or Discord-format imports needed.
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
                    <div key={player.id} className="flex items-center justify-between border border-card-border rounded-lg p-2 bg-card-bg">
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
                          <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded flex-shrink-0">{player.timezone}</span>
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
                        <button onClick={() => deletePlayer(player.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
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

            {/* Draft Order */}
            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-gold rounded-full" />
                Draft Order
              </h3>
              {teams.length >= 2 ? (
                <>
                  <DraftOrderSetup teams={teams} currentOrder={draft.teamOrder} onSave={saveDraftOrder} saving={savingOrder} />
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

        {/* Active / Paused */}
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
                  {lastUndone && <span className="text-sm text-yellow-400">Returned {lastUndone} to pool</span>}
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
                  <span className="text-foreground">{draftTeams.find((t) => t.id === draft.currentTeamId)?.name ?? 'team'}</span>
                </h3>
                <DraftPlayerPool
                  players={draft.players}
                  teams={draftTeams}
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
              <DraftRosters players={draft.players} teams={draftTeams} teamOrder={draft.teamOrder} onPlayerClick={setStatsRsn} />
            </div>
          </div>
        )}

        {/* Completed */}
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
                <span className={`text-sm ${rosterMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{rosterMessage.text}</span>
              )}
            </div>

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
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: teams.find((t) => t.id === player.teamId)?.color + '20',
                            color: teams.find((t) => t.id === player.teamId)?.color,
                          }}
                        >
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
              <DraftRosters players={draft.players} teams={draftTeams} teamOrder={draft.teamOrder} onPlayerClick={setStatsRsn} />
            </div>
          </div>
        )}
      </div>

      {statsRsn && <PlayerStatsPanel rsn={statsRsn} onClose={() => setStatsRsn(null)} />}
      {editingBaselinePlayer && (
        <PlayerBaselineEditor
          eventId={event.id}
          playerId={editingBaselinePlayer.id}
          playerName={editingBaselinePlayer.name}
          onClose={() => setEditingBaselinePlayer(null)}
          onSaved={() => router.refresh()}
        />
      )}
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

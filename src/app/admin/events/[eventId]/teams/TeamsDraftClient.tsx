'use client';

import type { Event, Tile, Team, Completion, Player } from '@/lib/types';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TeamEditor from '@/components/TeamEditor';
import DraftOrderSetup from '@/components/DraftOrderSetup';
import DraftPlayerPool from '@/components/DraftPlayerPool';
import DraftStatus from '@/components/DraftStatus';
import DraftRosters from '@/components/DraftRosters';
import BalancePanel from '@/components/BalancePanel';
import PlayerStatsPanel from '@/components/PlayerStatsPanel';
import PlayerBaselineEditor from '@/components/PlayerBaselineEditor';
import PlayerEditor from '@/components/PlayerEditor';
import AutoEnrollPanel from '@/components/AutoEnrollPanel';
import PlayerProfileDetail, { hasProfileDetail } from '@/components/PlayerProfileDetail';
import ClanMemberPicker from '@/components/ClanMemberPicker';
import DiscordTeamProvisioning from '@/components/DiscordTeamProvisioning';
import PlayerRatingBadge from '@/components/PlayerRatingBadge';
import { usePlayerRatings } from '@/hooks/usePlayerRatings';
import { useEventStream, EventStreamData } from '@/hooks/useEventStream';
import { tileWeight, isPointsMode } from '@/lib/utils';
import { countPicksTaken } from '@/lib/draft';

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
  // Finished event, not unlocked (lib/eventLock): the API refuses every mutation, so all
  // interactive controls render disabled (links/viewing stay live).
  editLocked?: boolean;
}

// How the event's teams come to exist — chosen on the wizard's first screen. 'draft' = the classic
// captains-pick flow; 'individual' = every player on their own solo team; 'one_team' = whole clan
// on one shared roster. The non-draft formats have no team-creation or draft steps at all.
type TeamFormat = 'draft' | 'individual' | 'one_team';

export default function TeamsDraftClient({ event, tiles, teams, players: initialPlayers, completions, editLocked = false }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [selectedClanMemberIds, setSelectedClanMemberIds] = useState<number[]>([]);
  const [addingPlayer, setAddingPlayer] = useState(false);
  // Post-draft roster tweaks.
  const [removingPlayerId, setRemovingPlayerId] = useState<number | null>(null);
  const [assigningPlayerId, setAssigningPlayerId] = useState<number | null>(null);
  // Shared "action in flight" marker for the sub-out / reset controls, plus a one-line result toast.
  const [busyPlayerId, setBusyPlayerId] = useState<number | null>(null);
  // When set, this player's row is showing the "Sub out" keep-points / clear-points choice.
  const [subChoiceId, setSubChoiceId] = useState<number | null>(null);
  // When set, this player's row is showing the "Remove" to-pool / from-event choice.
  const [removeChoiceId, setRemoveChoiceId] = useState<number | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [addToTeamId, setAddToTeamId] = useState<number | null>(null);
  const [nameToAdd, setNameToAdd] = useState('');
  const [statsRsn, setStatsRsn] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draftAction, setDraftAction] = useState('');
  const [picking, setPicking] = useState(false);
  const [resettingSnapshot, setResettingSnapshot] = useState<number | null>(null);
  const [resendingRoster, setResendingRoster] = useState(false);
  const [rosterMessage, setRosterMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [startingBingo, setStartingBingo] = useState(false);
  const [startBingoError, setStartBingoError] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [lastUndone, setLastUndone] = useState<string | null>(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [editingBaselinePlayer, setEditingBaselinePlayer] = useState<{ id: number; name: string } | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<{ id: number; name: string; discord: string | null; timezone: string | null } | null>(null);
  const [expandedPoolPlayers, setExpandedPoolPlayers] = useState<Set<number>>(new Set());
  const [localTiles, setLocalTiles] = useState<Tile[]>(tiles);
  const [liveCompletions, setLiveCompletions] = useState<Completion[]>(completions);

  const pointsMode = isPointsMode(event.scoringMode);
  const signupsOpen = !event.signupOpensAt || new Date(event.signupOpensAt) <= new Date();

  // ── Format-first: how this event's teams work. Decides which wizard steps exist at all —
  // 'draft' runs the classic teams → pool → order → run flow; 'individual' (one team each) and
  // 'one_team' (whole clan together) skip team creation, draft order and the draft entirely:
  // players are enrolled and teamed up in one click. Derived from DB state when it's already
  // obvious, otherwise asked on the first screen (sessionStorage remembers an explicit answer).
  const derivedFormat = ((): TeamFormat | null => {
    if (event.draftStatus !== 'none') return 'draft'; // a draft ran / is running
    const assigned = initialPlayers.filter((p) => p.teamId != null);
    if (teams.length === 1 && assigned.length > 0) return 'one_team';
    if (teams.length >= 2) {
      const maxRoster = Math.max(...teams.map((t) => initialPlayers.filter((p) => p.teamId === t.id).length));
      if (assigned.length > 0 && maxRoster <= 1) return 'individual'; // all solo teams
      return 'draft'; // multiple teams being built by hand — the classic flow
    }
    // A ladder event is individual-primary by design — default a fresh one to one-team-each (the
    // admin can still switch to real teams). Other formats ask on the first screen.
    if (event.format === 'ladder') return 'individual';
    return null; // fresh event — ask
  })();
  const [format, setFormat] = useState<TeamFormat | null>(derivedFormat);
  const formatStorageKey = `draft-format-${event.id}`;
  const nonDraft = format === 'individual' || format === 'one_team';

  useEventStream(event.id, {
    onUpdate: useCallback((data: EventStreamData) => {
      setLiveCompletions(data.completions);
      setLocalTiles(data.tiles);
    }, []),
  });

  const [draft, setDraft] = useState<DraftState>({
    status: event.draftStatus,
    // Mirror the draft GET: drop ids of since-deleted teams, then append any team not yet placed
    // in the saved order so the order (and the Draft Status preview) always covers the full
    // current team set — teams added/recreated after the order was last saved don't vanish.
    teamOrder: (() => {
      const saved = (event.draftOrder ? (JSON.parse(event.draftOrder) as number[]) : []).filter((id) =>
        teams.some((t) => t.id === id),
      );
      const placed = new Set(saved);
      return [...saved, ...teams.filter((t) => !placed.has(t.id)).map((t) => t.id)];
    })(),
    players: initialPlayers,
    teams,
    currentPickNumber: countPicksTaken(initialPlayers),
    currentTeamId: null,
    round: 0,
    pickInRound: 0,
    totalPicked: initialPlayers.filter((p) => p.teamId !== null).length,
    poolRemaining: initialPlayers.filter((p) => p.teamId === null).length,
  });

  // Per-person ratings for the whole tab — one fetch, shared by the balance panel, the pool cards
  // and every roster row (see components/PlayerRatingBadge). Only the classic draft format asks for
  // them: solo/one-team events have nothing to balance, so they skip the (DB-heavy) profile sweep.
  const playersSignature = draft.players.map((p) => `${p.id}:${p.teamId ?? ''}`).join(',');
  const ratings = usePlayerRatings({
    eventId: event.id,
    signature: playersSignature,
    enabled: !nonDraft && format !== null,
  });

  // One-step-at-a-time view: which phase's section is on screen. Starts at the first unfinished
  // phase; the phase bar (below) navigates between them so nothing off-step is on screen.
  const [activeStep, setActiveStep] = useState<number>(() => {
    if (draft.status !== 'none') return 3;
    // Non-draft formats only use steps 1 (enroll & team up) and 3 (rosters & start).
    if (derivedFormat === 'individual' || derivedFormat === 'one_team') {
      return initialPlayers.some((p) => p.teamId != null) ? 3 : 1;
    }
    if (teams.length < 2) return 0;
    if (draft.players.length < 1) return 1;
    // Teams + pool are ready → land on the draft-order step, where the order is arranged and the
    // Start Draft button lives. The order self-heals to cover every team, so we never strand the
    // admin on a stale-order or empty "run" screen.
    return 2;
  });
  const stepStorageKey = `draft-step-${event.id}`;
  // All step navigation goes through here: it stamps ?step= into browser history, so
  // the browser Back button steps backward through the wizard instead of leaving the page.
  const goToStep = useCallback((n: number, mode: 'push' | 'replace' = 'push') => {
    setActiveStep(n);
    const url = new URL(window.location.href);
    url.searchParams.set('step', String(n));
    if (mode === 'push') window.history.pushState({ draftStep: n }, '', url);
    else window.history.replaceState({ draftStep: n }, '', url);
  }, []);
  const activeStepRef = useRef(activeStep);
  activeStepRef.current = activeStep;
  // Once everything's set up the initializer always lands on "Run draft" — which turns every
  // visit to this tab into a forced jump there. Restore the admin's place instead: the URL's
  // ?step= wins (back/forward, deep link), then the session's remembered step (restored after
  // mount to keep SSR hydration clean).
  useEffect(() => {
    // Restore an explicitly-chosen format from this session — only meaningful while the DB state
    // can't tell yet (derivation wins once teams/players make the answer obvious).
    let effectiveFormat = derivedFormat;
    if (derivedFormat === null) {
      const storedFormat = window.sessionStorage.getItem(formatStorageKey);
      if (storedFormat === 'draft' || storedFormat === 'individual' || storedFormat === 'one_team') {
        setFormat(storedFormat);
        effectiveFormat = storedFormat;
      }
    }
    const fromUrl = new URLSearchParams(window.location.search).get('step');
    const saved = fromUrl ?? (draft.status === 'none' ? window.sessionStorage.getItem(stepStorageKey) : null);
    if (saved != null) {
      const n = parseInt(saved, 10);
      if (Number.isInteger(n) && n >= 0 && n <= 3) {
        goToStep(n, 'replace');
        return;
      }
    }
    // No remembered place: a just-restored non-draft format starts on its enroll step (the SSR
    // initializer couldn't know the stored choice).
    if (effectiveFormat !== derivedFormat && (effectiveFormat === 'individual' || effectiveFormat === 'one_team')) {
      goToStep(1, 'replace');
      return;
    }
    // Stamp the initial entry so returning to it via Back restores the right step.
    goToStep(activeStepRef.current, 'replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    window.sessionStorage.setItem(stepStorageKey, String(activeStep));
  }, [activeStep, stepStorageKey]);
  // Back/forward: restore whatever step that history entry was stamped with.
  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      const fromState = (e.state as { draftStep?: number } | null)?.draftStep;
      const fromUrl = new URLSearchParams(window.location.search).get('step');
      const n = typeof fromState === 'number' ? fromState : fromUrl != null ? parseInt(fromUrl, 10) : NaN;
      if (Number.isInteger(n) && n >= 0 && n <= 3) setActiveStep(n);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  // Jump to the Run-draft view the moment the draft actually starts or finishes — a live
  // TRANSITION only, so it never fights the admin's own navigation.
  const prevDraftStatus = useRef(draft.status);
  useEffect(() => {
    const prev = prevDraftStatus.current;
    prevDraftStatus.current = draft.status;
    if (prev !== draft.status && (draft.status === 'active' || draft.status === 'paused' || draft.status === 'completed')) {
      goToStep(3, 'replace');
    }
  }, [draft.status, goToStep]);

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

  // A finished event is read-only unless the admin unlocked editing (the server 409s every mutation
  // route via lib/eventLock; this is the client mirror). Every mutating handler calls this first, and
  // the mutating buttons are disabled below. VIEW actions — opening a player's stats, expanding
  // sign-up answers, navigating the wizard steps — are deliberately NOT gated by it.
  function mutationsBlocked(): boolean {
    if (editLocked) {
      setResetNotice('Editing is locked — this event has finished. Use “Unlock editing” at the top to make changes.');
      return true;
    }
    return false;
  }

  async function deleteTeam(teamId: number) {
    if (mutationsBlocked()) return;
    setDeleting(teamId);
    try {
      const res = await fetch(`/api/events/${event.id}/teams?teamId=${teamId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Could not delete team');
        return;
      }
      // Pull the fresh draft state too — the delete may have scrubbed the saved order.
      await fetchDraft();
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  async function addSelectedFromRoster() {
    if (mutationsBlocked()) return;
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

  // Add a player by typing a name — for someone with no clan-member/RSN row yet (a Discord-only
  // guest, or an off-roster ringer). Creates a guest clan member from the name. teamId null = pool.
  async function addPlayerByName(teamId: number | null) {
    if (mutationsBlocked()) return;
    const name = nameToAdd.trim();
    if (!name) return;
    setAddingPlayer(true);
    try {
      const url =
        teamId != null
          ? `/api/events/${event.id}/players?teamId=${teamId}`
          : `/api/events/${event.id}/players`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ name }]),
      });
      if (res.ok) {
        setNameToAdd('');
        setAddToTeamId(null);
        await fetchDraft();
        router.refresh();
      }
    } finally {
      setAddingPlayer(false);
    }
  }

  // Assign an already-in-pool player onto a team — post-draft, for someone who was signed up /
  // added to the pool but never drafted (e.g. a late/guest add).
  async function assignToTeam(playerId: number, teamId: number) {
    if (mutationsBlocked()) return;
    setAssigningPlayerId(playerId);
    try {
      await fetch(`/api/events/${event.id}/players`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, teamId }),
      });
      await fetchDraft();
      router.refresh();
    } finally {
      setAssigningPlayerId(null);
    }
  }

  // Move a player back to the pool (remove from their team) — post-draft roster fix.
  async function removeFromTeam(playerId: number) {
    if (mutationsBlocked()) return;
    setRemovingPlayerId(playerId);
    try {
      await fetch(`/api/events/${event.id}/players`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, teamId: null }),
      });
      await fetchDraft();
      router.refresh();
    } finally {
      setRemovingPlayerId(null);
    }
  }

  // Add the picked clan member(s) straight onto a team — for someone missed during the draft.
  async function addMembersToTeam(teamId: number) {
    if (mutationsBlocked()) return;
    if (selectedClanMemberIds.length === 0) return;
    setAddingPlayer(true);
    try {
      const res = await fetch(`/api/events/${event.id}/players?teamId=${teamId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedClanMemberIds.map((clanMemberId) => ({ clanMemberId }))),
      });
      if (res.ok) {
        setSelectedClanMemberIds([]);
        setAddToTeamId(null);
        await fetchDraft();
        router.refresh();
      }
    } finally {
      setAddingPlayer(false);
    }
  }

  async function deletePlayer(playerId: number) {
    if (mutationsBlocked()) return;
    await fetch(`/api/events/${event.id}/players?playerId=${playerId}`, { method: 'DELETE' });
    await fetchDraft();
    router.refresh();
  }

  // Sub a player out (freeze) or back in (unfreeze). Freezing locks their stat gain at the current
  // moment — it still counts toward team tiles, but stops climbing — so a replacement can stack on top.
  async function toggleFrozen(playerId: number, frozen: boolean) {
    if (mutationsBlocked()) return;
    setBusyPlayerId(playerId);
    try {
      await fetch(`/api/events/${event.id}/players`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, frozen }),
      });
      await fetchDraft();
      router.refresh();
    } finally {
      setBusyPlayerId(null);
    }
  }

  // Reset one player's participation: un-completes their solo tiles, voids their submissions, and strips
  // their share from team-tile splits (the team's completed tiles stay completed). `remove` also drops
  // them off the roster; `subOut` keeps them on the team but benched (so they show as subbed out) while
  // clearing their points. `drop` deletes them from the event entirely — no lingering pool entry, no
  // headcounts. Irreversible — confirm first.
  async function resetPlayer(
    playerId: number,
    playerName: string,
    remove: boolean,
    subOut = false,
    drop = false,
  ) {
    if (mutationsBlocked()) return;
    const verb = drop
      ? 'Remove from the event'
      : remove
        ? 'Remove'
        : subOut
          ? 'Sub out & clear points for'
          : 'Reset';
    if (!window.confirm(
      `${verb} ${playerName}? Their solo tiles reopen, their submissions are voided, and their share is stripped from team tiles (the team keeps its completed tiles)${subOut ? ', and they stay benched as subbed out' : ''}${drop ? ', and they are deleted from the event roster entirely' : ''}. This cannot be undone.`,
    )) return;
    setBusyPlayerId(playerId);
    setSubChoiceId(null);
    setRemoveChoiceId(null);
    try {
      const res = await fetch(`/api/events/${event.id}/players/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, remove, subOut, drop }),
      });
      if (res.ok) {
        const d = await res.json();
        setResetNotice(
          `${drop ? 'Removed' : subOut ? 'Subbed out' : 'Reset'} ${playerName}: ${d.removedCompletions} tile(s) reopened, ${d.voidedSubmissions} submission(s) voided, ${d.strippedFromSplits} team split(s) updated${d.dropped ? ', removed from the event' : d.removed ? ', removed from team' : d.benched ? ', kept benched' : ''}.`,
        );
      }
      await fetchDraft();
      router.refresh();
    } finally {
      setBusyPlayerId(null);
    }
  }

  async function saveDraftOrder(order: number[]) {
    if (mutationsBlocked()) return;
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
    if (mutationsBlocked()) return;
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
    if (mutationsBlocked()) return;
    setPicking(true);
    await fetch(`/api/events/${event.id}/draft/pick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    });
    await fetchDraft();
    setPicking(false);
  }

  // One modal handles both create and edit (name, color, captain) — no more
  // delete-and-recreate to change a captain or color.
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  async function resetPlayerSnapshot(playerId: number) {
    if (mutationsBlocked()) return;
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
    // Deliberately NOT lock-guarded: re-broadcasting the final roster to Discord is a comms action,
    // not an edit to recorded results, so it stays available on a finished event.
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

  async function startBingoNow(force = false) {
    if (mutationsBlocked()) return;
    if (!force && !confirm('Start the bingo now? This reveals all tiles to members, marks the event live, and announces the start in Discord.')) return;
    setStartingBingo(true);
    setStartBingoError(null);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(force ? { action: 'start-now', force: true } : { action: 'start-now' }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        // Start safeguard (409 + blockers): offer the explicit override once, re-confirmed.
        if (res.status === 409 && Array.isArray(data.blockers) && !force) {
          if (confirm(`${data.error}\n\nStart anyway?`)) {
            await startBingoNow(true);
            return;
          }
          setStartBingoError(data.error);
        } else {
          setStartBingoError(data.error || 'Could not start the bingo.');
        }
      }
    } finally {
      setStartingBingo(false);
    }
  }

  async function undoLastPick() {
    if (mutationsBlocked()) return;
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

  // Pick the event's team format (first wizard screen) and land on the right step for it.
  function chooseFormat(f: TeamFormat) {
    setFormat(f);
    try {
      window.sessionStorage.setItem(formatStorageKey, f);
    } catch {}
    if (f === 'draft') {
      goToStep(teams.length < 2 ? 0 : draft.players.length < 1 ? 1 : 2);
    } else {
      goToStep(draft.players.some((p) => p.teamId != null) ? 3 : 1);
    }
  }

  // Back to the format screen (offered while no draft has started — afterwards the format is fact).
  function resetFormat() {
    setFormat(null);
    try {
      window.sessionStorage.removeItem(formatStorageKey);
    } catch {}
  }

  // Multi-account config for the "One team each" / shared-team formats. accountSlotMode decides how a
  // person's alts map to teams (per-person = alts share one team; per-account = each alt its own),
  // maxAccountsPerPerson caps how many of a person's accounts may enter. Persisted on the event.
  const [slotMode, setSlotMode] = useState<'per-person' | 'per-account'>(
    event.accountSlotMode === 'per-account' ? 'per-account' : 'per-person',
  );
  const [maxAccounts, setMaxAccounts] = useState<number>(event.maxAccountsPerPerson ?? 1);
  const [savingAccountCfg, setSavingAccountCfg] = useState(false);
  async function saveAccountConfig(next: { slotMode?: 'per-person' | 'per-account'; maxAccounts?: number }) {
    if (mutationsBlocked()) return;
    const body: Record<string, unknown> = {};
    if (next.slotMode !== undefined) body.accountSlotMode = next.slotMode;
    if (next.maxAccounts !== undefined) body.maxAccountsPerPerson = next.maxAccounts;
    setSavingAccountCfg(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) router.refresh();
    } finally {
      setSavingAccountCfg(false);
    }
  }

  // Non-draft formats: team up everyone sitting unassigned in the pool in one click — solo teams
  // ('individual') or the one shared team ('one_team'). This replaces team creation + the draft.
  const [placing, setPlacing] = useState(false);
  const [placeNotice, setPlaceNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  async function placePool() {
    if (mutationsBlocked()) return;
    if (format !== 'individual' && format !== 'one_team') return;
    setPlacing(true);
    setPlaceNotice(null);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/place-pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placement: format }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPlaceNotice({ type: 'error', text: d.error || 'Could not team up the pool.' });
        return;
      }
      setPlaceNotice({
        type: 'success',
        text: `${d.placed} player${d.placed === 1 ? '' : 's'} teamed up${d.teamsCreated ? `, ${d.teamsCreated} team${d.teamsCreated === 1 ? '' : 's'} created` : ''}.`,
      });
      await fetchDraft();
      router.refresh();
      goToStep(3);
    } finally {
      setPlacing(false);
    }
  }

  const draftTeams = draft.teams.length > 0 ? draft.teams : teams;
  // Once the draft leaves 'none', the team set + order are frozen server-side. Mirror
  // that in the UI so the controls match what the API will accept.
  const draftLocked = draft.status !== 'none';

  // "Start Bingo Now" is offered once the draft is done but the event hasn't gone live yet.
  const eventStarted = event.startDate ? new Date(event.startDate) <= new Date() : false;
  const bingoStartable = !eventStarted && !event.forceEndedAt;

  // Guided phase tracker across the whole Teams & Draft flow. Purely a clarity layer over the
  // existing state — nothing here changes draft behaviour.
  const teamsDone = teams.length >= 2;
  const poolDone = draft.players.length >= 1;
  // "Done" means the saved order covers every current team — not merely "an order was
  // once saved". Deleting/adding teams after saving used to leave a stale order that
  // still read as complete.
  const draftTeamIds = new Set(draftTeams.map((t) => t.id));
  const validOrder = draft.teamOrder.filter((id) => draftTeamIds.has(id));
  const orderDone = draftTeams.length >= 2 && new Set(validOrder).size === draftTeams.length;
  const draftDone = draft.status === 'completed';
  // Non-draft formats: how many pool players still need their (solo/shared) team.
  const unplacedCount = draft.players.filter((p) => p.teamId === null).length;
  const allPlaced = poolDone && unplacedCount === 0;
  // Draft format walks steps 0-3; non-draft formats only have "enroll & team up" (step 1) and
  // "rosters & start" (step 3) — team creation, draft order and the draft itself don't exist.
  const phases = nonDraft
    ? [
        { label: 'Enroll & team up', done: allPlaced },
        { label: 'Rosters & start', done: allPlaced && eventStarted },
      ]
    : [
        { label: 'Set up teams', done: teamsDone },
        { label: 'Fill player pool', done: poolDone },
        { label: 'Set draft order', done: orderDone },
        { label: 'Run draft', done: draftDone },
      ];
  const stepForPhase = nonDraft ? [1, 3] : [0, 1, 2, 3];
  const nextHint = nonDraft
    ? !poolDone
      ? 'Add everyone who’s playing — sign-ups add players automatically, or enroll and add members below.'
      : unplacedCount > 0
        ? format === 'individual'
          ? 'Give everyone their own team with one click below, then move on to rosters.'
          : 'Put everyone on the shared team with one click below, then move on to rosters.'
        : 'Everyone has a team — manage rosters, Discord channels and the start on the last step.'
    : draftDone
      ? 'Draft complete — team rosters are locked. Reset the draft to make changes.'
      : isDraftInProgress
        ? 'Draft in progress — make your picks below. You can pause, undo, or reset anytime.'
        : !teamsDone
          ? 'Start by adding at least 2 teams below.'
          : !poolDone
            ? 'Fill the player pool — sign-ups add players automatically, or add clan members manually.'
            : !orderDone
              ? 'Set the draft order — every team must be in it — then start the draft.'
              : 'Everything’s ready — start the draft below.';

  // Whether the on-screen step is finished, so "Continue" only unlocks when it's safe to move on.
  const stepDone = nonDraft
    ? activeStep === 1
      ? poolDone
      : true
    : ([teamsDone, poolDone, orderDone][activeStep] ?? true);

  return (
    // Read-only when the event is finished is enforced two ways that leave VIEWING untouched:
    // mutationsBlocked() guards every mutating handler, and the mutating buttons take `editLocked`
    // in their disabled. Clicking a player for stats, expanding answers and step navigation stay
    // live — a blanket disabled <fieldset> used to kill those too.
    <div className="space-y-12 min-w-0">
      {/* Format-first: nothing else renders until the admin picks how teams work. Non-draft picks
          skip team creation and the draft entirely — enrolment teams everyone up in one click. */}
      {format === null && (
        <div className="!mt-0">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            How should teams work?
          </h2>
          <p className="text-xs text-text-muted mb-4">
            Pick a format first — it decides the rest of the setup. You can change your mind any time
            before a draft starts.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => chooseFormat('draft')}
              className="text-left rounded-xl border border-card-border bg-card-bg p-4 hover:border-gold/50 hover:bg-card-bg-hover transition-colors"
            >
              <div className="text-sm font-bold mb-1">Draft into teams</div>
              <p className="text-xs text-text-muted leading-relaxed">
                The classic team bingo: create teams, fill a player pool, then captains take turns
                picking. Best for balanced competitive boards.
              </p>
            </button>
            <button
              type="button"
              onClick={() => chooseFormat('individual')}
              className="text-left rounded-xl border border-card-border bg-card-bg p-4 hover:border-gold/50 hover:bg-card-bg-hover transition-colors"
            >
              <div className="text-sm font-bold mb-1">One team each</div>
              <p className="text-xs text-text-muted leading-relaxed">
                Every player races on their own — a solo leaderboard. No team setup, no draft: enroll
                players and each gets their own team automatically.
              </p>
            </button>
            <button
              type="button"
              onClick={() => chooseFormat('one_team')}
              className="text-left rounded-xl border border-card-border bg-card-bg p-4 hover:border-gold/50 hover:bg-card-bg-hover transition-colors"
            >
              <div className="text-sm font-bold mb-1">One shared team</div>
              <p className="text-xs text-text-muted leading-relaxed">
                The whole clan plays together on a single roster — a community board. No draft: enroll
                players and they all land on one team.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* The wizard chrome (phase bar + explainer). Once the draft is complete we drop it
          for the unified post-draft view below. */}
      {format !== null && !draftDone && (
      <>
      <div className="rounded-xl border border-card-border bg-card-bg p-4 !mt-0">
        <ol className="flex flex-wrap items-center gap-2">
          {phases.map((p, i) => {
            const selected = stepForPhase[i] === activeStep;
            return (
              <li key={p.label}>
                <button
                  type="button"
                  onClick={() => goToStep(stepForPhase[i])}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    selected
                      ? 'border-gold bg-gold/15 text-gold'
                      : p.done
                        ? 'border-accent-green/30 bg-accent-green/10 text-accent-green-light hover:border-accent-green/60'
                        : 'border-card-border text-text-muted hover:text-foreground hover:border-gold/40'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                      p.done ? 'bg-accent-green text-brown-dark' : selected ? 'bg-gold text-brown-dark' : 'bg-card-border'
                    }`}
                  >
                    {p.done ? '✓' : i + 1}
                  </span>
                  {p.label}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-text-muted mt-3">
          <span className="text-foreground/80 font-medium">Next:</span> {nextHint}
        </p>
        <p className="text-xs text-text-muted mt-2">
          Format:{' '}
          <span className="text-foreground/80">
            {format === 'draft' ? 'Draft into teams' : format === 'individual' ? 'One team each' : 'One shared team'}
          </span>
          {draft.status === 'none' && (
            <>
              {' · '}
              <button type="button" onClick={resetFormat} className="text-gold hover:underline">
                change
              </button>
            </>
          )}
        </p>
      </div>

      {/* Plain-language model — open by default until the first team exists, then out of the way.
          Draft format only; the non-draft formats have nothing to explain. */}
      {format === 'draft' && (
      <details open={teams.length === 0} className="rounded-xl border border-card-border bg-card-bg/60 group !mt-4">
        <summary className="cursor-pointer select-none list-none px-4 py-3 flex items-center gap-2 text-sm font-medium">
          <span className="transition-transform group-open:rotate-90 text-text-muted">▸</span>
          How teams &amp; the draft work
        </summary>
        <div className="px-4 pb-4 text-sm text-text-muted leading-relaxed space-y-2">
          <p>A draft splits your players into balanced teams by taking turns picking:</p>
          <ol className="list-decimal ml-5 space-y-1.5">
            <li>
              <span className="text-foreground/80">Create teams</span> — add each team and give it a captain.
            </li>
            <li>
              <span className="text-foreground/80">Fill the player pool</span> — add everyone who&apos;s playing
              (their names come straight from your synced roster).
            </li>
            <li>
              <span className="text-foreground/80">Set the draft order</span> — the sequence teams pick in. It{' '}
              <span className="text-foreground/80">snakes</span> (1→2→3, then 3→2→1) so no team gets first pick every
              round.
            </li>
            <li>
              <span className="text-foreground/80">Run the draft</span> — teams take turns picking players from the
              pool onto their rosters. You can pick for everyone right here, or let each captain pick from their own{' '}
              <span className="text-foreground/80">My Team</span> page. When the pool is empty the draft ends, rosters
              lock, and Discord roles are handed out.
            </li>
          </ol>
        </div>
      </details>
      )}
      </>
      )}

      {format === 'draft' && activeStep === 0 && (
        <>
      {/* Teams */}
      <div>
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Teams
        </h2>
        <p className="text-xs text-text-muted mb-4">The teams players get drafted into. Give each one a captain (a captain can also play).</p>
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
                <div key={team.id} className="flex flex-wrap items-center justify-between gap-2 border border-card-border rounded-xl p-3 bg-card-bg">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0 ring-1 ring-white/20"
                      style={{ backgroundColor: team.color }}
                    />
                    <div className="min-w-0">
                      <span className="font-semibold break-words">{team.name}</span>
                      {team.captainName ? (
                        <span className="text-xs text-gold/90 ml-2 whitespace-nowrap" title="Team captain">
                          ♛ {team.captainName}
                        </span>
                      ) : (
                        <span className="text-xs text-yellow-400/90 ml-2 whitespace-nowrap" title="No captain assigned yet">
                          ♛ no captain
                        </span>
                      )}
                      <span className="text-text-muted text-xs ml-2 whitespace-nowrap">
                        {completed}/{totalWeight}{pointsMode ? ' pts' : ''} ({pct}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => setEditingTeam(team)}
                      className="text-xs text-text-muted border border-card-border px-2.5 py-1 rounded-lg hover:text-foreground hover:border-gold/40 transition-colors"
                      title="Edit name, color or captain (updates the Discord role too)"
                    >
                      Edit
                    </button>
                    <Link
                      href={`/admin/events/${event.id}/teams/${team.id}`}
                      className="text-xs font-medium bg-gold/10 text-gold border border-gold/20 px-2.5 py-1 rounded-lg hover:bg-gold/20 transition-colors"
                      title="See this team's progress and mark tiles done/undone, add or remove submissions"
                    >
                      Manage Board
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
          <button
            onClick={() => setShowAddTeam(true)}
            className="w-full border border-dashed border-card-border rounded-xl py-3.5 text-sm font-medium text-text-muted hover:text-gold hover:border-gold/50 transition-colors"
          >
            + Add Team
          </button>
        ) : (
          <div className="text-sm text-text-muted border border-dashed border-card-border rounded-xl p-4">
            Teams can be added once sign-ups open ({new Date(event.signupOpensAt!).toLocaleString()}).
          </div>
        )}
      </div>

      {/* Discord team channels & roles (only renders when the feature is enabled) */}
      <DiscordTeamProvisioning eventId={event.id} />
        </>
      )}

      {/* Draft — steps 1-3 each render their own section, one at a time. */}
      <div className={activeStep === 0 || format === null ? 'hidden' : ''}>
        {/* Profile-driven balance advisory + modes (classic draft format only): strength bars,
            tiered pool, the balanceMode selector and the admin auto-balance action. */}
        {!nonDraft && (activeStep === 2 || activeStep === 3) && (
          <div className="mb-6">
            <BalancePanel
              eventId={event.id}
              rules={event.rules}
              teams={draftTeams.map((t) => ({ id: t.id, name: t.name, color: t.color ?? null }))}
              ratings={ratings}
              draftStatus={draft.status}
              editLocked={editLocked}
              onChanged={() => {
                fetchDraft();
                router.refresh();
              }}
            />
          </div>
        )}
        {!nonDraft && (activeStep === 2 || activeStep === 3) && (draft.status !== 'none' || draft.teamOrder.length > 0) && (
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

        {activeStep === 1 && draft.status === 'none' && (
          <AutoEnrollPanel
            eventId={event.id}
            canCreateTeams={draft.status === 'none'}
            draftInProgress={isDraftInProgress}
            // Non-draft formats already chose the placement on the format screen — enroll straight
            // into it instead of asking again.
            fixedPlacement={nonDraft ? (format as 'individual' | 'one_team') : undefined}
            onEnrolled={async () => {
              await fetchDraft();
              router.refresh();
            }}
          />
        )}

        {/* Non-draft formats: the one-click replacement for team creation + the draft. Teams up
            everyone still unassigned in the pool (sign-up players, manual adds, guests). */}
        {nonDraft && activeStep === 1 && draft.status === 'none' && (
          <div className="mb-6 border border-gold/25 rounded-xl p-4 bg-gold/5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 bg-gold rounded-full" />
              <h3 className="text-base font-bold">
                {format === 'individual' ? 'Give everyone their own team' : 'Put everyone on one team'}
              </h3>
            </div>
            <p className="text-xs text-text-muted">
              {format === 'individual'
                ? slotMode === 'per-person'
                  ? 'Each person gets one team named after their main account; their alts share that team and their totals combine — no manual team setup, no draft.'
                  : 'Each account gets its own team named after it (alts count as separate teams) — no manual team setup, no draft.'
                : 'Everyone in the pool lands on one shared team — no manual team setup, no draft.'}
              {' '}Run it again any time to team up late joiners.
            </p>

            {/* Account / alt config — a pre-start decision (drives team formation + scoring rollup). */}
            <div className="rounded-lg border border-card-border bg-card-bg/60 p-3 space-y-3">
              <label className="flex items-center justify-between gap-3 text-xs">
                <span className="text-foreground/80 font-medium">
                  Max accounts per person
                  <span className="block text-text-muted font-normal">How many of a person&apos;s accounts (alts) may enter.</span>
                </span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxAccounts}
                  disabled={savingAccountCfg || eventStarted || editLocked}
                  onChange={(e) => setMaxAccounts(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
                  onBlur={() => maxAccounts !== (event.maxAccountsPerPerson ?? 1) && saveAccountConfig({ maxAccounts })}
                  className="w-16 bg-brown-dark border border-card-border rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:border-gold/50 disabled:opacity-50"
                />
              </label>
              {format === 'individual' && (
                <div className="text-xs">
                  <span className="text-foreground/80 font-medium">When a person has alts</span>
                  <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {([
                      { v: 'per-person', label: 'One team per person', hint: 'Alts share the team; totals combine.' },
                      { v: 'per-account', label: 'Each alt its own team', hint: 'Every account is a separate team.' },
                    ] as const).map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        disabled={savingAccountCfg || eventStarted || editLocked}
                        onClick={() => { setSlotMode(o.v); saveAccountConfig({ slotMode: o.v }); }}
                        className={`text-left rounded-lg border px-3 py-2 transition-colors disabled:opacity-50 ${
                          slotMode === o.v ? 'border-gold/60 bg-gold/10' : 'border-card-border hover:border-gold/30'
                        }`}
                      >
                        <div className="font-medium">{o.label}</div>
                        <div className="text-[11px] text-text-muted leading-tight mt-0.5">{o.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={placePool}
              disabled={placing || unplacedCount === 0 || editLocked}
              className="w-full text-sm font-bold bg-gold/15 text-gold border border-gold/30 px-4 py-2 rounded-lg hover:bg-gold/25 transition-colors disabled:opacity-50"
            >
              {placing
                ? 'Teaming up…'
                : unplacedCount === 0
                  ? poolDone
                    ? 'Everyone already has a team'
                    : 'Add players to the pool first'
                  : `Team up ${unplacedCount} player${unplacedCount === 1 ? '' : 's'}`}
            </button>
            {placeNotice && (
              <p className={`text-xs ${placeNotice.type === 'success' ? 'text-accent-green-light' : 'text-red-400'}`}>
                {placeNotice.text}
              </p>
            )}
          </div>
        )}

        {activeStep === 1 && draft.status === 'none' && !signupsOpen && (
          <div className="text-sm text-text-muted border border-dashed border-card-border rounded-xl p-4">
            Player pool fills once sign-ups open ({new Date(event.signupOpensAt!).toLocaleString()}). Players who fill the
            sign-up form are added automatically; admins can also add clan members manually here once the window opens.
          </div>
        )}

        {activeStep === 1 && draft.status === 'none' && signupsOpen && (
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
                  disabled={addingPlayer || selectedClanMemberIds.length === 0 || editLocked}
                  className="w-full text-sm font-medium bg-accent-green/15 text-accent-green-light border border-accent-green/30 px-4 py-2 rounded-lg hover:bg-accent-green/25 transition-colors disabled:opacity-50"
                >
                  {addingPlayer
                    ? 'Adding…'
                    : selectedClanMemberIds.length === 0
                      ? 'Select members above'
                      : `Add ${selectedClanMemberIds.length} to pool`}
                </button>

                {/* Escape hatch: add someone who has no roster/RSN row yet (a Discord-only guest). */}
                <div className="flex gap-2 border-t border-card-border pt-3">
                  <input
                    type="text"
                    value={nameToAdd}
                    onChange={(e) => setNameToAdd(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addPlayerByName(null); }}
                    placeholder="…or add by name (no linked account)"
                    maxLength={60}
                    className="flex-1 min-w-0 bg-brown-dark border border-card-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold/50"
                  />
                  <button
                    onClick={() => addPlayerByName(null)}
                    disabled={addingPlayer || !nameToAdd.trim() || editLocked}
                    className="text-sm font-medium bg-gold/15 text-gold border border-gold/30 px-4 py-2 rounded-lg hover:bg-gold/25 transition-colors disabled:opacity-50 shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>

              {draft.players.length > 0 ? (
                <>
                  <div className="text-xs text-text-muted mb-1.5">{draft.players.length} in the pool</div>
                  <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                  {draft.players.map((player) => {
                    // Timezone from the sign-up form, unless an admin typed an override.
                    const tz = player.timezone ?? player.profile?.timezone ?? null;
                    const canExpand = hasProfileDetail(player.profile);
                    const isExpanded = expandedPoolPlayers.has(player.id);
                    return (
                    <div key={player.id} className="border border-card-border rounded-lg bg-card-bg">
                      <div className="flex items-center justify-between p-2">
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
                        {tz && (
                          <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded flex-shrink-0">{tz}</span>
                        )}
                        <PlayerRatingBadge ratings={ratings} playerId={player.id} />
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        {canExpand && (
                          <button
                            onClick={() =>
                              setExpandedPoolPlayers((prev) => {
                                const next = new Set(prev);
                                if (next.has(player.id)) next.delete(player.id);
                                else next.add(player.id);
                                return next;
                              })
                            }
                            className="text-[10px] text-text-muted hover:text-gold transition-colors border border-card-border px-1.5 py-0.5 rounded"
                            title="Sign-up answers"
                          >
                            Answers {isExpanded ? '▾' : '▸'}
                          </button>
                        )}
                        {/* Mutating actions only — disabled on a locked event. `contents` keeps the
                            fieldset out of the flex layout; the name + Answers view buttons above
                            stay live. */}
                        <fieldset disabled={editLocked} className="contents">
                        <button
                          onClick={() => setEditingPlayer({ id: player.id, name: player.name, discord: player.discord, timezone: player.timezone })}
                          className="text-[10px] text-gold hover:text-gold-light transition-colors border border-gold/20 px-1.5 py-0.5 rounded disabled:opacity-50"
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
                        <button onClick={() => deletePlayer(player.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50">
                          Remove
                        </button>
                        </fieldset>
                      </div>
                      </div>
                      {canExpand && isExpanded && player.profile && (
                        <div className="px-2 pb-2 pt-1 border-t border-card-border">
                          <PlayerProfileDetail profile={player.profile} />
                        </div>
                      )}
                    </div>
                    );
                  })}
                  </div>
                </>
              ) : (
                <div className="text-center py-6 border border-dashed border-card-border rounded-xl">
                  <p className="text-text-muted text-sm">No players in pool yet</p>
                </div>
              )}
            </div>
        )}

        {!nonDraft && activeStep === 2 && draft.status === 'none' && signupsOpen && (
            <div>
              <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                <span className="w-1 h-4 bg-gold rounded-full" />
                Draft Order
              </h3>
              <p className="text-xs text-text-muted mb-3">The order teams pick in — it snakes each round so it stays fair.</p>
              {teams.length >= 2 ? (
                <>
                  <DraftOrderSetup teams={teams} currentOrder={draft.teamOrder} onSave={saveDraftOrder} saving={savingOrder} />
                  {orderDone && draft.players.filter((p) => p.teamId === null).length > 0 && (
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
        )}

        {/* Active / Paused */}
        {activeStep === 3 && isDraftInProgress && (
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
                  ratings={ratings}
                />
              </div>
            )}

            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-gold rounded-full" />
                Team Rosters
              </h3>
              <DraftRosters players={draft.players} teams={draftTeams} teamOrder={draft.teamOrder} onPlayerClick={setStatsRsn} accountSlotMode={event.accountSlotMode} ratings={ratings} />
            </div>
          </div>
        )}

        {/* Not started yet — nudge back to the order step where Start lives. (Draft format only;
            non-draft formats never run one.) */}
        {!nonDraft && activeStep === 3 && draft.status === 'none' && (
          <div className="text-sm text-text-muted border border-dashed border-card-border rounded-xl p-4">
            Nothing to run yet. Finish the <span className="text-foreground/80">draft order</span> and press{' '}
            <span className="text-foreground/80">Start Draft</span> on the previous step to begin picking.
          </div>
        )}

        {/* The unified post-setup view: status, actions, and roster management in one place.
            Reached when the draft completes — or, for non-draft formats, as the "Rosters & start"
            step once players are teamed up. */}
        {(draft.status === 'completed' || (nonDraft && activeStep === 3 && draft.status === 'none')) && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="w-1 h-5 bg-gold rounded-full" />
                {draft.status === 'completed' ? 'Draft complete' : 'Rosters & start'}
              </h2>
              <p className="text-sm text-text-muted mt-1">
                {draft.status === 'completed'
                  ? 'Rosters are set. Start the bingo, adjust rosters, or re-send the roster to Discord below.'
                  : draftTeams.length === 0
                    ? 'No teams yet — go back to Enroll & team up to add players and team them up.'
                    : 'Start the bingo, adjust rosters, or send the roster to Discord below.'}
              </p>
            </div>
            {bingoStartable && (
              <div className="rounded-xl border border-accent-green/30 bg-accent-green/10 p-4">
                <h3 className="text-sm font-bold text-accent-green-light mb-1 flex items-center gap-2">
                  <span className="w-1 h-4 bg-accent-green rounded-full" />
                  Ready to go
                </h3>
                <p className="text-xs text-text-muted mb-3">
                  The draft is done. Starting the bingo now reveals all tiles to members, marks the
                  event live, and announces the start in Discord. The end date stays as configured.
                </p>
                <button
                  onClick={() => startBingoNow()}
                  disabled={startingBingo}
                  className="text-sm font-bold bg-accent-green/20 text-accent-green-light border border-accent-green/30 px-4 py-2 rounded-lg hover:bg-accent-green/30 transition-colors disabled:opacity-50"
                >
                  {startingBingo ? 'Starting...' : 'Start Bingo Now'}
                </button>
                {startBingoError && <p className="text-red-400 text-xs mt-2">{startBingoError}</p>}
              </div>
            )}
            {eventStarted && (
              <div className="rounded-xl border border-accent-green/30 bg-accent-green/10 px-4 py-2.5 text-xs text-accent-green-light flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                Bingo is live — tiles are revealed and stats are tracking.
              </div>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              {draft.status !== 'none' && (
                <button
                  onClick={() => doDraftAction('reset')}
                  disabled={!!draftAction || editLocked}
                  className="text-sm font-medium bg-red-400/10 text-red-400 border border-red-400/20 px-4 py-2 rounded-lg hover:bg-red-400/20 transition-colors disabled:opacity-50"
                >
                  {draftAction === 'reset' ? '...' : 'Reset Draft'}
                </button>
              )}
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

            {/* Discord team channels & roles — the post-draft home for provisioning + the
                "Set up team channels & assign everyone" button. showWhenDisabled surfaces a hint
                (instead of nothing) when the feature is off, so it's discoverable here. */}
            <DiscordTeamProvisioning eventId={event.id} showWhenDisabled />

            {/* Manage rosters — fix mistakes after the draft: add a missed player onto a team, or
                move one back to the pool. */}
            <div>
              <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                <span className="w-1 h-4 bg-gold rounded-full" />
                Manage rosters
              </h3>
              <p className="text-xs text-text-muted mb-3">
                Add someone who was missed, or remove a player from a team (they go back to the pool).
              </p>

              {/* Anyone signed up / added to the pool but never drafted shows here so they can't get
                  stranded off a team. Assign each to a team directly. */}
              {(() => {
                const unassigned = draft.players.filter((p) => p.teamId === null);
                if (unassigned.length === 0) return null;
                return (
                  <div className="mb-4 border border-amber-400/30 bg-amber-400/5 rounded-lg p-3">
                    <p className="text-sm font-semibold text-amber-300 mb-1">
                      In the pool, not on a team yet ({unassigned.length})
                    </p>
                    <p className="text-xs text-text-muted mb-2.5">
                      These players are enrolled but aren&apos;t on a team. Assign each one below — or remove
                      them from the event if they shouldn&apos;t be here (mistaken enrollment, subbed out for good).
                    </p>
                    <div className="space-y-1.5">
                      {unassigned.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 border border-card-border rounded-lg p-2 bg-card-bg">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-sm font-medium truncate">{p.name}</span>
                            <PlayerRatingBadge ratings={ratings} playerId={p.id} />
                          </div>
                          <select
                            defaultValue=""
                            disabled={assigningPlayerId === p.id || editLocked}
                            onChange={(e) => {
                              const tid = parseInt(e.target.value, 10);
                              if (Number.isFinite(tid)) assignToTeam(p.id, tid);
                            }}
                            className="text-xs bg-brown-dark border border-card-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-gold/50 disabled:opacity-50"
                          >
                            <option value="" disabled>
                              {assigningPlayerId === p.id ? 'Assigning…' : 'Assign to team…'}
                            </option>
                            {draftTeams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => resetPlayer(p.id, p.name, false, false, true)}
                            disabled={busyPlayerId === p.id || assigningPlayerId === p.id || editLocked}
                            title="Delete this player from the event entirely — they stop appearing here and in any headcount"
                            className="text-xs text-red-400 hover:text-red-300 border border-red-400/20 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                          >
                            {busyPlayerId === p.id ? '…' : 'Remove from event'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {resetNotice && (
                <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                  <span>{resetNotice}</span>
                  <button onClick={() => setResetNotice(null)} className="text-amber-200/70 hover:text-amber-100 shrink-0" aria-label="Dismiss">✕</button>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {draftTeams.map((team) => {
                  const roster = draft.players.filter((p) => p.teamId === team.id);
                  // Count active roster only — subbed-out (frozen) players are still listed but no
                  // longer playing, so they shouldn't inflate the headcount.
                  const activeCount = roster.filter((p) => !p.frozenAt).length;
                  const subbedOutCount = roster.length - activeCount;
                  return (
                    <div key={team.id} className="border border-card-border rounded-lg p-3 bg-card-bg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                        <Link
                          href={`/admin/events/${event.id}/teams/${team.id}`}
                          className="font-semibold text-sm truncate hover:text-gold transition-colors"
                          title="Open the team page — assign/change captain, view the team's board"
                        >
                          {team.name}
                        </Link>
                        <Link
                          href={`/admin/events/${event.id}/teams/${team.id}`}
                          className="text-[10px] text-gold/90 hover:text-gold border border-gold/30 rounded px-1.5 py-0.5 shrink-0 transition-colors"
                          title="Assign or change this team's captain"
                        >
                          Captain / page
                        </Link>
                        <span className="text-xs text-text-muted ml-auto shrink-0">
                          {activeCount} player{activeCount !== 1 ? 's' : ''}
                          {subbedOutCount > 0 && <span className="text-amber-300/70"> · {subbedOutCount} subbed out</span>}
                        </span>
                      </div>
                      <div className="space-y-1 mb-2">
                        {roster.length === 0 ? (
                          <p className="text-xs text-text-muted">No players yet.</p>
                        ) : (
                          roster.map((p) => {
                            const busy = busyPlayerId === p.id;
                            const frozen = !!p.frozenAt;
                            return (
                              <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                                <span className="truncate flex items-center gap-1.5 min-w-0">
                                  <span className={`truncate ${frozen ? 'text-text-muted' : ''}`}>{p.name}</span>
                                  <PlayerRatingBadge ratings={ratings} playerId={p.id} />
                                  {frozen && (
                                    <span
                                      className="text-[10px] text-amber-300/90 border border-amber-300/30 rounded px-1 py-px shrink-0"
                                      title="Subbed out — no longer active; stat gains frozen at the sub moment (kept-points subs still count toward team tiles, cleared-points subs contribute 0)"
                                    >
                                      Subbed out
                                    </span>
                                  )}
                                </span>
                                {/* All-mutating action cluster — disabled on a locked event; the
                                    player name beside it stays selectable. */}
                                <fieldset disabled={editLocked} className="flex items-center gap-1 shrink-0 border-0 p-0 m-0 min-w-0">
                                  {removeChoiceId === p.id ? (
                                    <>
                                      <span className="text-[10px] text-text-muted mr-0.5">Remove:</span>
                                      <button
                                        onClick={() => { setRemoveChoiceId(null); removeFromTeam(p.id); }}
                                        disabled={busy}
                                        title="Move back to the pool, keeping their contributions intact"
                                        className="text-xs text-text-muted hover:text-foreground border border-card-border px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                                      >
                                        To pool
                                      </button>
                                      <button
                                        onClick={() => resetPlayer(p.id, p.name, false, false, true)}
                                        disabled={busy}
                                        title="Delete this player from the event entirely — strips their share from team tiles, voids their submissions, and removes them from all headcounts. For mistaken enrollments or subs who shouldn't linger."
                                        className="text-xs text-red-400 hover:text-red-300 border border-red-400/20 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                                      >
                                        From event
                                      </button>
                                      <button
                                        onClick={() => setRemoveChoiceId(null)}
                                        disabled={busy}
                                        title="Cancel"
                                        className="text-xs text-text-muted hover:text-foreground border border-card-border px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                                      >
                                        ✕
                                      </button>
                                    </>
                                  ) : subChoiceId === p.id ? (
                                    <>
                                      <span className="text-[10px] text-text-muted mr-0.5">Sub out:</span>
                                      <button
                                        onClick={() => { setSubChoiceId(null); toggleFrozen(p.id, true); }}
                                        disabled={busy}
                                        title="Bench this player but KEEP their points — their frozen contribution still counts toward team tiles."
                                        className="text-xs text-amber-300/90 hover:text-amber-200 border border-amber-300/20 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                                      >
                                        {busy ? '…' : 'Keep pts'}
                                      </button>
                                      <button
                                        onClick={() => resetPlayer(p.id, p.name, false, true)}
                                        disabled={busy}
                                        title="Bench this player AND clear their points (reopens their solo tiles, voids submissions, strips their team-tile share). They still show as subbed out."
                                        className="text-xs text-red-400 hover:text-red-300 border border-red-400/20 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                                      >
                                        Clear pts
                                      </button>
                                      <button
                                        onClick={() => setSubChoiceId(null)}
                                        disabled={busy}
                                        title="Cancel"
                                        className="text-xs text-text-muted hover:text-foreground border border-card-border px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                                      >
                                        ✕
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => { setRemoveChoiceId(null); if (frozen) toggleFrozen(p.id, false); else setSubChoiceId(p.id); }}
                                        disabled={busy}
                                        title={frozen ? 'Resume live tracking for this player' : 'Sub this player out — choose whether to keep or clear their points'}
                                        className="text-xs text-amber-300/90 hover:text-amber-200 border border-amber-300/20 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                                      >
                                        {busy ? '…' : frozen ? 'Sub in' : 'Sub out'}
                                      </button>
                                      <button
                                        onClick={() => resetPlayer(p.id, p.name, false)}
                                        disabled={busy}
                                        title="Reset this player’s own progress (reopens their solo tiles, voids their submissions, strips their team-tile share) but keep them active. The team keeps its completed tiles."
                                        className="text-xs text-red-400 hover:text-red-300 border border-red-400/20 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                                      >
                                        Reset
                                      </button>
                                      <button
                                        onClick={() => { setSubChoiceId(null); setRemoveChoiceId(p.id); }}
                                        disabled={removingPlayerId === p.id || busy}
                                        title="Remove this player — choose whether they go back to the pool or leave the event entirely"
                                        className="text-xs text-text-muted hover:text-foreground border border-card-border px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                                      >
                                        {removingPlayerId === p.id ? '…' : 'Remove'}
                                      </button>
                                    </>
                                  )}
                                </fieldset>
                              </div>
                            );
                          })
                        )}
                      </div>
                      {/* Adding players to a team is an edit — disabled on a locked event. */}
                      <fieldset disabled={editLocked} className="contents">
                      {addToTeamId === team.id ? (
                        <div className="space-y-2 border-t border-card-border pt-2">
                          <ClanMemberPicker
                            mode="multi"
                            eventId={event.id}
                            value={selectedClanMemberIds}
                            onChange={(ids) => setSelectedClanMemberIds(ids)}
                            preferLinked
                            disableEnrolled
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => addMembersToTeam(team.id)}
                              disabled={addingPlayer || selectedClanMemberIds.length === 0}
                              className="flex-1 text-xs font-medium bg-accent-green/15 text-accent-green-light border border-accent-green/30 px-3 py-1.5 rounded-lg hover:bg-accent-green/25 transition-colors disabled:opacity-50"
                            >
                              {addingPlayer ? 'Adding…' : selectedClanMemberIds.length === 0 ? 'Select members' : `Add ${selectedClanMemberIds.length}`}
                            </button>
                            <button
                              onClick={() => { setAddToTeamId(null); setSelectedClanMemberIds([]); setNameToAdd(''); }}
                              className="text-xs text-text-muted hover:text-foreground border border-card-border px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                          {/* Add someone with no roster/RSN row by name (a Discord-only guest). */}
                          <div className="flex gap-2 border-t border-card-border pt-2">
                            <input
                              type="text"
                              value={nameToAdd}
                              onChange={(e) => setNameToAdd(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') addPlayerByName(team.id); }}
                              placeholder="…or add by name"
                              maxLength={60}
                              className="flex-1 min-w-0 bg-brown-dark border border-card-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-gold/50"
                            />
                            <button
                              onClick={() => addPlayerByName(team.id)}
                              disabled={addingPlayer || !nameToAdd.trim()}
                              className="text-xs font-medium bg-gold/15 text-gold border border-gold/30 px-3 py-1.5 rounded-lg hover:bg-gold/25 transition-colors disabled:opacity-50 shrink-0"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddToTeamId(team.id); setSelectedClanMemberIds([]); }}
                          className="w-full text-xs font-medium text-gold border border-gold/20 px-2 py-1.5 rounded-lg hover:bg-gold/10 transition-colors"
                        >
                          + Add player
                        </button>
                      )}
                      </fieldset>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-400 rounded-full" />
                Player stats &amp; RSN
              </h3>
              <p className="text-xs text-text-muted mb-3">Edit a player&apos;s RSN / linked account, tweak stat baselines, or reset a baseline from live hiscores.</p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {draft.players
                  .filter((p) => p.teamId !== null)
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
                      {/* RSN / baseline edits — disabled on a locked event. */}
                      <fieldset disabled={editLocked} className="flex items-center gap-2 border-0 p-0 m-0 min-w-0">
                        <button
                          onClick={() => setEditingPlayer({ id: player.id, name: player.name, discord: player.discord, timezone: player.timezone })}
                          className="text-xs text-gold hover:text-gold-light transition-colors border border-gold/20 px-2 py-0.5 rounded disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setEditingBaselinePlayer({ id: player.id, name: player.name })}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors border border-indigo-400/20 px-2 py-0.5 rounded disabled:opacity-50"
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
                      </fieldset>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-gold rounded-full" />
                Final Rosters
              </h3>
              <DraftRosters players={draft.players} teams={draftTeams} teamOrder={draft.teamOrder} onPlayerClick={setStatsRsn} accountSlotMode={event.accountSlotMode} ratings={ratings} />
            </div>
          </div>
        )}
      </div>

      {/* Step navigation — hidden while the format is unchosen and once the draft is done; the
          unified view has its own actions. Steps walk the current format's phase sequence. */}
      {format !== null && !draftDone && (() => {
        const phaseIdx = Math.max(0, stepForPhase.indexOf(activeStep));
        return (
      <div className="flex items-center justify-between border-t border-card-border pt-4 !mt-6">
        <button
          type="button"
          onClick={() => goToStep(stepForPhase[Math.max(0, phaseIdx - 1)])}
          disabled={phaseIdx === 0}
          className="text-sm text-text-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Back
        </button>
        {phaseIdx < phases.length - 1 && (
          <div className="flex items-center gap-3">
            {!stepDone && <span className="text-xs text-text-muted">{nextHint}</span>}
            <button
              type="button"
              onClick={() => goToStep(stepForPhase[Math.min(phases.length - 1, phaseIdx + 1)])}
              disabled={!stepDone}
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-gold hover:bg-gold-light text-brown-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Continue →
            </button>
          </div>
        )}
      </div>
        );
      })()}

      {showAddTeam && (
        <TeamEditor
          eventId={event.id}
          onClose={() => setShowAddTeam(false)}
          onSaved={() => {
            fetchDraft();
            router.refresh();
          }}
        />
      )}
      {editingTeam && (
        <TeamEditor
          eventId={event.id}
          team={editingTeam}
          onClose={() => setEditingTeam(null)}
          onSaved={() => {
            fetchDraft();
            router.refresh();
          }}
        />
      )}
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

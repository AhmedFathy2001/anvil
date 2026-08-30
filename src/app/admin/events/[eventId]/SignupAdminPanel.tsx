'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { eventStage } from '@/lib/eventStage';
import { parseEventRules } from '@/lib/eventRules';
import { useRouter } from 'next/navigation';
import DateTimePicker from '@/components/DateTimePicker';
import Select from '@/components/Select';
import Input from '@/components/Input';
import PlayerStatsPanel from '@/components/PlayerStatsPanel';
import SignupFeeControls from '@/components/SignupFeeControls';
import SignupAnswersModal from './SignupAnswersModal';
import { BOSSES, SKILL_LABELS } from '@/lib/constants';
import type { Event } from '@/lib/types';
import type { SignupProfile } from '@/lib/signup';
import { formatHoursRange } from '@/lib/signup';

// Default 8-color palette matching the app's existing team color presets.
const DEFAULT_TEAM_COLORS = [
  '#dc2626', // red
  '#2563eb', // blue
  '#16a34a', // green
  '#eab308', // yellow
  '#9333ea', // purple
  '#db2777', // pink
  '#ea580c', // orange
  '#0891b2', // cyan
];

interface SignupRow {
  id: number;
  status: string;
  excludeFromPrizePool: boolean;
  signedUpAt: string;
  updatedAt: string;
  profile: SignupProfile;
  // Null for a guest sign-up (an in-game member with no linked site account).
  user: {
    id: number;
    displayName: string;
    discordUsername: string | null;
    role: string;
  } | null;
  account: { id: number; rsn: string };
  captainTeam: { id: number; name: string; color: string } | null;
  /** Where they play. Null while they're still in the draft pool. */
  team: { id: number; name: string; color: string } | null;
  /** On a team-choice event: the team they asked to join, until the request is answered. */
  requestedTeam: { id: number; name: string; color: string } | null;
  fee: {
    id: number;
    amount: number;
    status: string;
    collectedByUserId: number | null;
    reportedCollectorUserId: number | null;
    proofBlobUrl: string | null;
    confirmedAt: string | null;
    confirmationsCount: number;
    notes: string | null;
  } | null;
}

interface Props {
  event: Event;
  onEventUpdated: (event: Event) => void;
  viewerRole: string;
  viewerId: number;
  confirmationsRequired: number;
}

const BOSS_LABEL: Record<string, string> = Object.fromEntries(
  BOSSES.map((b) => [b.key, b.label]),
);

export default function SignupAdminPanel({
  event,
  onEventUpdated,
  viewerRole,
  viewerId,
  confirmationsRequired,
}: Props) {
  const router = useRouter();
  const [feeInput, setFeeInput] = useState<string>(
    event.signupFee != null ? String(event.signupFee) : '',
  );
  const [addedPrizeInput, setAddedPrizeInput] = useState<string>(
    event.addedPrizePool != null ? String(event.addedPrizePool) : '',
  );
  const [opensAt, setOpensAt] = useState(event.signupOpensAt ?? '');
  const [signupDeadline, setSignupDeadline] = useState(event.signupDeadline ?? '');
  const [paymentDeadline, setPaymentDeadline] = useState(event.paymentDeadline ?? '');
  const [captainDeadline, setCaptainDeadline] = useState(event.captainSelectionDeadline ?? '');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSaved, setConfigSaved] = useState(false);

  const [signups, setSignups] = useState<SignupRow[]>([]);
  const [boardTeams, setBoardTeams] = useState<{ id: number; name: string; color: string }[]>([]);
  const [settlingFees, setSettlingFees] = useState(false);
  const [feeNotice, setFeeNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [actingId, setActingId] = useState<number | null>(null);
  const [promotingPool, setPromotingPool] = useState(false);
  const [poolMessage, setPoolMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [captainPromptId, setCaptainPromptId] = useState<number | null>(null);
  const [captainTeamName, setCaptainTeamName] = useState('');
  const [captainTeamColor, setCaptainTeamColor] = useState(DEFAULT_TEAM_COLORS[0]);
  const [statsRsn, setStatsRsn] = useState<string | null>(null);
  // Add/edit answers modal: null = closed, { signup: null } = add mode,
  // { signup } = edit that sign-up's answers.
  const [answersModal, setAnswersModal] = useState<{ signup: SignupRow | null } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [feeFilter, setFeeFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [closingFees, setClosingFees] = useState(false);
  const [mountedAt] = useState(() => new Date().getTime());
  // How players get onto a team: drafted (default) or by asking for one when they sign up.
  const storedTeamChoice = parseEventRules(event.rules).teamChoice;
  const [teamChoice, setTeamChoice] = useState(storedTeamChoice);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/events/${event.id}/signups`);
    if (res.ok) {
      const data = await res.json();
      setSignups(data.signups ?? []);
      setBoardTeams(data.teams ?? []);
    } else {
      setSignups([]);
      setBoardTeams([]);
    }
  }, [event.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function performAction(
    sigId: number,
    body: {
      action: 'approve' | 'reject' | 'withdraw' | 'promote-captain' | 'demote-captain' | 'set-prize-exclusion' | 'set-team';
      teamName?: string;
      teamColor?: string;
      excludeFromPrizePool?: boolean;
      teamId?: number | null;
    },
  ) {
    setActingId(sigId);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/signups/${sigId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Action failed');
      }
      await load();
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  }

  /**
   * Settle every fee on this board that the viewer is allowed to settle.
   *
   * Fees moved to the Sign-ups tab but the bulk action didn't come with them — it stayed on the
   * retired standalone queue, so clearing a board's worth of collected fees was one click per
   * player. Scoped to THIS event, so "close out the July bingo" can't touch a board still running.
   */
  async function settleFees() {
    const n = settleableFees;
    if (
      !confirm(
        confirmationsRequired <= 0
          ? `Settle ${n} collected fee${n === 1 ? '' : 's'} on this board?`
          : `Sign off ${n} collected fee${n === 1 ? '' : 's'} on this board? Fees you collected yourself are left for another admin.`,
      )
    ) {
      return;
    }
    setSettlingFees(true);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/fees/confirm-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not settle those fees.');
      const parts: string[] = [];
      if (data.confirmed) parts.push(`${data.confirmed} settled`);
      if (data.recorded) parts.push(`${data.recorded} awaiting more confirmations`);
      // Named explicitly, because "why is it still not zero?" is otherwise a mystery.
      if (data.awaitingOtherAdmin) {
        parts.push(`${data.awaitingOtherAdmin} you collected — another admin must sign those off`);
      }
      setFeeNotice(parts.length ? parts.join(' · ') : 'Nothing to settle.');
      await load();
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not settle those fees.');
    } finally {
      setSettlingFees(false);
    }
  }

  /**
   * End the fee ledger on a finished board.
   *
   * The settle pass only ever touched money a mod had collected, so a board that's over kept its
   * list of people who never paid forever — with no honest way to clear it, since "Mark paid" is a
   * lie and "Reset" just puts it back. This writes those off (see lib/feeConfirmations) and settles
   * anything already collected, and it says which is which before doing it.
   */
  async function closeOutFees() {
    const owed = outstandingFees;
    const collected = activeSignups.filter((s) => s.fee?.status === 'collected').length;
    const parts = [
      owed > 0 ? `write off ${owed} unpaid fee${owed === 1 ? '' : 's'}` : '',
      collected > 0 ? `settle ${collected} already collected` : '',
    ].filter(Boolean);
    if (!confirm(`Close out this board's fees? This will ${parts.join(' and ')}. It can't be undone in bulk.`)) {
      return;
    }
    setClosingFees(true);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/fees/close-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not close those fees.');
      const said: string[] = [];
      if (data.settled) said.push(`${data.settled} settled`);
      if (data.writtenOff) said.push(`${data.writtenOff} written off`);
      setFeeNotice(said.length ? said.join(' · ') : 'Nothing left to close.');
      await load();
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not close those fees.');
    } finally {
      setClosingFees(false);
    }
  }

  async function promoteToPool() {
    if (
      !confirm(
        'Promote every eligible sign-up into the draft pool? Captains and already-enrolled players are skipped automatically.',
      )
    ) {
      return;
    }
    setPromotingPool(true);
    setPoolMessage(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/signups/promote-pool`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to promote');
      }
      const data = await res.json();
      setPoolMessage(
        `Added ${data.created} player${data.created === 1 ? '' : 's'} to the pool` +
          (data.skipped ? ` · ${data.skipped} skipped (already enrolled)` : ''),
      );
      await load();
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to promote');
    } finally {
      setPromotingPool(false);
    }
  }

  function openCaptainPrompt(sig: SignupRow) {
    setCaptainPromptId(sig.id);
    setCaptainTeamName(`${sig.user?.displayName ?? sig.account.rsn}'s Team`);
    // Pick the next palette color that isn't already in use by another captain so
    // newly-promoted teams are visually distinct out of the gate.
    const usedColors = new Set(
      signups.map((s) => s.captainTeam?.color).filter((c): c is string => !!c),
    );
    const fallback = DEFAULT_TEAM_COLORS.find((c) => !usedColors.has(c)) ?? DEFAULT_TEAM_COLORS[0];
    setCaptainTeamColor(fallback);
  }

  async function submitCaptainPromotion() {
    if (!captainPromptId) return;
    if (!captainTeamName.trim()) {
      setActionError('Team name is required');
      return;
    }
    await performAction(captainPromptId, {
      action: 'promote-captain',
      teamName: captainTeamName.trim(),
      teamColor: captainTeamColor,
    });
    setCaptainPromptId(null);
  }

  async function saveConfig() {
    setSavingConfig(true);
    setConfigError(null);
    setConfigSaved(false);
    try {
      const parsedFee = feeInput.trim() === '' ? null : Number(feeInput);
      if (parsedFee !== null && (!Number.isFinite(parsedFee) || parsedFee < 0)) {
        throw new Error('Fee must be a non-negative number, or blank for free.');
      }
      const parsedAddedPrize = addedPrizeInput.trim() === '' ? null : Number(addedPrizeInput);
      if (parsedAddedPrize !== null && (!Number.isFinite(parsedAddedPrize) || parsedAddedPrize < 0)) {
        throw new Error('Added prize pool must be a non-negative number, or blank.');
      }
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signupFee: parsedFee,
          addedPrizePool: parsedAddedPrize,
          signupOpensAt: opensAt || null,
          signupDeadline: signupDeadline || null,
          paymentDeadline: paymentDeadline || null,
          captainSelectionDeadline: captainDeadline || null,
          // Only when it actually changed. The rules blob also carries the reveal policy and the
          // scoring modifiers, which are edited on other tabs — sending it every time would let a
          // sign-up save overwrite them with whatever this page happened to load.
          ...(teamChoice !== storedTeamChoice ? { rules: { ...parseEventRules(event.rules), teamChoice } } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      const updated: Event = await res.json();
      onEventUpdated(updated);
      setConfigSaved(true);
      router.refresh();
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingConfig(false);
    }
  }

  function toggleExpanded(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeSignups = signups.filter((s) => s.status !== 'withdrawn');
  const withdrawnCount = signups.length - activeSignups.length;

  // Collected fees this viewer may sign off. With a second signature required, their own
  // collections are excluded — offering "Settle (34)" and then settling none would be a lie.
  // Closing the ledger is a wrap-stage action: while a board is running an unpaid fee is a debt
  // someone is still chasing. Read once per mount — a board doesn't end while you're looking at it,
  // and the route re-checks anyway.
  const eventOver = eventStage(event, mountedAt) === 'wrap';

  // Everything still hanging: unpaid, claimed-but-uncollected, collected-but-unsigned, disputed.
  // Confirmed and closed fees are done and don't count.
  const outstandingFees = signups.filter(
    (s) => s.fee && s.fee.status !== 'confirmed' && s.fee.status !== 'closed' && s.fee.status !== 'collected',
  ).length;
  const unfinishedFees = signups.filter(
    (s) => s.fee && s.fee.status !== 'confirmed' && s.fee.status !== 'closed',
  ).length;

  const settleableFees = activeSignups.filter(
    (s) =>
      s.fee?.status === 'collected' &&
      s.fee.collectedByUserId !== null &&
      (confirmationsRequired <= 0 || s.fee.collectedByUserId !== viewerId),
  ).length;

  // Filtered view for the roster list. Search matches name / RSN / discord; the status
  // filter accepts the four sign-up statuses plus a 'captain' pseudo-status; the fee
  // filter matches the fee row's status (or 'none' for sign-ups with no fee row).
  const visibleSignups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return signups.filter((s) => {
      if (q) {
        const haystack = [
          s.user?.displayName ?? '',
          s.account.rsn,
          s.user?.discordUsername ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter === 'captain') {
        if (!s.captainTeam) return false;
      } else if (statusFilter !== 'all' && s.status !== statusFilter) {
        return false;
      }
      if (teamFilter !== 'all') {
        // 'none' is "still in the pool" — the list every host reads before a draft.
        if (teamFilter === 'none') {
          if (s.team) return false;
        } else if (String(s.team?.id ?? '') !== teamFilter) {
          return false;
        }
      }
      if (feeFilter !== 'all') {
        if (feeFilter === 'none') {
          if (s.fee) return false;
        } else if (s.fee?.status !== feeFilter) {
          return false;
        }
      }
      return true;
    });
  }, [signups, search, statusFilter, feeFilter, teamFilter]);

  const filtersActive =
    search.trim() !== '' || statusFilter !== 'all' || feeFilter !== 'all' || teamFilter !== 'all';

  // Teams that actually have someone on them, in board order — a filter offering empty teams reads
  // like a bug ("why is Red empty?") when it just means the draft hasn't reached them.
  // Every team on the board, from the API — including ones nobody is on yet, which the filter
  // below deliberately omits. Needed by the per-row team picker.
  const allTeams = boardTeams;

  const teamOptions = useMemo(() => {
    const seen = new Map<number, { id: number; name: string; color: string }>();
    for (const s of signups) if (s.team) seen.set(s.team.id, s.team);
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [signups]);

  // Live preview of the public prize pool: added bonus + entry fee × approved entries.
  // Mirrors lib/prizePool.ts (approved entries count regardless of fee payment).
  const approvedSignupCount = signups.filter((s) => s.status === 'approved' && !s.excludeFromPrizePool).length;
  const livePrizePool =
    (Number(addedPrizeInput) || 0) + (Number(feeInput) || 0) * approvedSignupCount;

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <div className="border border-card-border rounded-xl p-5 bg-card-bg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Sign-up Configuration
          </h3>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-text-muted">Fee (gp)</span>
            <Input
              type="number"
              min={0}
              step={1000}
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value)}
              placeholder="0 = free"
              className="w-full mt-1 px-2 py-1.5 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
            />
            <p className="text-xs text-text-muted mt-1">Leave blank for a free event.</p>
          </label>

          <label className="block">
            <span className="text-xs text-text-muted">Added prize pool (gp)</span>
            <Input
              type="number"
              min={0}
              step={1000}
              value={addedPrizeInput}
              onChange={(e) => setAddedPrizeInput(e.target.value)}
              placeholder="0 = none"
              className="w-full mt-1 px-2 py-1.5 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
            />
            <p className="text-xs text-text-muted mt-1">
              Bonus you&apos;re adding on top of entry fees.
            </p>
          </label>

          <div>
            <span className="text-xs text-text-muted">Sign-ups open</span>
            <div className="mt-1">
              <DateTimePicker
                value={opensAt}
                onChange={setOpensAt}
                placeholder="Open immediately"
                ariaLabel="Sign-ups open"
              />
            </div>
          </div>

          <div>
            <span className="text-xs text-text-muted">Sign-up deadline</span>
            <div className="mt-1">
              <DateTimePicker
                value={signupDeadline}
                onChange={setSignupDeadline}
                placeholder="Open until event starts"
                ariaLabel="Sign-up deadline"
              />
            </div>
          </div>

          <div>
            <span className="text-xs text-text-muted">Payment deadline</span>
            <div className="mt-1">
              <DateTimePicker
                value={paymentDeadline}
                onChange={setPaymentDeadline}
                placeholder="No grace — follows sign-up deadline"
                ariaLabel="Payment deadline"
              />
            </div>
            <p className="text-xs text-text-muted mt-1">
              Players can keep editing their answers and pay until this passes — even after
              sign-ups close. Leave blank to lock edits at the sign-up deadline.
            </p>
          </div>

          <div>
            <span className="text-xs text-text-muted">Captains finalized by</span>
            <div className="mt-1">
              <DateTimePicker
                value={captainDeadline}
                onChange={setCaptainDeadline}
                placeholder="Optional"
                ariaLabel="Captain selection deadline"
              />
            </div>
            <p className="text-xs text-text-muted mt-1">
              Internal deadline — between sign-up close and event start, you pick captains.
            </p>
          </div>
        </div>

        <label className="flex items-start gap-2.5 rounded-lg border border-card-border bg-brown-dark/40 px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={teamChoice}
            onChange={(e) => setTeamChoice(e.target.checked)}
            className="mt-0.5 accent-gold"
          />
          <span className="min-w-0">
            <span className="text-sm font-medium">Players pick their own team when they sign up</span>
            <span className="block text-xs text-text-muted mt-0.5">
              For a board whose teams already exist and aren&apos;t drafted. Sign-ups stay open to
              everyone and each applicant names the team they&apos;re joining — you or that team&apos;s
              captain approves them, and approving is what puts them on the roster. Leave off to draft.
            </span>
          </span>
        </label>

        <div className="rounded-lg border border-gold/25 bg-gold/5 px-4 py-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="text-xs uppercase tracking-wide text-text-muted min-w-0">
            Total prize pool so far
          </div>
          <div className="text-xl font-extrabold text-gold tabular-nums whitespace-nowrap">
            {livePrizePool.toLocaleString()} gp
          </div>
        </div>
        <p className="text-xs text-text-muted -mt-2">
          {addedPrizeInput.trim() ? `${(Number(addedPrizeInput) || 0).toLocaleString()} gp added` : 'No bonus'}
          {' + '}
          {approvedSignupCount} approved {approvedSignupCount === 1 ? 'entry' : 'entries'}
          {feeInput.trim() ? ` × ${(Number(feeInput) || 0).toLocaleString()} gp` : ' (free)'}
          . Approved entries count even if the fee isn&apos;t paid yet. Save to publish.
        </p>

        {configError && (
          <div className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg p-3">
            {configError}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={saveConfig}
            disabled={savingConfig}
            className="text-sm font-medium bg-gold/15 text-gold border border-gold/30 px-4 py-2 rounded-lg hover:bg-gold/25 transition-colors disabled:opacity-50"
          >
            {savingConfig ? 'Saving…' : 'Save'}
          </button>
          {configSaved && !configError && (
            <span className="text-xs text-accent-green-light">Saved.</span>
          )}
        </div>
      </div>

      {/* Roster */}
      <div className="border border-card-border rounded-xl p-5 bg-card-bg">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Sign-ups
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-muted">
              {loading
                ? 'Loading…'
                : filtersActive
                  ? `${visibleSignups.length} shown · ${signups.length} total`
                  : `${activeSignups.length} active${withdrawnCount > 0 ? ` · ${withdrawnCount} withdrawn` : ''}`}
            </span>
            {!loading && viewerRole === 'admin' && (
              <button
                onClick={() => setAnswersModal({ signup: null })}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors"
              >
                Add member
              </button>
            )}
            {!loading && viewerRole === 'admin' && settleableFees > 0 && (
              <button
                onClick={settleFees}
                disabled={settlingFees}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-accent-green/30 text-accent-green-light bg-accent-green/10 hover:bg-accent-green/20 transition-colors disabled:opacity-50"
              >
                {settlingFees
                  ? 'Settling…'
                  : `${confirmationsRequired <= 0 ? 'Settle' : 'Sign off'} ${settleableFees} fee${settleableFees === 1 ? '' : 's'}`}
              </button>
            )}
            {!loading && viewerRole === 'admin' && eventOver && unfinishedFees > 0 && (
              <button
                onClick={closeOutFees}
                disabled={closingFees}
                title="Settle what was collected and write off what never came in"
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted bg-brown-dark hover:text-foreground hover:border-gold/40 transition-colors disabled:opacity-50"
              >
                {closingFees ? 'Closing…' : `Close out ${unfinishedFees} fee${unfinishedFees === 1 ? '' : 's'}`}
              </button>
            )}
            {!loading && activeSignups.length > 0 && (
              <button
                onClick={promoteToPool}
                disabled={promotingPool}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-accent-green/30 text-accent-green-light bg-accent-green/10 hover:bg-accent-green/20 transition-colors disabled:opacity-50"
              >
                {promotingPool ? 'Promoting…' : 'Promote remaining to draft pool'}
              </button>
            )}
          </div>
        </div>

        {/* Where the sign-off rule lives. It's a clan-wide setting on another page entirely, so a
            host working through fees here had no way to know it existed, let alone change it. */}
        {!loading && signups.some((s) => s.fee) && (
          <p className="text-xs text-text-muted mb-3">
            {confirmationsRequired === 0
              ? 'Marking a fee paid settles it outright — no second signature required.'
              : `A paid fee settles after ${confirmationsRequired} confirmation${confirmationsRequired === 1 ? '' : 's'} from someone other than whoever collected it.`}{' '}
            <a href="/admin/integrations?tab=fees" className="text-gold hover:underline underline-offset-2">
              Change
            </a>
            {' · '}
            <a href="/admin/fees" className="text-gold hover:underline underline-offset-2">
              All boards with fees
            </a>
          </p>
        )}

        {/* Filters */}
        {!loading && signups.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, RSN, or discord…"
              className="flex-1 px-3 py-1.5 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              ariaLabel="Filter by status"
              className="shrink-0 sm:w-40"
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'captain', label: 'Captains' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'withdrawn', label: 'Withdrawn' },
              ]}
            />
            <Select
              value={feeFilter}
              onChange={setFeeFilter}
              ariaLabel="Filter by fee"
              className="shrink-0 sm:w-40"
              options={[
                { value: 'all', label: 'All fees' },
                { value: 'pending', label: 'Fee: unpaid' },
                { value: 'reported', label: 'Fee: reported' },
                { value: 'collected', label: 'Fee: collected' },
                { value: 'confirmed', label: 'Fee: confirmed' },
                { value: 'disputed', label: 'Fee: disputed' },
                { value: 'closed', label: 'Fee: closed' },
                { value: 'none', label: 'No fee' },
              ]}
            />
            {teamOptions.length > 0 && (
              <Select
                value={teamFilter}
                onChange={setTeamFilter}
                ariaLabel="Filter by team"
                className="shrink-0 sm:w-40"
                options={[
                  { value: 'all', label: 'All teams' },
                  { value: 'none', label: 'Unassigned' },
                  ...teamOptions.map((t) => ({ value: String(t.id), label: t.name })),
                ]}
              />
            )}
          </div>
        )}

        {(actionError || poolMessage || feeNotice) && (
          <div className="mb-3">
            {feeNotice && (
              <div className="text-xs text-accent-green-light border border-accent-green/30 bg-accent-green/10 rounded p-2 mb-1">
                {feeNotice}
              </div>
            )}
            {actionError && (
              <div className="text-xs text-red-400 border border-red-500/30 bg-red-500/10 rounded p-2 mb-1">
                {actionError}
              </div>
            )}
            {poolMessage && !actionError && (
              <div className="text-xs text-accent-green-light border border-accent-green/30 bg-accent-green/10 rounded p-2">
                {poolMessage}
              </div>
            )}
          </div>
        )}

        {!loading && signups.length === 0 && (
          <div className="text-center py-8 border border-dashed border-card-border rounded-xl">
            <p className="text-text-muted text-sm">No sign-ups yet.</p>
          </div>
        )}

        {signups.length > 0 && visibleSignups.length === 0 && (
          <div className="text-center py-8 border border-dashed border-card-border rounded-xl">
            <p className="text-text-muted text-sm">No sign-ups match these filters.</p>
          </div>
        )}

        {visibleSignups.length > 0 && (
          <div className="space-y-2">
            {visibleSignups.map((s) => {
              const isExpanded = expanded.has(s.id);
              return (
                <div
                  key={s.id}
                  className="border border-card-border rounded-lg bg-brown-dark/40"
                >
                  <button
                    onClick={() => toggleExpanded(s.id)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-brown-dark transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {s.user?.displayName ?? s.account.rsn}
                          {s.user ? (
                            <span className="text-text-muted text-xs ml-2">
                              playing {s.account.rsn}
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wide text-text-muted ml-2 px-1 py-0.5 rounded border border-card-border">
                              guest · no Discord
                            </span>
                          )}
                        </div>
                        {s.user?.discordUsername && (
                          <div className="text-xs text-text-muted truncate">
                            @{s.user.discordUsername}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end min-w-0">
                      {s.captainTeam && (
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full border truncate max-w-[7.5rem] sm:max-w-[20rem]"
                          style={{
                            color: s.captainTeam.color,
                            borderColor: `${s.captainTeam.color}55`,
                            background: `${s.captainTeam.color}1a`,
                          }}
                        >
                          captain · {s.captainTeam.name}
                        </span>
                      )}
                      {/* Where they ended up, or what they asked for — the two things the team
                          filter sorts by, said on the row so a filtered list explains itself. */}
                      {!s.captainTeam && s.team && (
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full border truncate max-w-[7.5rem] sm:max-w-[20rem]"
                          style={{
                            color: s.team.color,
                            borderColor: `${s.team.color}55`,
                            background: `${s.team.color}1a`,
                          }}
                        >
                          {s.team.name}
                        </span>
                      )}
                      {!s.team && s.requestedTeam && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-dashed border-card-border text-text-muted truncate max-w-[7.5rem] sm:max-w-[20rem]">
                          wants {s.requestedTeam.name}
                        </span>
                      )}
                      <SignupStatusBadge status={s.status} />
                      {s.fee && <FeeStatusBadge status={s.fee.status} />}
                      <span className="text-xs text-text-muted">
                        {isExpanded ? '▾' : '▸'}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-card-border space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <ProfileStat label="Active /day" value={formatHoursRange(s.profile.activeDailyHours)} />
                        <ProfileStat label="Active /week" value={formatHoursRange(s.profile.activeWeeklyHours)} />
                        <ProfileStat label="AFK /day" value={formatHoursRange(s.profile.afkDailyHours)} />
                        <ProfileStat label="AFK /week" value={formatHoursRange(s.profile.afkWeeklyHours)} />
                        <ProfileStat label="Timezone" value={s.profile.timezone} />
                        <ProfileStat
                          label="Submitted"
                          value={new Date(s.signedUpAt).toLocaleDateString()}
                          plain
                        />
                      </div>

                      {s.profile.bosses && s.profile.bosses.length > 0 && (
                        <ChipList
                          label="Bosses"
                          items={s.profile.bosses.map((k) => BOSS_LABEL[k] ?? k)}
                        />
                      )}
                      {s.profile.skills && s.profile.skills.length > 0 && (
                        <ChipList
                          label="Skills"
                          items={s.profile.skills.map((k) => SKILL_LABELS[k] ?? k)}
                        />
                      )}
                      {s.profile.notes && (
                        <div>
                          <div className="text-xs text-text-muted mb-1">Notes</div>
                          <p className="text-sm whitespace-pre-wrap text-foreground/90">
                            {s.profile.notes}
                          </p>
                        </div>
                      )}

                      {s.fee && (
                        <SignupFeeControls
                          fee={s.fee}
                          viewerRole={viewerRole}
                          viewerId={viewerId}
                          confirmationsRequired={confirmationsRequired}
                          onChanged={load}
                        />
                      )}

                      {/* Per-row admin actions */}
                      <div className="border-t border-card-border pt-3 flex flex-wrap gap-2">
                        {captainPromptId === s.id ? (
                          <div className="w-full space-y-2 rounded-lg bg-brown-dark p-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Input
                                value={captainTeamName}
                                onChange={(e) => setCaptainTeamName(e.target.value)}
                                placeholder="Team name"
                                className="min-w-0 px-2 py-1 rounded bg-card-bg border border-card-border text-xs focus:outline-none focus:border-gold/60"
                              />
                              <div className="flex items-center gap-1 flex-wrap">
                                {DEFAULT_TEAM_COLORS.map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCaptainTeamColor(c)}
                                    aria-label={`Pick ${c}`}
                                    className={`w-5 h-5 rounded-full border-2 transition-transform ${
                                      captainTeamColor === c ? 'border-gold scale-110' : 'border-transparent'
                                    }`}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={submitCaptainPromotion}
                                disabled={actingId === s.id}
                                className="text-xs font-medium px-3 py-1 rounded border border-purple-500/30 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                              >
                                {actingId === s.id ? 'Promoting…' : 'Make captain'}
                              </button>
                              <button
                                onClick={() => setCaptainPromptId(null)}
                                className="text-xs font-medium px-3 py-1 rounded border border-card-border text-text-muted hover:text-foreground"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => setStatsRsn(s.account.rsn)}
                              className="text-xs font-medium px-3 py-1 rounded border border-card-border text-text-muted hover:text-gold hover:border-gold/40 transition-colors"
                            >
                              View stats
                            </button>
                            {viewerRole === 'admin' && s.status !== 'withdrawn' && (
                              <button
                                onClick={() => setAnswersModal({ signup: s })}
                                className="text-xs font-medium px-3 py-1 rounded border border-card-border text-text-muted hover:text-gold hover:border-gold/40 transition-colors"
                              >
                                Edit answers
                              </button>
                            )}
                            {s.captainTeam ? (
                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Demote ${s.user?.displayName ?? s.account.rsn} as captain? "${s.captainTeam!.name}" will be deleted (only allowed if no other players are on it).`,
                                    )
                                  ) {
                                    performAction(s.id, { action: 'demote-captain' });
                                  }
                                }}
                                disabled={actingId === s.id}
                                className="text-xs font-medium px-3 py-1 rounded border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                              >
                                {actingId === s.id ? '…' : 'Demote captain'}
                              </button>
                            ) : (
                              s.status !== 'withdrawn' &&
                              s.status !== 'rejected' && (
                                <button
                                  onClick={() => openCaptainPrompt(s)}
                                  disabled={actingId === s.id}
                                  className="text-xs font-medium px-3 py-1 rounded border border-purple-500/30 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                                >
                                  Make captain
                                </button>
                              )
                            )}
                            {s.status !== 'approved' && s.status !== 'withdrawn' && (
                              <button
                                onClick={() => performAction(s.id, { action: 'approve' })}
                                disabled={actingId === s.id}
                                className="text-xs font-medium px-3 py-1 rounded border border-accent-green/30 text-accent-green-light hover:bg-accent-green/10 transition-colors disabled:opacity-50"
                              >
                                Approve
                              </button>
                            )}
                            {s.status !== 'rejected' && s.status !== 'withdrawn' && !s.captainTeam && (
                              <button
                                onClick={() => {
                                  if (confirm(`Reject ${s.user?.displayName ?? s.account.rsn}'s sign-up?`)) {
                                    performAction(s.id, { action: 'reject' });
                                  }
                                }}
                                disabled={actingId === s.id}
                                className="text-xs font-medium px-3 py-1 rounded border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                              >
                                Reject
                              </button>
                            )}
                            {s.status !== 'withdrawn' && !s.captainTeam && (
                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Withdraw ${s.user?.displayName ?? s.account.rsn} from this event? They'll be marked withdrawn and pulled from the draft pool. A paid fee is kept for the refund trail; an unpaid one is cleared.`,
                                    )
                                  ) {
                                    performAction(s.id, { action: 'withdraw' });
                                  }
                                }}
                                disabled={actingId === s.id}
                                className="text-xs font-medium px-3 py-1 rounded border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10 transition-colors disabled:opacity-50"
                              >
                                Withdraw / remove
                              </button>
                            )}
                            {/* Put them on a different team. A pick made at sign-up is the applicant's
                                REQUEST and the placement was always the host's to decide, so a typo
                                or a change of plan shouldn't need a withdrawal and a re-application.
                                Before approval this edits what they asked for; after it, it moves
                                them — the server does whichever applies. */}
                            {allTeams.length > 0 && (
                              <label className="flex items-center gap-1.5 text-xs text-text-muted">
                                <span className="whitespace-nowrap">{s.team ? 'On team' : 'Wants'}</span>
                                <select
                                  value={String(s.team?.id ?? s.requestedTeam?.id ?? '')}
                                  disabled={actingId === s.id}
                                  onChange={(e) =>
                                    performAction(s.id, {
                                      action: 'set-team',
                                      teamId: e.target.value === '' ? null : Number(e.target.value),
                                    })
                                  }
                                  className="px-2 py-1 rounded border border-card-border bg-brown-dark text-xs text-foreground disabled:opacity-50 focus:outline-none focus:border-gold"
                                  title="Change which team this sign-up is on. Clearing it returns them to the pool."
                                >
                                  <option value="">No team (pool)</option>
                                  {allTeams.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            {s.status === 'approved' && (
                              <button
                                onClick={() =>
                                  performAction(s.id, { action: 'set-prize-exclusion', excludeFromPrizePool: !s.excludeFromPrizePool })
                                }
                                disabled={actingId === s.id}
                                title={
                                  s.excludeFromPrizePool
                                    ? 'Not counted in the prize pool — click to count this entry’s fee toward it'
                                    : 'Counts toward the prize pool — click to exclude a non-paying entry (e.g. a mid-event sub-in) so the pool isn’t inflated'
                                }
                                className={`text-xs font-medium px-3 py-1 rounded border transition-colors disabled:opacity-50 ${
                                  s.excludeFromPrizePool
                                    ? 'border-card-border text-text-muted hover:bg-brown-light'
                                    : 'border-gold/30 text-gold hover:bg-gold/10'
                                }`}
                              >
                                {actingId === s.id ? '…' : s.excludeFromPrizePool ? 'Excluded from pool' : 'Counts toward pool'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {statsRsn && (
        <PlayerStatsPanel rsn={statsRsn} onClose={() => setStatsRsn(null)} />
      )}

      {answersModal && (
        <SignupAnswersModal
          eventId={event.id}
          editTarget={
            answersModal.signup
              ? {
                  id: answersModal.signup.id,
                  displayName: answersModal.signup.user?.displayName ?? answersModal.signup.account.rsn,
                  rsn: answersModal.signup.account.rsn,
                  profile: answersModal.signup.profile,
                }
              : null
          }
          signedUpUserIds={signups
            .filter((s) => s.status !== 'withdrawn' && s.user != null)
            .map((s) => s.user!.id)}
          onClose={() => setAnswersModal(null)}
          onSaved={async () => {
            setAnswersModal(null);
            await load();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ProfileStat({
  label,
  value,
  plain,
}: {
  label: string;
  value: number | string | undefined;
  plain?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-text-muted uppercase tracking-wide">{label}</div>
      <div className={`mt-0.5 break-words ${plain ? 'text-foreground' : 'text-gold font-medium'}`}>
        {value === undefined || value === '' ? '—' : value}
      </div>
    </div>
  );
}

function ChipList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs text-text-muted mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((it) => (
          <span
            key={it}
            className="text-[11px] px-1.5 py-0.5 rounded bg-gold/10 text-gold"
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function SignupStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-text-muted/15 text-text-muted border-text-muted/25',
    approved: 'bg-accent-green/15 text-accent-green-light border-accent-green/25',
    rejected: 'bg-red-500/15 text-red-400 border-red-500/25',
    withdrawn: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  };
  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${map[status] ?? map.pending}`}
    >
      {status}
    </span>
  );
}

function FeeStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-text-muted/15 text-text-muted border-text-muted/25',
    reported: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    collected: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
    confirmed: 'bg-accent-green/15 text-accent-green-light border-accent-green/25',
    disputed: 'bg-red-500/15 text-red-400 border-red-500/25',
  };
  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${map[status] ?? map.pending}`}
    >
      fee · {status}
    </span>
  );
}

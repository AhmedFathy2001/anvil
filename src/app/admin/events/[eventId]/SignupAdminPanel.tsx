'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/events/${event.id}/signups`);
    if (res.ok) {
      const data = await res.json();
      setSignups(data.signups ?? []);
    } else {
      setSignups([]);
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
    body: { action: 'approve' | 'reject' | 'withdraw' | 'promote-captain' | 'demote-captain' | 'set-prize-exclusion'; teamName?: string; teamColor?: string; excludeFromPrizePool?: boolean },
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
      if (feeFilter !== 'all') {
        if (feeFilter === 'none') {
          if (s.fee) return false;
        } else if (s.fee?.status !== feeFilter) {
          return false;
        }
      }
      return true;
    });
  }, [signups, search, statusFilter, feeFilter]);

  const filtersActive = search.trim() !== '' || statusFilter !== 'all' || feeFilter !== 'all';

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
                { value: 'none', label: 'No fee' },
              ]}
            />
          </div>
        )}

        {(actionError || poolMessage) && (
          <div className="mb-3">
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

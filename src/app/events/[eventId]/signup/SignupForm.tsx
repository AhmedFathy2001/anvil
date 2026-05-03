'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BOSSES, SKILLS, SKILL_LABELS } from '@/lib/constants';
import type { SignupProfile } from '@/lib/signup';

interface FeeCollectorOption {
  id: number;
  displayName: string;
  discordUsername: string | null;
  role: string;
}

interface MyAccount {
  id: number;
  rsn: string;
  isPrimary: number;
  verifiedAt: string | null;
  verificationMethod: string | null;
  provisional: number;
}

interface ExistingSignup {
  id: number;
  clanMemberId: number;
  status: string;
  profile: SignupProfile;
  signedUpAt: string;
  updatedAt: string;
}

interface FeeRow {
  id: number;
  amount: number;
  status: string;
  collectedByUserId: number | null;
  reportedCollectorUserId: number | null;
  proofBlobUrl: string | null;
  confirmedAt: string | null;
  notes: string | null;
}

interface Props {
  eventId: number;
  event: {
    signupFee: number | null;
    signupOpensAt: string | null;
    signupDeadline: string | null;
    captainSelectionDeadline: string | null;
    startDate: string | null;
  };
  myAccounts: MyAccount[];
  existingSignup: ExistingSignup | null;
  fee: FeeRow | null;
  prefillClanMemberId: number | null;
  prefillProfile: SignupProfile;
  windowOpen: boolean;
  windowReason: 'not_open_yet' | 'closed' | 'event_started' | null;
}

const WINDOW_MESSAGES: Record<NonNullable<Props['windowReason']>, string> = {
  not_open_yet: 'Sign-ups are not open yet.',
  closed: 'The sign-up deadline has passed.',
  event_started: 'This event has already started.',
};

export default function SignupForm({
  eventId,
  event,
  myAccounts,
  existingSignup,
  fee,
  prefillClanMemberId,
  prefillProfile,
  windowOpen,
  windowReason,
}: Props) {
  const router = useRouter();
  const verifiedAccounts = useMemo(
    () => myAccounts.filter((a) => a.verifiedAt),
    [myAccounts],
  );

  // Pick a sane default for the account selector: existing signup → prefill from prior →
  // first verified account. Falls back to 0 (no selection) if the user has no eligible
  // accounts, which the form blocks below.
  const initialAccountId =
    existingSignup?.clanMemberId ??
    (prefillClanMemberId && verifiedAccounts.some((a) => a.id === prefillClanMemberId)
      ? prefillClanMemberId
      : verifiedAccounts[0]?.id ?? 0);

  const [clanMemberId, setClanMemberId] = useState<number>(initialAccountId);
  const [dailyHours, setDailyHours] = useState<string>(
    String((existingSignup ?? { profile: prefillProfile }).profile.dailyHours ?? ''),
  );
  const [weeklyHours, setWeeklyHours] = useState<string>(
    String((existingSignup ?? { profile: prefillProfile }).profile.weeklyHours ?? ''),
  );
  const [bosses, setBosses] = useState<Set<string>>(
    new Set((existingSignup?.profile ?? prefillProfile).bosses ?? []),
  );
  const [skills, setSkills] = useState<Set<string>>(
    new Set((existingSignup?.profile ?? prefillProfile).skills ?? []),
  );
  const [notes, setNotes] = useState<string>(
    (existingSignup?.profile ?? prefillProfile).notes ?? '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bossFilter, setBossFilter] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const filteredBosses = useMemo(() => {
    if (!bossFilter.trim()) return BOSSES;
    const q = bossFilter.trim().toLowerCase();
    return BOSSES.filter((b) => b.label.toLowerCase().includes(q));
  }, [bossFilter]);

  function toggle(set: Set<string>, value: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clanMemberId) {
      setError('Pick the RSN you want to play with.');
      return;
    }
    setSubmitting(true);
    try {
      const profile: SignupProfile = {
        dailyHours: dailyHours === '' ? undefined : Number(dailyHours),
        weeklyHours: weeklyHours === '' ? undefined : Number(weeklyHours),
        bosses: Array.from(bosses),
        skills: Array.from(skills),
        notes: notes.trim() || undefined,
      };

      const res = await fetch(`/api/events/${eventId}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanMemberId, profile }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save sign-up');
      }
      setSavedAt(new Date().toISOString());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sign-up');
    } finally {
      setSubmitting(false);
    }
  }

  async function withdraw() {
    if (!confirm('Withdraw your sign-up? You can re-sign up before the deadline.')) return;
    setWithdrawing(true);
    try {
      const res = await fetch(`/api/events/${eventId}/signup`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to withdraw');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setWithdrawing(false);
    }
  }

  if (verifiedAccounts.length === 0) {
    return (
      <div className="border border-card-border rounded-xl bg-card-bg p-5 space-y-3">
        <p className="text-sm">
          You need a verified RuneScape account before you can sign up. Link and verify one
          on your profile, then come back here.
        </p>
        <Link
          href="/profile"
          className="inline-block text-sm font-medium px-4 py-2 rounded-lg border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 transition-colors"
        >
          Go to Profile
        </Link>
      </div>
    );
  }

  const isWithdrawn = existingSignup?.status === 'withdrawn';
  const isLocked = !windowOpen && !isWithdrawn;

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Status / window banner */}
      {existingSignup && !isWithdrawn && (
        <div className="border border-accent-green/30 bg-accent-green/10 rounded-xl p-4 text-sm">
          <p className="font-medium text-accent-green-light">
            You&apos;re signed up for this event ({existingSignup.status}).
          </p>
          <p className="text-text-muted text-xs mt-1">
            You can edit your answers until the deadline.
          </p>
        </div>
      )}
      {isWithdrawn && (
        <div className="border border-yellow-500/30 bg-yellow-500/10 rounded-xl p-4 text-sm">
          <p className="font-medium text-yellow-300">You withdrew from this event.</p>
          <p className="text-text-muted text-xs mt-1">
            {windowOpen
              ? 'Submit the form to re-join.'
              : 'Sign-ups are closed — contact a moderator if you want back in.'}
          </p>
        </div>
      )}
      {isLocked && (
        <div className="border border-card-border bg-brown-dark rounded-xl p-4 text-sm text-text-muted">
          {windowReason ? WINDOW_MESSAGES[windowReason] : 'Sign-ups are not currently open.'}
        </div>
      )}

      {/* Fee + deadlines summary */}
      <div className="border border-card-border rounded-xl p-4 bg-card-bg grid sm:grid-cols-3 gap-4 text-xs">
        <div>
          <div className="text-text-muted uppercase tracking-wide">Sign-up fee</div>
          <div className="text-sm font-semibold text-gold mt-1">
            {event.signupFee ? `${event.signupFee.toLocaleString()} gp` : 'Free'}
          </div>
        </div>
        <div>
          <div className="text-text-muted uppercase tracking-wide">Sign-up deadline</div>
          <div className="text-sm font-medium mt-1" suppressHydrationWarning>
            {event.signupDeadline
              ? new Date(event.signupDeadline).toLocaleString()
              : 'Open until event starts'}
          </div>
        </div>
        <div>
          <div className="text-text-muted uppercase tracking-wide">Event starts</div>
          <div className="text-sm font-medium mt-1" suppressHydrationWarning>
            {event.startDate ? new Date(event.startDate).toLocaleString() : 'TBD'}
          </div>
        </div>
      </div>

      {/* Fee status + optional payment report (only if a fee row exists) */}
      {fee && existingSignup && (
        <PaymentReportSection eventId={eventId} fee={fee} isLocked={isLocked} />
      )}

      {/* Account picker */}
      <fieldset className="border border-card-border rounded-xl p-4 bg-card-bg space-y-3">
        <legend className="px-2 text-sm font-bold text-gold">Playing as</legend>
        <p className="text-xs text-text-muted">
          You can only play with one of your linked RuneScape accounts. Stats and tile
          progress will be tracked from this account only.
        </p>
        <div className="space-y-1.5">
          {verifiedAccounts.map((acct) => (
            <label
              key={acct.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                clanMemberId === acct.id
                  ? 'border-gold bg-gold/10'
                  : 'border-card-border hover:border-gold/40'
              }`}
            >
              <input
                type="radio"
                name="clanMemberId"
                value={acct.id}
                checked={clanMemberId === acct.id}
                onChange={() => setClanMemberId(acct.id)}
                disabled={isLocked}
                className="accent-gold"
              />
              <span className="font-medium">{acct.rsn}</span>
              {acct.isPrimary === 1 && (
                <span className="text-[10px] uppercase tracking-wide bg-gold/20 text-gold px-1.5 py-0.5 rounded">
                  primary
                </span>
              )}
              {acct.provisional === 1 && (
                <span className="text-[10px] uppercase tracking-wide bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">
                  provisional
                </span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Activity */}
      <fieldset className="border border-card-border rounded-xl p-4 bg-card-bg space-y-3">
        <legend className="px-2 text-sm font-bold text-gold">Activity</legend>
        <p className="text-xs text-text-muted">
          Helps captains gauge your commitment. Estimates are fine.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-text-muted">Avg hours/day</span>
            <input
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={dailyHours}
              onChange={(e) => setDailyHours(e.target.value)}
              disabled={isLocked}
              className="w-full mt-1 px-2 py-1.5 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
            />
          </label>
          <label className="block">
            <span className="text-xs text-text-muted">Avg hours/week</span>
            <input
              type="number"
              min={0}
              max={168}
              step={1}
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(e.target.value)}
              disabled={isLocked}
              className="w-full mt-1 px-2 py-1.5 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
            />
          </label>
        </div>
      </fieldset>

      {/* Bosses */}
      <fieldset className="border border-card-border rounded-xl p-4 bg-card-bg space-y-3">
        <legend className="px-2 text-sm font-bold text-gold">Bosses you regularly do</legend>
        <input
          type="search"
          placeholder="Filter…"
          value={bossFilter}
          onChange={(e) => setBossFilter(e.target.value)}
          disabled={isLocked}
          className="w-full px-2 py-1.5 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto pr-1">
          {filteredBosses.map((b) => {
            const checked = bosses.has(b.key);
            return (
              <label
                key={b.key}
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                  checked ? 'bg-gold/15 text-gold' : 'hover:bg-brown-dark'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(bosses, b.key, setBosses)}
                  disabled={isLocked}
                  className="accent-gold"
                />
                <span className="truncate">{b.label}</span>
              </label>
            );
          })}
        </div>
        {bosses.size > 0 && (
          <p className="text-xs text-text-muted">{bosses.size} selected</p>
        )}
      </fieldset>

      {/* Skills */}
      <fieldset className="border border-card-border rounded-xl p-4 bg-card-bg space-y-3">
        <legend className="px-2 text-sm font-bold text-gold">Skills you regularly train</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {SKILLS.filter((s) => s !== 'overall').map((s) => {
            const checked = skills.has(s);
            return (
              <label
                key={s}
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                  checked ? 'bg-gold/15 text-gold' : 'hover:bg-brown-dark'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(skills, s, setSkills)}
                  disabled={isLocked}
                  className="accent-gold"
                />
                <span>{SKILL_LABELS[s] ?? s}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Notes */}
      <fieldset className="border border-card-border rounded-xl p-4 bg-card-bg space-y-3">
        <legend className="px-2 text-sm font-bold text-gold">Anything else for captains?</legend>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isLocked}
          maxLength={1000}
          rows={4}
          placeholder="Preferred role, time zone quirks, etc."
          className="w-full px-2 py-1.5 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
        />
        <p className="text-xs text-text-muted text-right">{notes.length}/1000</p>
      </fieldset>

      {error && (
        <div className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg p-3">
          {error}
        </div>
      )}
      {savedAt && !error && (
        <div className="text-sm text-accent-green-light">Saved.</div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={submitting || isLocked}
          className="text-sm font-medium bg-accent-green/20 text-accent-green-light border border-accent-green/30 px-4 py-2 rounded-lg hover:bg-accent-green/30 transition-colors disabled:opacity-50"
        >
          {submitting
            ? 'Saving…'
            : existingSignup && !isWithdrawn
              ? 'Save changes'
              : 'Submit sign-up'}
        </button>
        {existingSignup && !isWithdrawn && windowOpen && (
          <button
            type="button"
            onClick={withdraw}
            disabled={withdrawing}
            className="text-sm font-medium border border-red-400/30 text-red-400 px-4 py-2 rounded-lg hover:bg-red-400/10 transition-colors disabled:opacity-50"
          >
            {withdrawing ? 'Withdrawing…' : 'Withdraw'}
          </button>
        )}
        <Link
          href={`/events/${eventId}`}
          className="text-sm font-medium text-text-muted hover:text-foreground px-3 py-2"
        >
          Back to event
        </Link>
      </div>
    </form>
  );
}

function PaymentReportSection({
  eventId,
  fee,
  isLocked,
}: {
  eventId: number;
  fee: FeeRow;
  isLocked: boolean;
}) {
  const [collectors, setCollectors] = useState<FeeCollectorOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [reportedId, setReportedId] = useState<number | null>(fee.reportedCollectorUserId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(fee.status);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/signup/report-payment`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setCollectors(data.collectors ?? []);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function save(nextId: number | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/signup/report-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectorUserId: nextId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save report');
      }
      const data = await res.json();
      setReportedId(data.fee.reportedCollectorUserId);
      setCurrentStatus(data.fee.status);
      setSavedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save report');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-card-border rounded-xl p-4 bg-card-bg space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <span className="w-1 h-4 bg-gold rounded-full" />
          Fee · {fee.amount.toLocaleString()} gp
        </h2>
        <FeeStatusBadge status={currentStatus} />
      </div>

      <div className="rounded-lg bg-blue-500/10 border border-blue-500/25 p-3 text-xs text-blue-300">
        <strong className="font-semibold text-blue-200">Optional:</strong> If you&apos;ve paid the fee in-game, tag who
        you handed it to. You don&apos;t have to do this — it&apos;s your safety net if there&apos;s ever a
        dispute about who collected your gp. You can come back to this page any time before
        the event ends.
      </div>

      {!loaded && <p className="text-xs text-text-muted">Loading collectors…</p>}

      {loaded && collectors.length === 0 && (
        <p className="text-xs text-text-muted">No fee collectors are configured yet.</p>
      )}

      {loaded && collectors.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs text-text-muted">I paid this person</label>
          <select
            value={reportedId ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              const next = v === '' ? null : Number(v);
              setReportedId(next);
              save(next);
            }}
            disabled={saving || isLocked}
            className="w-full px-2 py-1.5 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60 disabled:opacity-50"
          >
            <option value="">— No report (skip) —</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
                {c.discordUsername ? ` (@${c.discordUsername})` : ''} · {c.role}
              </option>
            ))}
          </select>
          {currentStatus === 'disputed' && (
            <p className="text-xs text-red-400">
              Heads up: your report doesn&apos;t match who claimed they collected the fee. An
              admin will review.
            </p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          {savedAt && !error && (
            <p className="text-xs text-accent-green-light">Report updated.</p>
          )}
        </div>
      )}
    </div>
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
  const cls = map[status] ?? map.pending;
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cls} capitalize`}>
      {status}
    </span>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SKILL_LABELS } from '@/lib/constants';
import Input from '@/components/Input';
import Textarea from '@/components/Textarea';

type Tab = 'no-plugin' | 'manual';

interface AttemptState {
  attemptId: number;
  rsn: string;
  expiresAt: string;
  minDelta: number;
  targetSkill: string;
}

interface CheckResult {
  status: 'pending' | 'succeeded' | 'failed';
  reason?: string | null;
  targetSkill?: string | null;
  bestSkill?: string | null;
  bestDelta?: number;
  minDelta?: number;
  skill?: string;
  delta?: number;
}

function formatSkill(s: string | null | undefined): string {
  if (!s) return '';
  return SKILL_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1);
}

export default function LinkAccountClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('no-plugin');

  return (
    <div>
      <div className="flex border border-card-border rounded-lg overflow-hidden mb-4 text-xs sm:text-sm">
        <TabButton active={tab === 'no-plugin'} onClick={() => setTab('no-plugin')}>
          Verify by XP
        </TabButton>
        <TabButton active={tab === 'manual'} onClick={() => setTab('manual')} bordered>
          Manual review
        </TabButton>
      </div>

      {tab === 'no-plugin' && <StatDeltaPath router={router} />}
      {tab === 'manual' && <ManualReviewPath router={router} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  bordered,
  children,
}: {
  active: boolean;
  onClick: () => void;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 transition-colors ${bordered ? 'border-l border-card-border' : ''} ${
        active
          ? 'bg-gold/15 text-gold font-medium'
          : 'text-text-muted hover:bg-brown-light hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function ManualReviewPath({ router }: { router: ReturnType<typeof useRouter> }) {
  const [rsn, setRsn] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/request-manual-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsn: rsn.trim(), note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not submit request');
      } else {
        setSubmitted(true);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="border border-orange-500/30 bg-orange-500/5 rounded-lg p-4">
        <div className="text-orange-300 font-semibold mb-1">Request submitted</div>
        <div className="text-sm text-foreground/80">
          A moderator will review your claim. Your account appears in your profile as{' '}
          <span className="text-yellow-400">provisional</span> until approved.
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-text-muted mb-3 leading-relaxed">
        Use this if your account&apos;s Hiscores are hidden (ironman-only opt-out, very low-level alts) or if
        the stat-delta path fails for any reason. A moderator will check your claim manually — usually a
        Discord ping or in-game vouch is enough.
      </p>
      <label className="block text-sm font-medium text-foreground/70 mb-1.5">RuneScape Name</label>
      <Input
        value={rsn}
        onChange={(e) => setRsn(e.target.value)}
        placeholder="Display name"
        className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30"
        maxLength={12}
      />
      <label className="block text-sm font-medium text-foreground/70 mb-1.5 mt-3">
        Note for moderators <span className="text-text-muted text-xs font-normal">(optional)</span>
      </label>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. ironman with hidden Hiscores; ping me on Discord (#username)"
        rows={3}
        maxLength={500}
        className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 resize-y"
      />
      <button
        onClick={submit}
        disabled={loading || rsn.trim().length === 0}
        className="mt-3 bg-gold hover:bg-gold-light text-brown-dark font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Submitting…' : 'Request review'}
      </button>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}

function StatDeltaPath({ router }: { router: ReturnType<typeof useRouter> }) {
  const [rsn, setRsn] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const checkInFlight = useRef(false);

  useEffect(() => {
    if (!attempt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [attempt]);

  // Auto-poll /check every 30s while pending. Don't blast the Hiscores API.
  useEffect(() => {
    if (!attempt || check?.status === 'succeeded' || check?.status === 'failed') return;
    const id = setInterval(() => doCheck(), 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, check?.status]);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify-stat-delta/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsn: rsn.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not start verification');
      } else {
        setAttempt({
          attemptId: data.attemptId,
          rsn: data.rsn,
          expiresAt: data.expiresAt,
          minDelta: data.minDelta,
          targetSkill: data.targetSkill,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  async function doCheck() {
    if (!attempt || checkInFlight.current) return;
    checkInFlight.current = true;
    try {
      const res = await fetch('/api/auth/verify-stat-delta/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: attempt.attemptId }),
      });
      const data = (await res.json()) as CheckResult;
      setCheck(data);
      if (data.status === 'succeeded') {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      checkInFlight.current = false;
    }
  }

  if (!attempt) {
    return (
      <div>
        <label className="block text-sm font-medium text-foreground/70 mb-1.5">RuneScape Name</label>
        <Input
          value={rsn}
          onChange={(e) => setRsn(e.target.value)}
          placeholder="Display name"
          className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30"
          maxLength={12}
        />
        <button
          onClick={start}
          disabled={loading || rsn.trim().length === 0}
          className="mt-3 bg-gold hover:bg-gold-light text-brown-dark font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Snapshotting Hiscores…' : 'Start verification'}
        </button>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        <p className="text-xs text-text-muted mt-3 leading-relaxed">
          We&apos;ll snapshot your Hiscores XP and pick a random skill for you to train. Gain ≥1,000 XP
          in that <em>specific</em> skill within 30 minutes and your account is verified. A moderator
          confirms before it&apos;s fully cleared (provisional status).
        </p>
      </div>
    );
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const expired = secondsLeft === 0;

  if (check?.status === 'succeeded') {
    return (
      <div className="border border-green-500/30 bg-green-500/10 rounded-lg p-4">
        <div className="text-green-400 font-semibold mb-1">Verification succeeded</div>
        <div className="text-sm text-foreground/80">
          Detected {check.delta?.toLocaleString()} XP in {check.skill}. Your account is linked but{' '}
          <span className="text-yellow-400">provisional</span> — a moderator will confirm shortly.
        </div>
      </div>
    );
  }

  if (check?.status === 'failed') {
    return (
      <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-4">
        <div className="text-red-400 font-semibold mb-1">Verification failed</div>
        <div className="text-sm text-foreground/80">
          {check.reason === 'expired' && 'The 30-minute window expired. Try again whenever you can play.'}
          {check.reason === 'ownership_conflict' && 'Another user claimed this account during verification.'}
          {!check.reason && 'Try again or use the plugin path.'}
        </div>
        <button
          onClick={() => {
            setAttempt(null);
            setCheck(null);
          }}
          className="mt-3 text-sm text-gold hover:text-gold-light underline-offset-2 hover:underline"
        >
          Start over
        </button>
      </div>
    );
  }

  const targetLabel = formatSkill(attempt.targetSkill);
  const bestProgress = check?.bestSkill === attempt.targetSkill && check?.bestDelta
    ? `${check.bestDelta.toLocaleString()} XP gained`
    : 'no XP gained yet';

  return (
    <div className="border border-gold/30 bg-gold/5 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-text-muted mb-1">Verifying</div>
      <div className="font-mono text-xl font-bold text-gold mb-3">{attempt.rsn}</div>
      <div className="text-sm text-foreground/80 mb-3">
        Log in to RuneScape and gain at least{' '}
        <span className="text-gold font-semibold">{attempt.minDelta.toLocaleString()} XP</span>{' '}
        in <span className="text-gold font-semibold">{targetLabel}</span> within {mm}:{ss}.
      </div>
      <div className="text-[11px] text-text-muted bg-brown-dark/40 border border-card-border rounded px-2 py-1.5 mb-3">
        XP in any other skill is ignored — must be {targetLabel} specifically.
      </div>
      {check && (
        <div className="text-xs text-text-muted mb-3">
          Progress: {bestProgress}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={doCheck}
          disabled={expired}
          className="bg-gold hover:bg-gold-light text-brown-dark font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          Check now
        </button>
        <button
          onClick={() => {
            setAttempt(null);
            setCheck(null);
          }}
          className="text-sm text-text-muted hover:text-foreground underline-offset-2 hover:underline"
        >
          Cancel
        </button>
      </div>
      <p className="text-[11px] text-text-muted mt-3">
        Auto-polls every 30s. If your assigned skill is locked behind a quest, cancel and start over to re-roll.
      </p>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SKILL_LABELS } from '@/lib/constants';
import Input from '@/components/Input';
import Textarea from '@/components/Textarea';

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

/**
 * Proving a character is yours.
 *
 * `manualReview` is off wherever there is no clan — the apex, and the setup flow. Manual review means
 * "a moderator vouches for me", and on the apex there is no moderator to ask: the route behind that
 * tab needs a clan and always did. Verifying by XP has no such dependency, which is why it is the one
 * that works from anywhere, and why it is the whole of the apex offer rather than a tab beside a
 * disabled one.
 */
export default function LinkAccountClient({
  manualReview = true,
  initialRsn = '',
}: {
  manualReview?: boolean;
  /** Pre-filled name, for arriving from a suggestion rather than from memory. */
  initialRsn?: string;
}) {
  const router = useRouter();

  if (!manualReview) return <StatDeltaPath router={router} initialRsn={initialRsn} />;

  // The XP check is the way; a manual check is for the character that can't do it (too low to be
  // on the hiscores, or the check keeps failing), so it sits folded underneath rather than as an
  // equal tab a first-timer has to choose between.
  return (
    <div>
      <StatDeltaPath router={router} initialRsn={initialRsn} />
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-text-muted hover:text-foreground">
          Something else — not on the hiscores, or the XP check won&apos;t work?
        </summary>
        <div className="mt-3">
          <ManualReviewPath router={router} />
        </div>
      </details>
    </div>
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
          A moderator will review your claim. Until then it shows in your profile as{' '}
          <span className="text-yellow-400">awaiting review</span>.
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-text-muted mb-3 leading-relaxed">
        Use this if your character doesn&apos;t show on the OSRS Hiscores (very low level, or hidden), or if the
        XP check didn&apos;t work. A moderator checks it by hand — a message on Discord or a word in-game is
        usually enough.
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

function StatDeltaPath({
  router,
  initialRsn = '',
}: {
  router: ReturnType<typeof useRouter>;
  initialRsn?: string;
}) {
  const [rsn, setRsn] = useState(initialRsn);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the name is already somebody else's: the page offers to claim it rather than stopping.
  const [conflictRsn, setConflictRsn] = useState<string | null>(null);
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

  // Also the re-roll: starting again for the same name cancels the open attempt server-side and
  // picks a fresh skill, with a fresh 30 minutes.
  async function start(name: string = rsn.trim()) {
    setLoading(true);
    setError(null);
    setConflictRsn(null);
    try {
      const res = await fetch('/api/auth/verify-stat-delta/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsn: name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not start verification');
        if (data.code === 'claimed_by_other') setConflictRsn(name);
      } else {
        setCheck(null);
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
        {/* SAY THE DEAL BEFORE THE CLOCK STARTS. The skill is picked at random when they press Start
            (it has to be — a skill known in advance could be pre-trained), so what can be said up
            front is everything else: one skill, 1,000 XP, 30 minutes from the press. */}
        <p className="text-xs text-text-muted mt-2 leading-relaxed">
          When you press Start, we pick one of your skills at random and a{' '}
          <b className="text-foreground">30-minute timer starts</b>. Gain{' '}
          <b className="text-foreground">1,000 XP in that skill</b> before it runs out and the character is yours.
          Be ready to log in first. Don&apos;t like the skill? You can re-roll it.
        </p>
        <button
          onClick={() => start()}
          disabled={loading || rsn.trim().length === 0}
          className="mt-3 bg-gold hover:bg-gold-light text-brown-dark font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Checking the hiscores…' : 'Start the 30-minute check'}
        </button>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        {conflictRsn && <ReportConflict rsn={conflictRsn} />}
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
          Detected {check.delta?.toLocaleString()} XP in {check.skill}. Your account is linked and ready
          to use — it&apos;s flagged for a moderator to look over, which changes nothing for you.
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
          {check.reason === 'ownership_conflict' &&
            'Someone else on Anvil linked this character while you were verifying. If it’s yours, claim it below.'}
          {!check.reason && 'Try again or use the plugin path.'}
        </div>
        {check.reason === 'ownership_conflict' && <ReportConflict rsn={attempt.rsn} />}
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
          onClick={() => start(attempt.rsn)}
          disabled={loading}
          className="text-sm text-gold hover:text-gold-light underline-offset-2 hover:underline disabled:opacity-50"
        >
          {loading ? 'Picking…' : 'Re-roll skill'}
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
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      <p className="text-[11px] text-text-muted mt-3">
        We check the hiscores every 30 seconds. Re-rolling picks a new skill and restarts the 30 minutes.
      </p>
    </div>
  );
}

/**
 * "This is my character". The way out of "somebody else has linked it": starts the same ownership
 * claim as the plugin's "This is my account" (/api/profile/claim-dispute → lib/ownershipClaims) — an
 * XP check first, and only then is the owner (or Anvil staff) asked. The claim and its Check button
 * live on /settings/claims.
 */
function ReportConflict({ rsn }: { rsn: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [result, setResult] = useState<{ claim: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/profile/claim-dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsn }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not start the claim');
        setState('idle');
      } else {
        setResult({ claim: !!data.claim, message: typeof data.message === 'string' ? data.message : '' });
        setState('done');
      }
    } catch {
      setError('Network error — try again');
      setState('idle');
    }
  }

  if (state === 'done' && result) {
    return (
      <div className="mt-3 rounded-lg border border-gold/30 bg-gold/5 p-3 text-sm text-foreground/85">
        {result.message}
        {result.claim && (
          <>
            {' '}
            Follow it, and press <b className="text-foreground">Check</b> once you’ve gained the XP, on{' '}
            <a href="/settings/claims" className="text-gold hover:underline">
              your claims
            </a>
            .
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-card-border bg-brown-dark/40 p-3">
      <p className="text-sm text-text-muted">
        Prove it with a quick XP check: Anvil names a skill, you gain a little XP in it within 30 minutes, and only then is whoever linked{' '}
        <b className="text-foreground">{rsn}</b> asked. Anvil never tells you who that is.
      </p>
      <button
        type="button"
        onClick={claim}
        disabled={state === 'sending'}
        className="mt-2 rounded-lg border border-gold/45 px-3 py-1.5 text-sm font-semibold text-gold hover:bg-gold/10 disabled:opacity-50"
      >
        {state === 'sending' ? 'Starting…' : 'This is my character'}
      </button>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}

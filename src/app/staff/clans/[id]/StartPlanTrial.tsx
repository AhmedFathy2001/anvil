'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Input from '@/components/Input';
import Select from '@/components/Select';

/**
 * "Start plan trial": lend this clan or creator space a plan tier until a date, with no card
 * (lib/ownerTrials grantTrial, kind 'plan'). The same grant as /staff/money, for the clan in front
 * of you. Platform root only, like every trial: the API refuses anyone else.
 */
export default function StartPlanTrial({ clanId, tiers, runningId }: { clanId: number; tiers: { value: string; label: string }[]; runningId: number | null }) {
  const router = useRouter();
  const [tier, setTier] = useState(tiers[tiers.length - 1]?.value ?? '');
  const [days, setDays] = useState('30');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());
  const n = Number(days);
  const ends = Number.isInteger(n) && n >= 1 && n <= 365 ? new Date(openedAt + n * 86_400_000).toISOString().slice(0, 10) : null;

  async function send(method: 'POST' | 'DELETE') {
    setBusy(true);
    setMessage(null);
    const res =
      method === 'POST'
        ? await fetch('/api/staff/money/trials', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'plan', clanId, tier, days: n, note }) })
        : await fetch(`/api/staff/money/trials/${runningId}`, { method });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setMessage(res.status === 404 && method === 'POST' ? 'Only the platform owner can start a trial.' : (json.error ?? 'Could not save that.'));
    setMessage(method === 'POST' ? 'Trial started.' : 'Trial ended.');
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      <p className="text-sm text-text-muted">
        Lends the tier until the end date. No card is asked for, nothing is sent to Gumroad, and what the clan pays for is not
        changed. When it ends the clan is back on what it pays for; nobody is removed.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-text-muted">
          Tier
          <Select value={tier} onChange={setTier} options={tiers} ariaLabel="Tier" className="mt-1 w-44" />
        </label>
        <label className="text-xs text-text-muted">
          Days
          <Input inputMode="numeric" className="mt-1 block w-24" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="min-w-40 flex-1 text-xs text-text-muted">
          Note (recorded)
          <Input className="mt-1 block w-full" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </label>
        <button type="button" disabled={busy || !ends || runningId != null} onClick={() => void send('POST')} className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-brown-dark disabled:opacity-50">
          Start plan trial
        </button>
        {runningId != null && (
          <button type="button" disabled={busy} onClick={() => void send('DELETE')} className="rounded-lg border border-card-border px-3 py-2 text-sm text-red-300">
            End the running trial now
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-text-muted">{runningId != null ? 'One plan trial at a time: end the running one before starting another.' : ends ? `Ends ${ends} (UTC).` : 'Enter a number of days, 1 to 365.'}</p>
      {message && <p className="mt-1 text-xs text-gold">{message}</p>}
    </div>
  );
}
